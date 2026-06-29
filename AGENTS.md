# Materiabill Repo Guide

## Scope

Bootstrap workspace only. Keep changes limited to shell infrastructure, local DX, docs, and smoke coverage unless the user explicitly expands scope.

## Architecture Map

```text
apps/
  api/    NestJS bootstrap API shell
  admin/  Vite + React admin shell
  worker/ NestJS bootstrap worker shell

packages/
  config/       runtime env parsing + logger config
  contracts/    shared bootstrap DTOs
  db/           bootstrap DB health helpers
  permissions/  bootstrap permission constants
```

## Commands

```bash
make setup     # copy .env.example to .env if needed, then pnpm install
make infra     # start PostgreSQL and RabbitMQ only
make dev       # run the full turbo dev graph
make web       # run the admin Vite shell only
make check     # lint, typecheck, test, knip, audit, build
make validate  # format, then run the full validation gate
```

Targeted commands:

```bash
corepack pnpm dev:api
corepack pnpm dev:worker
corepack pnpm dev:admin
corepack pnpm --filter @materiabill/admin test
```

## Validation

- Default repo gate: `corepack pnpm validate`
- Task 3 expectation: run `corepack pnpm format` before `corepack pnpm validate`
- Admin smoke test lives in `apps/admin/src/App.test.tsx`
- API smoke coverage lives in `apps/api/test/api.e2e-spec.ts`

## Tests

- `apps/admin`: Vitest + Testing Library in jsdom for shell rendering
- `apps/api`: Vitest e2e shell checks for `/health`, `/bootstrap`, `/docs`, `/docs-json`
- `apps/worker`: Vitest bootstrap worker smoke

## Environment And Services

- Copy `.env.example` to `.env`; all defaults are fake and safe for local bootstrap.
- `docker-compose.yml` exposes localhost-only host ports and no `container_name` values.
- Default local ports: API `3000`, admin `4173`, Postgres `55432`, RabbitMQ AMQP `55672`, RabbitMQ UI `55673`.
- `.wtcrc.json` derives the worktree-safe `VITE_API_BASE_URL` from assigned ports; DB and queue URLs are reserved for the later tasks that wire real clients.
- Bootstrap shell only: do not add auth flows, product screens, queue consumers, or business tables here.

## Smoke Endpoints

- API health: `http://127.0.0.1:3000/health`
- API bootstrap metadata: `http://127.0.0.1:3000/bootstrap`
- Swagger UI: `http://127.0.0.1:3000/docs`
- OpenAPI JSON: `http://127.0.0.1:3000/docs-json`
- Admin shell: `http://127.0.0.1:4173`
- RabbitMQ UI: `http://127.0.0.1:55673`

## Banned Behaviors

- Do not commit, stage, or push unless the user explicitly asks.
- Do not touch `.archon`.
- Do not revert other people's working tree changes.
- Do not add business workflows, auth behavior, queue processing, or product tables as part of bootstrap tasks.
- Do not add extra infra beyond PostgreSQL and RabbitMQ for local bootstrap.
