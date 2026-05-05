# Docker skill

When generating or reviewing Dockerfiles and docker-compose for RentFlow 2.0, follow these rules:

## Base images
- Backend: `node:20-alpine` (already pinned — keep it).
- Frontend build stage: `node:20-alpine`.
- Frontend runtime stage: use a pinned nginx version, e.g. `nginx:1.27-alpine` — never `nginx:alpine` (unpinned).

## Dockerfile best practices
- Add a `.dockerignore` in each service directory excluding at minimum: `node_modules`, `.git`, `dist`, `*.log`.
- Copy `package*.json` first and run `npm install` before copying source code to maximise layer caching.
- Every final image must have a `HEALTHCHECK` instruction.
- Backend example:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3001/health || exit 1
  ```
- Frontend nginx example:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost/ || exit 1
  ```

## nginx configuration
- Config file must be named `nginx.conf` (not `nginx.config`).
- `proxy_pass` directives must end with a semicolon and use a plain URL (no markdown links):
  ```nginx
  proxy_pass http://backend:3001;
  ```

## docker-compose
- Always specify `restart: always` for production services.
- Load secrets/config via `env_file: .env` — never hardcode values.
- Connect all services on a shared named network.
- The `docker-compose.yml` must use the Docker Hub images built by the CI/CD pipeline:
  - Backend: `thewizard2026/rentflow-backend:latest`
  - Frontend: `thewizard2026/rentflow-frontend:latest`
  Never use a `build:` key in the production `docker-compose.yml`; local builds belong in a separate `docker-compose.local.yml` overlay.
- Document `docker compose pull` as the first step before `docker compose up -d` so users always run the latest CI/CD-published image.
