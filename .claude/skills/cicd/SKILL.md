---
name: cicd
description: Manage GitHub Actions workflows, Docker builds, and deployment pipelines for this project. Use when changing CI/CD, updating workflows, fixing build failures, optimising Docker images, or changing deployment strategy. Triggers on: "update CI", "fix pipeline", "deploy", "docker", "workflow", "actions".
when_to_use: Any change to .github/workflows/, Dockerfile, or docker-compose.yml.
allowed-tools: Read Bash(find *) Bash(git *)
---

# CI/CD Skill — RentFlow

## Architecture

**Single app, single image.** RentFlow is one Next.js 16 app. There is no separate frontend/backend image.

| Artifact | Value |
|---|---|
| Docker Hub image | `thewizard2026/rentflow` |
| Tags on release | `:latest` + `:<sha>` |
| Tag on build | `:<sha>` only |
| Container port | `3000` |
| Startup command | `prisma migrate deploy && node server.js` |

## Workflows (`/.github/workflows/`)

### `ci.yml` — runs on every push to any branch

```
checkout → node 20 (with npm cache) → npm ci → prisma generate → tsc --noEmit → next build
```

- Provides placeholder `DATABASE_URL` and `JWT_SECRET` env vars (Next.js needs them to satisfy Prisma at build time)
- **Gate**: `builds.yml` and `release.yml` only run when this passes on `main`

### `builds.yml` — runs when CI passes on `main`

```
checkout → buildx → docker login → build+push :<sha>
```

- Pushes a single `thewizard2026/rentflow:<sha>` image
- Uses `cache-from: type=gha` + `cache-to: type=gha,mode=max` for layer caching

### `release.yml` — runs when CI passes on `main`, or manually via `workflow_dispatch`

```
checkout → buildx → docker login → build+push :latest + :<sha>
```

- Same as builds but tags `:latest` as well
- `workflow_dispatch` allows manual release promotion without a new commit

## Dockerfile — multi-stage standalone

The Dockerfile has three stages. Keep them exactly in this order:

```dockerfile
# Stage 1: deps — install only production node_modules
FROM node:20-alpine AS deps

# Stage 2: builder — generate Prisma client + next build
FROM node:20-alpine AS builder

# Stage 3: runner — minimal image with .next/standalone output
FROM node:20-alpine AS runner
```

Critical details:
- `next.config.ts` must have `output: "standalone"` — otherwise `.next/standalone` is not generated
- `serverExternalPackages: ["@prisma/client", "prisma"]` must be in `next.config.ts` — Prisma native binaries must not be bundled by webpack
- The runner stage must copy `node_modules/.prisma` and `node_modules/@prisma` from the builder — the standalone output does not include them
- `prisma/` must be copied to the runner so `prisma migrate deploy` can run at startup

## Docker Compose (`docker-compose.yml`)

Local dev compose has **2 services**:

```yaml
services:
  db:    # postgres:15, env_file: .env
  app:   # thewizard2026/rentflow:latest, ports 3000:3000
```

- No separate backend or frontend service
- `app` depends on `db`
- Both use `env_file: .env` — secrets are never hardcoded in the compose file

## Local dev — no Docker

For local dev, SQLite is used (no Docker needed):
- `.env.local` sets `DATABASE_URL=file:./prisma/dev.db`
- `npm run db:dev:migrate` creates/migrates the SQLite DB
- `npm run dev` starts the Next.js dev server (Turbopack)

## Rules

- **Never** hardcode secrets in workflow files — use `${{ secrets.VARIABLE }}`
- **Never** push directly to `main` from a workflow — CI builds images, humans merge PRs
- **Always** use `cache: "npm"` in `actions/setup-node@v4` to cache the npm install layer
- **Always** use `docker/build-push-action@v6` with GHA layer cache (`type=gha`)
- **Never** run `npm run build` without setting `DATABASE_URL` and `JWT_SECRET` env vars — Prisma and auth code reference them at build time (even if not used at static generation time)
- Keep workflows under 50 lines each — extract complexity into Makefile targets or npm scripts if needed

## Checklist for any CI/CD change

- [ ] `ci.yml` still passes with `DATABASE_URL` + `JWT_SECRET` placeholder vars
- [ ] Docker image builds with `docker build .` locally
- [ ] `docker compose up` starts the app on port 3000
- [ ] No secrets are committed or echoed in logs
- [ ] Workflow trigger conditions (`branches`, `on`) are correct
- [ ] Layer cache directives are present on all `build-push-action` steps
