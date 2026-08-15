# Docker skill

When generating or reviewing the Dockerfile and docker-compose.yml for RentFlow 2.0, follow these rules. This is a **single Next.js app image** (no separate backend/frontend/nginx split) built with a multi-stage Dockerfile and run with a two-service `docker-compose.yml` (`app` + `db`).

## Base image
- All stages: `node:22-alpine` (deps → builder → runner). Keep every stage pinned to the same major version.

## Dockerfile best practices
- Copy `package*.json` first and run `npm ci` before copying source code to maximise layer caching.
- Generate the Prisma client (`npx prisma generate`) and run the build in the `builder` stage.
- The `runner` stage copies the Next.js standalone output, static assets, `public/`, and the full `prisma/` directory (including `prisma.config.ts` — Prisma 7's config loader needs it) plus the full `builder` `node_modules` (the standalone traced set is a subset, so overwriting is safe).
- Startup command is `docker-entrypoint.sh`, which runs `prisma migrate deploy` (handling both fresh databases and pre-migration-history databases via a baseline step) then `node server.js`.

## docker-compose
- Two services: `db` (`postgres:15`) and `app` (the image built from the Dockerfile above).
- Both use `restart: always` and load config via `env_file: .env` — never hardcode values.
- The `app` image is published to **GHCR**, not Docker Hub: `ghcr.io/jenteverbruggen-boop/rentflow2.0:latest`, built and pushed by `.github/workflows/release.yml` after `ci.yml` passes on `main`.
- To build locally instead of pulling: `docker compose build && docker compose up -d`.
