# Materiabill Tech Stack (Web Phase)

## Verdict

Materiabill is built as an **Inframodern satellite app**, mirroring the elwaste
blueprint: a **pnpm + Turborepo monorepo** running **NestJS (TypeScript) +
Drizzle ORM + PostgreSQL** on the backend, a **React + Vite** contractor admin
web app on the frontend, **RabbitMQ** for Inframodern master-data sync, and
**SSE** for realtime admin updates. Inframodern owns identity and master data;
Materiabill owns operational/financial data.

This phase ships the **contractor admin web app and its backend only**. The
client PWA, field-worker surfaces, offline sync, web-push, and any native/Expo
app are explicitly **out of scope** for now. The backend still *models* client,
subcontractor, draw, and payable entities (the admin manages them), and
client-only endpoints (e.g. draw approval) exist in the API — their UI ships in
a later phase.

## Backend / Admin Monorepo

| Area | Technology |
|------|------------|
| Runtime | Node.js |
| Language | TypeScript |
| Package manager | pnpm |
| Monorepo tooling | Turborepo |
| Backend framework | NestJS |
| Backend config | `@nestjs/config` + Zod env schema |
| Backend logging | nestjs-pino |
| Health checks | `@nestjs/terminus` |
| Database | PostgreSQL |
| Database access / ORM | Drizzle ORM (`casing: 'snake_case'`) |
| API contract | NestJS OpenAPI → openapi-typescript → openapi-fetch |
| Validation | Zod (shared client/server via `packages/contracts`) |
| Money / quantity math | integer **minor units** in DB; decimal.js for calculations |
| Realtime (admin) | SSE first; WebSocket only if a later need proves it |
| Message queue (Inframodern sync) | RabbitMQ (backend/worker only) |
| Background jobs | worker app (grace-window expiry, continuity auto-set, invite nudges, snag-override eligibility) |
| Admin frontend | React + Vite |
| Admin routing | React Router |
| Admin styling | Tailwind CSS tokens |
| Admin UI components | shadcn-style local components on Radix primitives |
| Admin icons | lucide-react |
| Admin data tables | TanStack Table |
| Admin client state | TanStack Query |
| Admin forms | React Hook Form + Zod |
| Admin i18n | i18next + react-i18next (EN/AR + RTL) |
| API testing | Jest + Supertest |
| Admin testing | Vitest + Testing Library |
| End-to-end testing | Playwright |
| File storage | DigitalOcean Spaces (S3-compatible); local adapter in development |

## External Systems

| System | Purpose |
|--------|---------|
| Inframodern OAuth | Sole auth mechanism (authorization_code + refresh_token). Tokens stay server-side; browser holds a session cookie only. |
| Inframodern RabbitMQ | Master-data sync. Consumed subset and topology are defined in `inframodern-integration.md` (users, workspaces, memberships, brands, locations, exchange rates required; measurement units, taxes recommended; customers open). |
| Inframodern subscription/install state | Gates app access (active subscription + app installed in workspace). |
| DigitalOcean Spaces | Logos, document/certificate assets, photo uploads. |
| Email / SMS provider | Invite delivery and notifications. Provider not yet selected; integrated behind a notification adapter so it can be chosen without touching call sites. |

## Rules

- The admin app talks **only** to the Materiabill backend.
- RabbitMQ consumers live in the worker app, never in the admin client.
- Inframodern remains Fastify and is **not** part of the Materiabill stack;
  Materiabill integrates with it over OAuth + RabbitMQ.
- Inframodern owns identity and master data; Materiabill owns operational and
  financial data. Never generate local IDs for synced entities — the
  Inframodern ID is the key.
- All money is stored as integer **minor units** with an explicit ISO currency
  code; calculations use decimal.js. Portfolio rollups convert via synced
  Inframodern exchange rates.
- OAuth tokens are never exposed to the browser; the session cookie is the only
  client-side credential.
- Sandbox mode uses the designated Inframodern sandbox OAuth app.
