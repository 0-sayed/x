# Materiabill ↔ Inframodern Integration (Web Phase)

Materiabill is **not standalone**. Users authenticate through Inframodern, and a
defined set of master data is projected **read-only** from Inframodern. This file
is the authoritative contract for that integration — when agents work the project
autonomously, this is what they rely on for login and synced resources.

## Roles

- **Inframodern** — OAuth authorization server, system of record for identity and
  master data, and the RabbitMQ **producer**. Stack: Fastify + Prisma (we do not
  share its codebase).
- **Materiabill** — OAuth **client** and RabbitMQ **consumer**; owns operational
  and financial data only. We integrate over OAuth (HTTPS) + RabbitMQ — never
  touch Inframodern's database in normal operation (one contingency exception, §6).

## Integration Prerequisites (one-time, before any sync)

An agent must assume these exist; the app cannot connect otherwise.

1. **App registered in Inframodern `resources.json`** under key `materiabill`,
   with a `consumes.inframodern` map and dependency graph (§4). This drives both
   our queue bindings and the initial-sync ordering.
2. **OAuth client registered** in Inframodern: `clientId`, `clientSecret`,
   `grants: [authorization_code, refresh_token]`, `redirectUris`. Sandbox mode
   uses the designated Inframodern sandbox client.
3. **App installed in the workspace** (`InstalledApplication`) with an **active
   `Subscription`** — this is the access gate.
4. **App code + environment** config: queues/exchanges are namespaced
   `{app-code}-{env}` (e.g. `materiabill-testing`). `RABBITMQ_ENVIRONMENT`
   selects the env (default `testing`).

## Authentication (login)

- **Flow:** OAuth 2.0 `authorization_code` + `refresh_token` (OIDC scopes
  `openid profile email`).
- **Inframodern endpoints:** `GET /oauth/authorize` (front door
  `/authenticate`), `POST /oauth/token`, `GET /oauth/user`.
- **Materiabill `SessionModule`:** `/auth/login` → redirect to Inframodern →
  `/auth/callback?code=…` → exchange for tokens **server-side** → `GET /oauth/user`
  → establish an encrypted server-side session.
- **Tokens never reach the browser.** The browser holds a session cookie only.
  Access token ≈ 24h; refresh happens server-side.
- `GET /oauth/user` returns the identity **and** the user's `workspaces[]` (each
  with role + permissions) and `adminWorkspaces[]`. On first login, **bootstrap**:
  upsert the user, their workspaces, and memberships into the projection tables.
  This is how workspace/membership refs are seeded **without a dedicated queue**.
- Subscription validity is enforced at token issuance (Inframodern checks
  `subscription.endDate > now`). No active subscription → no access.

## Synced Master Data (the resource contract)

Inframodern publishes 14 entity types overall (routing key `inframodern.{entity}`).
Materiabill consumes only the subset its domain needs, declared in `resources.json`.

**Required**

| Resource       | Inframodern routing key                                   | Projection                  | Why                                                                                          |
| -------------- | --------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| Users          | `inframodern.users`                                       | `inframodern_user_refs`     | Identity. Payload carries `workspaces[]` + `adminWorkspaces[]`.                              |
| Workspaces     | derived from user payload + bootstrap (queue also exists) | `workspace_refs`            | Tenant/isolation boundary.                                                                   |
| Memberships    | derived from user payload                                 | `workspace_membership_refs` | Access gate inside a workspace.                                                              |
| Brands         | `inframodern.brands`                                      | `brand_refs`                | Per-project white-label.                                                                     |
| Locations      | `inframodern.locations`                                   | `location_refs`             | Project city, geo-coords, site.                                                              |
| Exchange rates | `inframodern.exchange-rates`                              | `exchange_rate_refs`        | Multi-currency portfolio rollups (`ExchangeRate` + `ExchangeRateValue`: base + quote rates). |

**Recommended (domain fit; wire the consumer when the feature ships)**

| Resource          | Inframodern routing key         | Projection              | Why                                                                                                                                         |
| ----------------- | ------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Measurement units | `inframodern.measurement-units` | `measurement_unit_refs` | BOM / materials quantities (m, m³, kg, ton, bag). Inframodern already owns units — do **not** invent a local UOM enum. `dependsOn: brands`. |
| Taxes             | `inframodern.taxes`             | `tax_refs`              | Saudi/Egypt VAT, ZATCA e-invoicing. **No concrete v1 consumer yet** — sync only when invoicing/VAT lands. `dependsOn: brands`.              |

**Open decision (do not hard-code — see §7)**

| Resource  | Inframodern routing key | Status                                                                                                                                                                                |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customers | `inframodern.customers` | Only consumed if client identity uses the **Inframodern customer projection** option (see Open Decisions §1); not consumed under **Materiabill-native ClientIdentity** (recommended). |

**Not synced**

- **Currencies** — ISO 4217 constants + the workspace default `paymentCurrency`;
  not a queue. Inframodern's `Currency`/`Country` are static global refs (REST).
- **Products / categories / waste-categories / variant-options / variant-values /
  product-tags** — retail/POS catalog concepts. Materiabill's materials/BOM is its
  own domain. Do **not** consume these.
- **Subscription / install / plan state** — not projected as data; checked at
  OAuth/request time as an access gate (plan tier also gates features, e.g. brand
  footer removal).

**Dependency order** (from `resources.json`, governs initial sync):
`users → brands → { locations, measurement-units, taxes, customers, exchange-rates }`.

## Sync Mechanics (RabbitMQ)

- **Exchange (topic):** `x.inframodern-{env}`; dead-letter `dlx.inframodern-{env}`.
- **Per-entity queue:** `q.inframodern-{env}.{app-code}-{env}.{entity}`
  (e.g. `q.inframodern-testing.materiabill-testing.locations`), bound with routing
  key `inframodern-{env}.{entity}`. Durable, manual ack, prefetch 10, dead-lettered.
- **Message:** `{ items: [...], correlationId, jobId?, operationId?, targetApp? }`.
  IDs are Inframodern UUIDs — **never mint local IDs**; upsert with `ON CONFLICT`.
  Soft-delete via `deletedAt`.
- **Idempotency:** `sync_inbox` keyed by event id (skip if already processed);
  failures → `sync_failures` (payload + error + `retryCount`) with an admin retry
  endpoint; `sync_checkpoints` reserved for cursored entities.
- Consumers live in `apps/worker`, **never** in the admin client.

## Initial Sync vs Ongoing Sync

- **Initial sync is admin-triggered from the Inframodern admin panel**
  (Applications → Sync → `POST /sync/application`). Inframodern reads
  `resources.json`, builds a dependency-ordered `SyncJob`, and **republishes all
  existing records** of each consumed entity to our queues; we process and ack each
  operation with a `sync-completion` message; Inframodern then releases dependent
  operations. This is the canonical first backfill when Materiabill is newly
  integrated into a workspace.
  - Admin routing key: `inframodern-{env}.{app-code}-{env}.republish-request`
  - Completion: `{app-code}-{env}.inframodern-{env}.sync-completion`
- **Ongoing sync is automatic.** Once bound, our queues receive every
  create/update/delete as Inframodern emits it. No checkpoint needed — queue
  persistence + idempotent upsert. No manual trigger.
- **Optional direct backfill (contingency).** As elwaste does, an admin-only
  `POST /sync/pull` can read Inframodern's Postgres directly (`INFRAMODERN_DB_URL`)
  to reconcile. Secondary only — the republish flow is primary. It couples to
  Inframodern's schema, so use sparingly.

## Open Decisions (surface, don't hard-code)

1. **Client identity (BRD Open Decision 1).** **Materiabill-native ClientIdentity**:
   `ClientIdentity` keyed on verified email/phone — do **not** consume
   `inframodern.customers`. **Inframodern customer projection**: project Inframodern
   customers into `customer_refs` and map to `endCustomerId`. **Recommendation:**
   Materiabill-native for v1 — clients aren't necessarily Inframodern tenants and
   cross-contractor identity is a Materiabill concept. Needs product sign-off.
   (Named, not lettered: the BRD's "Option A/B" letters are swapped relative to the
   web spec — all three docs agree on native for v1.)
2. **Measurement units source.** Consume `inframodern.measurement-units` vs a local
   enum. **Recommendation:** consume (avoid duplicate UOM ownership) once BOM ships.
3. **Tax usage in v1.** Confirm whether v1 issues VAT invoices / ZATCA. If yes,
   wire `tax_refs`; if no, defer the consumer (the registry entry can still be
   declared up front).

## Reference Projects (sibling repos)

This project lives alongside its ecosystem as **separate sibling repositories**,
not inside this repo. They sit one directory **up** from the current project root,
so you must go up a level (`../`) to reach them:

```
<parent dir>/                    <- one level up from here
├── <current project>/          <- THIS repo (your working directory / project root)
├── elwaste/                     <- ../elwaste
├── inframodernbackend/          <- ../inframodernbackend
├── inframodernadminfrontend/    <- ../inframodernadminfrontend
└── inframodernfrontend/         <- ../inframodernfrontend
```

So from the current project root, `../elwaste` resolves to the elwaste repo (e.g.
`cd ../elwaste`, or just pass `../elwaste/...` to read/search tools — no need to
`cd` if the tool takes a path). Paths are environment-relative, not fixed. Check
these repos out when you need ground truth instead of guessing:

| Path                          | What it is                                | Look here for                                                                                                                                                               |
| ----------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../elwaste`                  | The modern NestJS satellite app we mirror | Reference implementation: OAuth `SessionModule`, `apps/worker` RabbitMQ consumers, `*_refs` schema, pull-sync, `packages/db` layout.                                        |
| `../inframodernbackend`       | Inframodern (Fastify + Prisma)            | The producer: `prisma/schema.prisma` (master data), `resources.json` (consume/publish registry), RabbitMQ publishing, `routes/oauth/*`, `routes/internal-dashboard/sync/*`. |
| `../inframodernadminfrontend` | Inframodern admin panel                   | The admin-triggered initial-sync UI (Applications → Sync) and install/subscription flows.                                                                                   |
| `../inframodernfrontend`      | Inframodern user-facing app               | OAuth login/consent screens (`/authenticate`).                                                                                                                              |

When verifying a routing key, queue name, payload shape, or endpoint, prefer
reading these repos over relying on this summary — code is the source of truth.

## Rules (autonomous-agent contract)

- Users authenticate **only** through Inframodern; no local passwords.
- Inframodern IDs are the keys for all synced rows; never generate local IDs for
  them; projections are read-only.
- Consume only the declared subset. Adding a resource = update `resources.json`
  (Inframodern side) + add queue binding + projection table + idempotent handler.
- Access requires **app installed + active subscription + workspace membership**,
  enforced on every request.
- All money carries an explicit ISO currency; cross-currency math goes through
  `exchange_rate_refs` + decimal.js.
