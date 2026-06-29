# Project Bootstrap Checklist

Bootstrap assumes `bootstrap-manual-prerequisites.md` has already completed and
the planning folder is committed on `main`.

Bootstrap may create empty apps, shared libs, health checks, docs endpoints, and local infrastructure, but it must not implement business behavior.

## Phase 1 — Generic Foundation

These steps do not need business context.

### Step 1 — Runtime & Language Config

> Everything downstream inherits these settings. Changing tsconfig paths later is a codebase-wide rewrite.

- [ ] `.nvmrc` or `.node-version` (pin exact version)
- [ ] `package.json` with `engines` field (enforce Node + package manager version)
- [ ] `pnpm-workspace.yaml` (if monorepo)
- [ ] `tsconfig.json` (`strict: true` — enables 8 flags including `strictNullChecks`, `strictFunctionTypes`, `useUnknownInCatchVariables`; critical for agentic development where 94% of LLM-generated compilation errors are type-check failures, path aliases)
  - **Beyond strict** — 5 additional flags with high value and low friction: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`
  - **Skip** `noPropertyAccessFromIndexSignature` — creates `process.env['X']` bracket-notation noise across the codebase with zero bug-catching benefit. `noUncheckedIndexedAccess` already covers the safety case.
- [ ] `tsconfig.build.json` (exclude tests, dev files)

---

### Step 2 — Workspace Tooling

- [ ] Initialize package/workspace tooling for the chosen project shape. For monorepos, start with pnpm workspaces; add Turborepo or Nx only when app/lib graph, caching, or affected builds are needed.
  - Small monorepo (< ~10 packages, one team): pnpm workspaces only
  - Product monorepo (multiple apps + shared packages, one team): pnpm workspaces + Turborepo
  - Org/platform scale (50+ packages, multiple teams, generators, governance): Nx
  - Stop at workspace tooling and root configuration here. Do not generate framework apps, business-specific services, routes, schemas, queues, workers, or feature libraries in the generic foundation phase.

---

### Step 3 — Code Quality Gates

> Every file written from this point forward is auto-formatted and linted. Zero formatting noise in PRs.

- [ ] ESLint (flat config, TS-aware)
  - Use `strictTypeChecked` + `stylisticTypeChecked` (not just `recommendedTypeChecked`) — the 80/20 for TypeScript linting.
  - `no-explicit-any: error` — blocks `any` from CI.
  - `no-unsafe-type-assertion: warn` (not error) — surfaces unsafe casts in editor + PR review without forcing `eslint-disable` comments or `as unknown as` double-casts at framework boundaries. At error level it generates ~80% noise for ~10% extra safety.
  - Add `**/*.config.ts` to ignores — config files are execution roots, not library code.
  - **Test file overrides** — relax `@typescript-eslint/no-unsafe-*` rules for every configured test suffix, such as `*.spec.ts`, `*.test.ts`, `*.integration-spec.ts`, and `*.e2e-spec.ts`. Mock objects are inherently `any`-typed; enforcing type safety on test doubles adds boilerplate with no safety gain. Configure via ESLint `files` override, not per-file disable comments.
- [ ] Prettier (`.prettierrc` + `.prettierignore`)
- [ ] Knip (dead code / unused deps detection)

---

### Step 4 — Automated CI Setup

- [ ] GitHub Actions workflow (`ci.yml`): format → lint → type-check → build
- [ ] PR validation workflow (`pr-check.yml`): conventional commit title enforcement, dependency review, merge conflict detection
- [ ] Auto-assign PR author workflow (`auto-assign-pr.yml`): assigns the PR to its author on open. If the workflow writes PR metadata, use the correct GitHub event and permissions for that write path, and do not check out or execute untrusted PR code.
- [ ] CI permissions: least-privilege (`contents: read` by default; add only the write permissions a workflow actually needs)
- [ ] Dependabot for GitHub Actions (`.github/dependabot.yml` — `github-actions` ecosystem; professional default is weekly, individual side-project choice is monthly to reduce noise). If the project should also receive package dependency PRs, add the package ecosystem explicitly with the same noise policy.

## Phase 2 — Project Shape Foundation

These steps depend on the planning folder created in Step 1. They may create app/service/lib boundaries, but still must not implement feature behavior.

### Step 5 — App/Service/Lib Skeletons From Planning

> Read the planning folder, identify the initial project boundaries, then create them. The goal is a runnable project shape, not working product behavior.

- [ ] Confirm the planning folder names the initial apps/services/libs/modules.
- [ ] Confirm the backing services needed locally: database, queue/broker, cache, object storage, etc.
- [ ] Confirm the public entrypoints: REST, GraphQL, CLI, worker, scheduler, or dashboard.
- [ ] Confirm what is intentionally out of scope for bootstrap.
- [ ] Confirm the first real feature task starts in `tasks.md`, not in this bootstrap checklist.
- [ ] Generate the initial apps/services defined by the planning folder.
- [ ] Generate shared libs/modules defined by the planning folder.
- [ ] Initialize framework-specific app tooling only for the apps/services approved by the planning folder.
- [ ] Add bootstrap entrypoints and empty module shells.
- [ ] Add health endpoint only if the selected framework/app shape needs it for local verification.
- [ ] For HTTP entrypoints, install and configure OpenAPI/Swagger.
- [ ] Expose API docs at `/docs` and OpenAPI JSON at `/docs-json`.
- [ ] Document bootstrap-level endpoints only; do not design feature DTOs or business API contracts here.
- [ ] Do not implement auth flows, job handlers, database tables, queues, product logic, or feature behavior.

---

### Step 6 — Local Development Infrastructure

- [ ] `docker-compose.yml` (database, cache, queue — whatever backing services you need)
- [ ] `.env.example` (documented, every variable explained with comments)
- [ ] Database connection module + migration setup (Drizzle, etc.)
- [ ] Keep environment defaults consistent across `.env.example`, Docker Compose defaults, app config fallbacks, migration config, tests, and CI dummy env. A clean clone should work without hidden local `.env` values.
- [ ] Backing-service clients/pools must handle idle/runtime errors, log failures, and close cleanly during shutdown.
- [ ] **Worktree isolation** — parallel branches need isolated infrastructure. Without this, worktrees share one database and collide on ports.
  - Install [`worktree-compose`](https://www.worktree-compose.com/) globally (`npm i -g worktree-compose`). Usage: `wtc list` to see worktrees + ports, `wtc start <index>` to spin up isolated infra, `wtc stop <index>` to tear down.
  - Do **not** set hardcoded `container_name` values in Compose files. Let Docker Compose namespace containers per project/worktree.
  - Parameterize **all** host ports in `docker-compose.yml` with env var defaults. No hardcoded host ports.
  - Prefer project-specific default **host** ports for common services instead of the service's standard port (e.g. `${POSTGRES_PORT:-15432}:5432`, `${REDIS_PORT:-16379}:6379`, `${GATEWAY_PORT:-18000}:80`).
  - Keep container ports standard; change only the host-side port unless the container image requires otherwise.
  - Bind local-only infrastructure ports to `127.0.0.1` unless another machine must reach them (e.g. `127.0.0.1:${POSTGRES_PORT:-15432}:5432`).
  - Make `.env.example` connection URLs match the default host ports exactly.
  - Add `.wtcrc.json` with `envOverrides` to rewrite connection strings (`DATABASE_URL`, `REDIS_URL`, etc.) using allocated ports — `wtc` offsets the port variables but can't parse URLs automatically.
  - Keep `wtc` URL overrides port-derived only. Do not hardcode usernames, passwords, tokens, or credential-bearing URLs in `.wtcrc.json`, `.env.example`, Docker Compose, app config fallbacks, migration config, tests, or CI dummy env. For simple local Mongo tasks, prefer a no-auth local URI such as `mongodb://127.0.0.1:${MONGODB_PORT}/app?directConnection=true`.
  - Treat `wtc` setup as part of the bootstrap, not an optional afterthought: commit the required support files up front (`.wtcrc.json`, compatible `docker-compose*.yml`, and any generated/synced paths your app needs).
  - Make sure Docker build contexts, Dockerfiles, and mounted paths still work from a git worktree checkout after `wtc` syncs files from the source worktree.
  - Full-stack isolation: frontend dev ports, backend dev ports, proxy targets, callback URLs, and internal service URLs must resolve per worktree too. Infra isolation alone is not enough if local app processes still collide on shared localhost ports.
  - Worktree runbook: run migrations and seeds against the worktree-local `.env`, use the worktree-local app URL for browser QA, and document how to stop stale background dev processes from previous runs.

---

### Step 7 — Observability Foundation

- [ ] Structured logging library (Pino — JSON format)
- [ ] Request correlation IDs (trace a request across logs). Normalize and validate inbound correlation headers; replace empty, malformed, or multi-value inputs instead of blindly trusting them.
- [ ] Health check endpoint (`/health`)
- [ ] Graceful shutdown handling

---

### Step 8 — Testing Foundation

> Agent note: before implementing this step, check the current official docs for Vitest, Nest testing, Supertest, and Testcontainers. Use them to create the local exemplary unit, integration, and e2e patterns.

- [ ] Vitest config for unit, integration, and e2e tests
- [ ] Supertest for HTTP API e2e tests where applicable
- [ ] Testcontainers foundation for integration tests with real backing services
- [ ] One exemplary unit test for pure service/handler logic
- [ ] One exemplary integration test against a real backing service
- [ ] One exemplary e2e test against a booted Nest app
- [ ] Coverage via `@vitest/coverage-v8` (start at 50%, increase over time)
- [ ] Project-level build targets pass for generated apps/libs, not only the root TypeScript build.
- [ ] `pnpm validate` script = format + lint + type-check + test + knip + audit + build

---

### Step 9 — Developer Experience

- [ ] `AGENTS.md` — Codex agent instructions for this repo. Check current official Codex guidance for instruction-file conventions, then inspect this repo's scripts, app/lib layout, Docker services, env files, tests, and bootstrap decisions. Include how to run dev, validation commands, test conventions, banned behaviors, architecture map, service ownership, env/service gotchas, and common workflows. Keep it concise and less than 200 lines.
- [ ] `CLAUDE.md` — create this file containing only `@AGENTS.md`. Claude Code's `@` import syntax loads the referenced file as the actual instructions content. This makes `AGENTS.md` the single source of truth: Claude Code reads it via the import, while every other coding agent (Codex, Cursor, Copilot, Gemini CLI, Windsurf) reads it directly. One file to maintain, all tools stay in sync automatically.
- [ ] Verify every command documented in `AGENTS.md` exists in the Makefile, package scripts, or the repo's chosen task runner.
- [ ] `Makefile` or task runner — expose core developer workflows, not every package script. Add memorable commands a developer actually uses, such as `make setup`, `make infra`, `make dev`, `make web`, `make check`, and `make validate`. Only include commands that are wired to real repo behavior.

---

### Step 10 — Security Baseline

- [ ] **`.gitignore` audit:** Verify `.env`, `*.pem`, `*.key`, `*.p12`, `secrets/` are excluded. Run `git status` on a clean checkout — nothing sensitive should appear.
- [ ] **Environment variable hygiene:** `.env.example` documents every variable with comments, uses obviously fake placeholders (`changeme`, `your-db-password`, empty string), and contains no real credentials. CI workflow files must use dummy values only and must not print secrets.
- [ ] **Dependency license policy:** Deny GPL-3.0 and AGPL-3.0 via `actions/dependency-review-action` in `pr-check.yml`. Keep vulnerability auditing in the full CI pipeline step, not here.
- [ ] **Pre-commit secret scanning:** Blocks secrets from entering git history.
  - Add `lefthook` to the repo (`pnpm add -Dw lefthook`) with a `pre-commit` job running `gitleaks protect --staged --redact`.
  - The hook must check that `gitleaks` is installed and fail with a clear install message when missing.
  - Wire hook installation through `package.json` so every dev gets the hook on `pnpm install`, while preserving any existing global hook policy.

---

### Step 11 — Full CI Pipeline

- [ ] Add test job to CI workflow for the test layers that exist locally (unit, integration, e2e, or the repo's single `test` script)
- [ ] Add format job to CI workflow (`pnpm format`) before lint/typecheck so save-on-format drift cannot bypass CI.
- [ ] Run integration/e2e tests with the required CI backing services for this project (for example: database, cache, queue, broker, object storage)
- [ ] Add CI caching where useful (package manager store, build-tool cache, lint cache if enabled, TypeScript incremental cache if enabled)
- [ ] Concurrency groups (cancel stale runs on same branch)
- [ ] Timeout limits per job (prevent runaway builds)
- [ ] `pnpm audit` in CI (own job — `Security Audit` — runs parallel to lint/typecheck/test)

### Step 12 — Post-Bootstrap Audit

> Agents generate files with stale dependency versions (LLM training cutoff) and hallucinated GitHub Actions SHAs. This step fixes both, then validates everything in one pass.

- [ ] `pnpm update -r --latest` (update all workspace package.json to latest versions)
- [ ] `pnpm install` (regenerate lockfile after version bumps)
- [ ] Pin GitHub Actions to SHA — **never write SHAs by hand; AI models hallucinate them.** Use [pinact](https://github.com/suzuki-shunsuke/pinact) to resolve and verify:
      validate

  ```bash
  # Install or refresh pinact to the latest release for this bootstrap run
  curl -sL https://github.com/suzuki-shunsuke/pinact/releases/latest/download/pinact_linux_amd64.tar.gz \
    | tar -xz -C ~/.local/bin

  pinact --version

  # Write workflows with version tags (@v6), then pin them to real SHAs
  GITHUB_TOKEN=$(gh auth token) pinact run

  # Verify existing SHAs match their version annotations
  GITHUB_TOKEN=$(gh auth token) pinact run -verify

  # Update all actions to latest versions + re-pin
  GITHUB_TOKEN=$(gh auth token) pinact run -update
  ```

  > `GITHUB_TOKEN` is required — without it pinact hits GitHub's unauthenticated rate limit and times out.

- [ ] `pnpm validate` (format + lint + typecheck + test + knip + audit + build — confirm nothing broke)
- [ ] Update `README.md` — flesh out the placeholder from Step 1: accurate setup steps, final project structure, environment variables, and any gotchas discovered during development.

---

### Step 13 — Local Smoke Test

> Final runtime check before opening the bootstrap PR. This proves the project can actually start, not only compile.

- [ ] Start local services using the project's documented command.
- [ ] Confirm required services are healthy or ready.
- [ ] Run migrations if migration files exist or the app requires them to boot.
- [ ] Run the full local validation command.
- [ ] Start each app/process/worker needed for the bootstrap.
- [ ] Check documented health/docs endpoints for HTTP apps.
- [ ] Exercise one minimal runtime path per entrypoint, without testing feature behavior.
- [ ] Stop local services.
- [ ] Confirm no stale containers, ports, or background processes remain.

### Step 14 — First Pull Request

- [ ] First PR — branch `chore/t000-project-bootstrap`
- [ ] PR title: `chore: bootstrap project`
- [ ] PR description: summarize bootstrap scope, list validation evidence, and note that business behavior is intentionally out of scope.
- [ ] Keep the bootstrap in one PR with clean commits:
  - `chore: configure workspace and quality gates` — runtime/package manager config, package scripts, TypeScript config, workspace metadata, linting, formatting, dead-code checks, CI basics.
  - `chore: bootstrap backend runtime` — app/lib skeletons, local infrastructure, environment contract, database/migration setup, logging, health/docs endpoints, tests, security baseline, Makefile, agent instructions, final smoke/review fixes.
