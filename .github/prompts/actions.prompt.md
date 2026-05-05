# GitHub Actions skill

When generating or reviewing GitHub Actions workflows for RentFlow 2.0, follow these rules:

## Context paths
- The repository directory names are `./Backend` and `./Frontend`.

## Action versions
- `actions/checkout` → `@v4`
- `actions/setup-node` → `@v4`
- `docker/login-action` → `@v3`
- `docker/setup-buildx-action` → `@v3`
- `docker/build-push-action` → `@v6`

## CI — compile checks (every push, all branches)
Both services must be checked on every push via `ci.yml`:

- **Frontend**: `npm install` + `npm run build` (Vite compile check)
- **Backend**: `npm install` + `npx prisma generate` (validates Prisma schema) + `node --check` on all `src/**/*.js` files (syntax check)

Each service runs as its own job so failures are reported independently.

## CD — Docker builds only after CI passes
`builds.yml` and `release.yml` must **not** run on a plain `push` trigger.
They must use `workflow_run` gated on the CI workflow succeeding:

```yaml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [master]

jobs:
  build:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
```

`release.yml` also supports `workflow_dispatch` for manual releases; in that case skip the conclusion check:

```yaml
if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
```

## Docker builds
- Always add a `docker/setup-buildx-action` step before any build step.
- Use GitHub Actions cache for Docker layer caching on every build step:
  ```yaml
  cache-from: type=gha
  cache-to: type=gha,mode=max
  ```

## Security
- Store Docker Hub credentials in repository secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`).
- Never hardcode credentials or tokens in workflow files.

## Tags
- Always push both `:latest` and `:<sha>` (or `:<tag>`) to enable rollbacks.
