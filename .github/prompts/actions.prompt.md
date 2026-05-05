# GitHub Actions skill

When generating or reviewing GitHub Actions workflows for RentFlow 2.0, follow these rules:

## Context paths
- The repository directory names are `./Backend` and `./Frontend`.

## Action versions
- `actions/checkout` → `@v4`
- `docker/login-action` → `@v3`
- `docker/setup-buildx-action` → `@v3`
- `docker/build-push-action` → `@v6`

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

## Workflow triggers
- CI builds: `push` to `master`.
- Release workflows: `push` to `master` and `workflow_dispatch` for manual runs.

## Tags
- Always push both `:latest` and `:<sha>` (or `:<tag>`) to enable rollbacks.
