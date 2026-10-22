---
name: cicd
description: Manage GitHub Actions workflows, Docker builds, and deployment pipelines for this project. Use when changing CI/CD, updating workflows, fixing build failures, optimising Docker images, or changing deployment strategy. Triggers on: "update CI", "fix pipeline", "deploy", "docker", "workflow", "actions".
when_to_use: Any change to .github/workflows/, Dockerfile, docker-entrypoint.sh, or docker-compose.yml.
allowed-tools: Read Bash(find *) Bash(git *)
---

# CI/CD Skill — RentFlow

## Architecture

One Next.js app, one image.

| Item | Value |
|---|---|
| Image | `ghcr.io/jenteverbruggen-boop/rentflow2.0` (workflow uses `ghcr.io/${{ github.repository }}`) |
| Tags on a semver release | `:latest` + `:<version>` + `:sha-<sha>` |
| Tags on other `main` pushes | `:sha-<sha>` only |
| Node | **24** everywhere (CI, release, `node:24-alpine` in the Dockerfile). Keep them in sync |
| Port / user | `3000`, runs as the built-in `node` user |
| Startup | `docker-entrypoint.sh`: `prisma migrate deploy`; if that fails, resolve `0001_init` as applied (DBs from before migration history) and retry; then `node server.js` |
| Registry auth | built-in `GITHUB_TOKEN` |
| Production | the PO's own server/VPS pulls `:latest` via `docker-compose.yml` |

## Workflows

### `ci.yml`: every push, every branch

```
checkout → node 24 (npm cache) → npm ci
→ prisma generate (Postgres)  → tsc --noEmit        # Decimal-drift guard
→ prisma generate (SQLite)    → npm test            # integration tests use SQLite
→ prisma generate (Postgres)  → npm run build
```

The order matters. `tsc` runs against the **Postgres** client because that's
the only place CI sees `Decimal` money types (see the money rule in
CLAUDE.md). Don't move `tsc` after the SQLite generate, and don't drop it.
Tests and the build get placeholder `DATABASE_URL` / `JWT_SECRET`, because
`src/lib/env.ts` validates both when a module is imported.

### `release.yml`: `workflow_run` after CI succeeds on `main`

1. **`semver`**: `cycjimmy/semantic-release-action@v6` with `.releaserc.json`
   (commit-analyzer, release-notes, github). Needs `fetch-depth: 0`.
   `feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major, anything else →
   no release.
2. **`docker`**: `docker/build-push-action@v7` with the `type=gha` cache
   (`mode=max`). It always pushes `:sha-<sha>`, and also pushes `:latest` and
   `:<version>` when a release was published. `DOCKER_BUILD_RECORD_RETENTION_DAYS: 7`
   keeps the build-record artifacts from filling the Actions quota.
   **Rollback:** if the push fails after a release was published, the GitHub
   release and its tag are deleted, so a version never exists without an image.

## Dockerfile: 4 stages, in this order

| Stage | Does |
|---|---|
| `deps` | `npm ci` (all deps; the builder needs the devDeps) |
| `builder` | `prisma generate` + `npm run build` with placeholder `DATABASE_URL` / `JWT_SECRET` (`env.ts` validates at import) |
| `prisma-cli` | installs **only** `prisma@<version from package.json>` in an empty dir, for `migrate deploy` at startup |
| `runner` | `.next/standalone` + `static` + `public` + `prisma/` + `prisma.config.ts` + the prisma-cli `node_modules` merged in + the entrypoint |

Things that matter:

- `next.config.ts` needs `output: "standalone"` and `serverExternalPackages`
  must list `@prisma/client`, `prisma`, `@prisma/adapter-pg`, `pg`,
  `@prisma/adapter-libsql` and `@libsql/client`.
- Never copy the builder's full `node_modules` into the runner. That's what
  made the image ~1.5 GB. If you need a runtime-only tool, give it its own
  isolated stage, the way `prisma-cli` does it.
- The image is published for **amd64 only**. `docker compose run app` fails on
  Apple Silicon. A local `docker build .` is fine.

## docker-compose.yml

`db` (postgres:15, `pg_isready` healthcheck, `pgdata` volume) and `app` (GHCR
`:latest`, `3000:3000`, `depends_on: db: service_healthy`, healthcheck
`wget /login`, because that's the only route that answers without
authentication). Both read `env_file: .env`. Never hardcode secrets.

## Rules

- Secrets only via `${{ secrets.* }}`. Never echo them.
- Workflows never push to `main`.
- `actions/setup-node` always has `cache: "npm"`. `build-push-action` always
  uses the GHA layer cache.
- Any `next build` needs `DATABASE_URL` and `JWT_SECRET` set (placeholders are
  fine).
- When you bump an action major, check its changelog for changed inputs or
  outputs (semantic-release-action's outputs feed the docker job).
- Commits on `main` follow conventional commits, otherwise semver won't release.

## Checklist

- [ ] CI step order still: Postgres-generate → tsc → SQLite-generate → test → Postgres-generate → build
- [ ] `docker build .` succeeds and the image starts (entrypoint runs `migrate deploy`)
- [ ] Node version identical in `ci.yml`, `release.yml` and the `Dockerfile`
- [ ] Every `build-push-action` has `cache-from`/`cache-to`
- [ ] No secrets committed or logged; triggers (`on`, `branches`) correct
- [ ] New migration? It was authored and validated per CLAUDE.md "Authoring Postgres migrations"
