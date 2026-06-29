# Materiabill Architecture (Web Phase)

## Verdict

Inframodern owns **identity and master data**; Materiabill owns **operational
and financial data**. The contractor admin web app and Materiabill backend form
a single pnpm/Turborepo monorepo. Inframodern master data flows into Materiabill
read-only projections over RabbitMQ. The admin app reaches the backend over REST
(OpenAPI contracts) and receives live updates over SSE.

## System Overview

```
                +-------------------------------------+
                |            Inframodern              |
                |  OAuth  •  master data  •  billing  |
                +------+----------------+-------------+
                       |                |
              OAuth (auth code,         | RabbitMQ
              refresh; server-side)     | (users, brands, locations,
                       |                |  customers, taxes, fx rates)
                       v                v
        +--------------+----------------+--------------+
        |               Materiabill backend           |
        |   apps/api (NestJS HTTP)   apps/worker       |
        |        |                       |             |
        |     REST + SSE          RabbitMQ consumers   |
        |        |                 + scheduled jobs     |
        +--------+-----------------------+-------------+
                 |                       |
            REST | SSE                   | SQL
                 v                       v
        +--------+--------+      +-------+--------+
        |  apps/admin     |      |   PostgreSQL   |
        | (React + Vite)  |      |  (Drizzle ORM) |
        +-----------------+      +----------------+
```

## Repo Shape

pnpm workspace + Turborepo:

```
apps/api/             NestJS HTTP API: admin endpoints, auth/OAuth callback, OpenAPI docs, SSE
apps/worker/          NestJS worker: RabbitMQ consumers, scheduled jobs, notification fan-out
apps/admin/           React + Vite contractor admin web app

packages/db/          Drizzle schema, migrations, clients, shared queries
packages/contracts/   OpenAPI types, Zod schemas, shared enums
packages/permissions/ permission keys, role helpers, guard metadata
packages/config/      shared env schema (Zod), tsconfig, eslint, build config
```

Boundaries: the admin app imports `contracts` types only; the worker and api
share `db`, `contracts`, `permissions`, `config`; no app reaches into another
app's internals.

## Communication

| From | To | Method | Purpose |
|------|----|--------|---------|
| Admin app | Materiabill API | REST | Admin operations |
| Materiabill API | Admin app | SSE | Live updates (pending decisions, settlement bar, milestones) |
| Admin app | Materiabill API | Upload endpoint | Logos, document assets, photos |
| Inframodern | Materiabill worker | RabbitMQ | Master-data events |
| Materiabill API/worker | PostgreSQL | SQL | Persistence |
| Materiabill API | Inframodern OAuth | HTTPS | Auth code exchange, refresh |

## Backend Modules (first pass)

1. `SessionModule` — Inframodern OAuth, encrypted server-side session, `/user`
2. `InframodernProjectionsModule` — read models for synced master data
3. `InframodernSyncModule` — RabbitMQ consumers, idempotent upserts, checkpoints
4. `WorkspaceContextModule` — resolves and enforces workspace scope per request
5. `PermissionsModule` — RBAC catalog, role assignment, guards
6. `AuditModule` — append-only audit events with audience labeling
7. `ProjectsModule` — projects, participants, invites, stub claim
8. `AgreementTermsModule` — commercial model + terms, lock enforcement
9. `ScheduleModule` — phases, milestones, timeline baseline
10. `DrawsModule` — money-in draw lifecycle, retention release
11. `PayablesModule` — money-out (org-only), pay-when-paid, payment edges
12. `ContinuityModule` — goodwill record, auto-`carrying`, pause
13. `BudgetModule` — budget lines with audience/disclosure control
14. `MaterialsModule` — BOM, purchase orders, usage log, client suggestions
15. `SubcontractorsModule` — sub links, compliance badges, cross-workspace view
16. `SubmittalsModule` — submittals, design packages, variations, revisions
17. `DocumentsModule` — documents, certificates, signatories
18. `SignOffsModule` — unified sign-offs, grace window, pending decisions
19. `SnagsModule` — punch list, fix photos, admin override
20. `BrandingModule` — white-label brands, custom domains, `first_client_access_at`
21. `SettingsModule` — workspace defaults (retention, grace, disclosure, etc.)
22. `NotificationsModule` — in-app/email channels, reminders
23. `SearchModule` — global search (projects, materials, people, documents; capped)

## Inframodern Sync

See **`inframodern-integration.md`** for the authoritative resource contract,
RabbitMQ topology, auth flow, and initial-vs-ongoing sync. In short:

- Consumed subset: **users, workspaces, memberships, brands, locations, exchange
  rates** (required); **measurement units, taxes** (recommended); **customers**
  (open decision). Workspaces + memberships arrive in the user payload + login
  bootstrap, not a dedicated queue.
- RabbitMQ events upsert into read-only projection tables (`*_refs`).
- Handlers are **idempotent**; never mint local IDs for synced rows.
- `sync_checkpoints` tracks progress; `sync_failures` captures dead letters for
  admin visibility; `sync_inbox` records received events.
- Initial backfill is admin-triggered from the Inframodern admin panel
  (republish-driven `SyncJob`); ongoing sync is automatic over the bound queues.

## Identity Model

- **Contractor team members**: Inframodern identities, projected into
  `inframodern_user_refs`; access is workspace-scoped via RBAC.
- **Clients**: `client_identities` — one record per verified email/phone,
  cross-contractor, backed by an Inframodern identity. A client is either an
  `endCustomerId` (individual) or a `clientOrgId` (a peer contractor workspace,
  enabling subcontract recursion).
- One OAuth identity can hold roles across multiple workspaces; a workspace
  switcher re-scopes all data.

## Access Enforcement

Two gates on every request:
1. **Authenticated** Inframodern session (route guard).
2. **Authorized** for the action via RBAC permission key within the resolved
   workspace.

Audience visibility (`org | participants | client`) is enforced **server-side**
on all reads and writes. Money-out (payables) is `org`-only and never appears in
any client-audience query.

## Workspace, Identity, and Cross-Workspace Context

- **Workspace** is the isolation boundary; every operational table carries
  `workspace_id`.
- **Cross-contractor client view**: a client sees all their projects across
  contractors; a contractor sees only its own relationship with that client.
- **`PaymentEdge`** is a shared record linking a contractor's payable to a
  subcontractor's incoming draw. It scopes cross-workspace visibility strictly
  to that project relationship and carries pay-when-paid, retention, and
  continuity propagation along the subcontract chain. Every access via an edge
  is recorded as an immutable audit entry visible to the sub.

## Financial & Lock Rules

- **Commercial models (BR-PR-1)**: exactly three — lump-sum, cost-plus,
  remeasured. **GMP is a cost-plus sub-option (BR-PR-2)**, not a fourth model.
- **Terms lock (BR-MO-4)**: `AgreementTerms` lock when the **first `DrawItem`
  transitions Pending → Approved** (the client's first draw approval). At v1, no
  other financial record triggers this lock. After lock, terms are immutable.
- **Draw states**: BRD defines five (expected → submitted → approved → released
  → received); the web app maps these to **Pending** (submitted), **Approved**,
  and **Released** (terminal, collapsing released + received). "Expected" is a
  non-persisted forecast.
- **Money-out hidden (BR-MO-2)**: payables are never client-visible.
- **Retention (BR-MO-3)**: default 5%, per-project override.
- **Multi-currency (BR-MO-5)**: every amount carries an explicit currency
  (SAR primary, EGP supported); rollups use synced exchange rates.
- **Continuity (BR-MO-7)**: `on_track | carrying | paused`; client sees the
  direct relationship only, never the subcontractor chain.

## Realtime

SSE streams drive: the Pending Decisions panel (grace-window countdowns), live
settlement-bar updates on draw release, and milestone-completion updates.

## Scheduled / Background Work (worker)

- Grace-window expiry → commit decision, fan out notifications, mark sign-off
  immutable.
- Continuity auto-`carrying` when an expected draw date passes without Released.
- 48h contractor-invite auto-nudge (Invite Variant B only).
- Snag admin-override eligibility (Fixed ≥ 30 days and/or client deleted).

## Branding / White-label

Per-**project** brand (accent colour, logo, custom domain via CNAME + SSL). Once
`first_client_access_at` is set (first authenticated client portal open),
`brandId` becomes locked for that project.

## Naming Rules

- Use **workspace** (not tenant/account), **project** (not job/site as an
  entity), **draw** for money-in, **payable** for money-out.
- Avoid a generic `UsersModule` for contractor members — they are Inframodern
  projections.
- Keep GMP as a field on cost-plus terms, never a standalone model enum value.

| Don't use | Use instead | Reason |
|-----------|-------------|--------|
| `tenant` / `account` | `workspace` / `workspace_id` | Inframodern owns the account boundary |
| `job` / `site` (as the entity) | `project` | product language |
| `invoice` (money-in) | `draw` / `draw_item` | domain language |
| `bill` (money-out) | `payable` | domain language |
| a `model = 'gmp'` enum value | `gmp_ceiling` field on cost-plus terms | GMP is a cost-plus sub-option |

## Database & Persistence Conventions

The actual schema lives in code (`packages/db`, Drizzle) as the single source of
truth; these are the standing conventions that schema must follow.

**Workspace isolation**
- Every operational table carries a non-null `workspace_id`; all queries are
  scoped by the request's resolved workspace.
- The only deliberate cross-workspace records are `payment_edges` and
  `client_identities`, which carry explicit relationship scoping.

**Drizzle naming**
- PostgreSQL: plural `snake_case` tables, `snake_case` columns; Drizzle config
  `casing: 'snake_case'` (camelCase TS ↔ snake_case SQL).
- Foreign keys `{target}_id`; join tables `{left}_{right}_assignments` or
  `{left}_{right}`; event/history tables `{noun}_events`.

**Money**
- Store money as integer **minor units** (`amount_minor`, `unit_price_minor`,
  `retention_amount_minor`, `target_cost_minor`, `gmp_ceiling_minor`, …), each
  with an explicit `currency` ISO code. Quantities are separate numeric fields.
- Runtime math uses decimal.js; rollups convert via `exchange_rate_refs`.

**Immutability / append-only**
- Append-only: audit events, material usage log, submittal revisions.
- Immutable once resolved: draw items (Released), variations (Approved),
  certificates (Executed), sign-offs (Resolved), agreement terms (locked),
  timeline baselines (Agreed), project baseline delivery date (set).
- Enforce in the service layer; do not expose update/delete paths for these.

**Inframodern projections**
- Synced master data lives in read-only `*_refs` tables; never mint local IDs
  for synced rows. Sync handlers are idempotent.

## Mental Model

Inframodern is the system of record for *who* and *what master data*.
Materiabill is the system of record for *what happened on the project and the
money*. Everything operational is workspace-scoped, audience-gated, and (for
financial/legal records) append-only and immutable once resolved.
