# Materiabill

Bootstrap monorepo for the Materiabill platform. Current scope is limited to the admin shell, local PostgreSQL and RabbitMQ infrastructure, shared runtime packages, and smoke endpoints for developer setup.

## Structure

```text
apps/
  api/    NestJS bootstrap API shell
  admin/  Vite + React bootstrap admin shell
  worker/ NestJS bootstrap worker shell

packages/
  config/       runtime env parsing and logger helpers
  contracts/    shared bootstrap DTOs
  db/           database health helpers
  permissions/  bootstrap permission constants
```

## Setup

Prerequisites:

- Node.js `22.14.0`
- pnpm `10.26.2` through Corepack
- Docker for local PostgreSQL and RabbitMQ smoke

Bootstrap the workspace:

```bash
make setup
make infra
make dev
```

Run the admin shell only:

```bash
make web
```

## Environment

Copy `.env.example` to `.env`. Defaults are fake and safe for local bootstrap, and they match `docker-compose.yml`.

| Variable                   | Purpose                         | Default                 |
| -------------------------- | ------------------------------- | ----------------------- |
| `NODE_ENV`                 | runtime mode                    | `development`           |
| `API_PORT`                 | local API port                  | `3000`                  |
| `ADMIN_PORT`               | local admin shell port          | `4173`                  |
| `LOG_LEVEL`                | shared log level fallback       | `info`                  |
| `API_LOG_LEVEL`            | API log override                | `info`                  |
| `WORKER_LOG_LEVEL`         | worker log override             | `info`                  |
| `APP_VERSION`              | bootstrap version label         | `0.0.0-bootstrap`       |
| `POSTGRES_DB`              | Postgres database name          | `materiabill`           |
| `POSTGRES_USER`            | Postgres username placeholder   | `local_user`            |
| `POSTGRES_PASSWORD`        | Postgres password placeholder   | `changeme-local-only`   |
| `POSTGRES_PORT`            | host Postgres port              | `55432`                 |
| `RABBITMQ_DEFAULT_USER`    | RabbitMQ username placeholder   | `local_user`            |
| `RABBITMQ_DEFAULT_PASS`    | RabbitMQ password placeholder   | `changeme-local-only`   |
| `RABBITMQ_PORT`            | host RabbitMQ AMQP port         | `55672`                 |
| `RABBITMQ_MANAGEMENT_PORT` | host RabbitMQ UI port           | `55673`                 |
| `DATABASE_URL`             | reserved for later DB wiring    | empty                   |
| `RABBITMQ_URL`             | reserved for later queue wiring | empty                   |
| `VITE_API_BASE_URL`        | admin shell API base URL        | `http://127.0.0.1:3000` |

## Validation

Run the required Task 3 validation flow:

```bash
corepack pnpm format
corepack pnpm validate
```

Helpful entry points:

- `make check` runs the repo validation gate without rewriting files first.
- `corepack pnpm --filter @materiabill/admin test` runs the admin shell smoke test.
- `corepack pnpm dev:api`, `corepack pnpm dev:worker`, and `corepack pnpm dev:admin` run individual shells.

## Smoke Endpoints

- API health: `http://127.0.0.1:3000/health`
- API bootstrap metadata: `http://127.0.0.1:3000/bootstrap`
- Swagger UI: `http://127.0.0.1:3000/docs`
- OpenAPI JSON: `http://127.0.0.1:3000/docs-json`
- Admin shell: `http://127.0.0.1:4173`
- RabbitMQ management: `http://127.0.0.1:55673`

## Bootstrap Scope

Included:

- React/Vite admin shell with smoke links only
- PostgreSQL and RabbitMQ local infrastructure
- Worktree-safe env overrides and repo DX docs
- Smoke-oriented tests and validation wiring

Explicitly out of scope:

- auth flows
- product database tables
- queue consumers and real worker workflows
- feature screens or business behavior

## License

Proprietary. All rights reserved.
