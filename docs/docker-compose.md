# Running RentFlow 2.0 with Docker Compose

This guide walks you through starting the full RentFlow stack — **PostgreSQL**, **Backend API**, and **Frontend** — with a single `docker compose up` command.

The backend and frontend images are **built and published automatically by the CI/CD pipeline** (`.github/workflows/builds.yml`) every time a commit is merged to `master`. You do not need to build anything locally; Docker Compose simply pulls the latest images from Docker Hub.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24+ (includes Docker Compose v2)
- Git (to clone the repository)

---

## 1. Clone the repository

```bash
git clone https://github.com/jenteverbruggen-boop/rentflow2.0.git
cd rentflow2.0
```

---

## 2. Configure environment variables

Copy the example env file and set your own secrets:

```bash
cp .env.example .env
```

Open `.env` in your editor and change the values marked `change_me`:

```dotenv
# PostgreSQL credentials — used by the db service
POSTGRES_USER=rentflow
POSTGRES_PASSWORD=change_me          # ← set a strong password
POSTGRES_DB=rentflow

# Prisma / backend database URL
# Host must be 'db' (the Docker Compose service name)
DATABASE_URL=postgresql://rentflow:change_me@db:5432/rentflow

# JWT signing secret — must be long and random in production
JWT_SECRET=change_me_to_a_long_random_secret

# CORS origin — the URL the frontend is served from
FRONTEND_URL=http://localhost:3000
```

> **Security**: Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## 3. Full `docker-compose.yml` reference

The `docker-compose.yml` at the root of the repository defines three services. The `backend` and `frontend` images are the ones published to Docker Hub by the CI/CD pipeline.

```yaml
version: '3.8'

services:

  # ─── PostgreSQL 15 database ───────────────────────────────────────────────
  db:
    image: postgres:15
    restart: always
    env_file: .env                        # injects POSTGRES_USER / PASSWORD / DB
    volumes:
      - pgdata:/var/lib/postgresql/data   # data persists across restarts
    networks:
      - rentflow-net

  # ─── Node.js / Express backend ────────────────────────────────────────────
  # Image is built and pushed by .github/workflows/builds.yml on every master merge.
  backend:
    image: thewizard2026/rentflow-backend:latest
    restart: always
    env_file: .env                        # injects DATABASE_URL, JWT_SECRET, FRONTEND_URL
    depends_on:
      - db                                # waits for db container to start
    networks:
      - rentflow-net
    # The backend runs 'prisma migrate deploy && node src/index.js' on startup,
    # so the database schema is automatically applied on first boot.

  # ─── React / Nginx frontend ───────────────────────────────────────────────
  # Image is built and pushed by .github/workflows/builds.yml on every master merge.
  frontend:
    image: thewizard2026/rentflow-frontend:latest
    restart: always
    ports:
      - "3000:80"                         # browse to http://localhost:3000
    depends_on:
      - backend
    networks:
      - rentflow-net

# ─── Named volume for Postgres data ─────────────────────────────────────────
volumes:
  pgdata:

# ─── Isolated network shared by all services ─────────────────────────────────
networks:
  rentflow-net:
```

### Service overview

| Service | Docker Hub image | Internal port | Exposed port |
|---|---|---|---|
| `db` | `postgres:15` | 5432 | _(none, internal only)_ |
| `backend` | `thewizard2026/rentflow-backend:latest` | 3001 | _(none, internal only)_ |
| `frontend` | `thewizard2026/rentflow-frontend:latest` | 80 | **3000** |

---

## 4. Start all services

```bash
# Pull the latest CI/CD-built images from Docker Hub
docker compose pull

# Start all services in the background
docker compose up -d

# Follow logs while starting up
docker compose logs -f
```

Once the backend prints `RentFlow backend running on port 3001`, open:

```
http://localhost:3000
```

> **Tip**: Always run `docker compose pull` before `up` to ensure you are running the images that were built from the latest `master` commit.

---

## 5. Building images locally (development)

If you have made code changes and want to test them without pushing to Docker Hub, use Docker Compose's `build` feature:

```yaml
# docker-compose.local.yml — overlay for local builds
version: '3.8'

services:
  backend:
    build:
      context: ./Backend
    image: rentflow-backend:local

  frontend:
    build:
      context: ./Frontend
    image: rentflow-frontend:local
```

Start with the local override:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

---

## 6. Common commands

| Task | Command |
|---|---|
| Pull latest CI/CD images | `docker compose pull` |
| Start all services | `docker compose up -d` |
| Pull latest images and restart | `docker compose pull && docker compose up -d` |
| Stop all services | `docker compose down` |
| Stop and **delete volumes** (wipe DB) | `docker compose down -v` |
| View live logs | `docker compose logs -f` |
| View logs for one service | `docker compose logs -f backend` |
| Restart a single service | `docker compose restart backend` |
| Open a psql shell | `docker compose exec db psql -U rentflow -d rentflow` |
| Run Prisma migrations manually | `docker compose exec backend npx prisma migrate deploy` |

---

## 7. Troubleshooting

### Backend crashes immediately on first start

The `depends_on` directive only waits for the `db` *container* to start, not for PostgreSQL to be fully ready. If the backend exits with a connection error, restart it:

```bash
docker compose restart backend
```

For a more robust setup, add a health check to the `db` service and use `condition: service_healthy` in `depends_on`:

```yaml
db:
  image: postgres:15
  restart: always
  env_file: .env
  volumes:
    - pgdata:/var/lib/postgresql/data
  networks:
    - rentflow-net
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
    interval: 10s
    timeout: 5s
    retries: 5

backend:
  image: thewizard2026/rentflow-backend:latest
  restart: always
  env_file: .env
  depends_on:
    db:
      condition: service_healthy   # waits until Postgres accepts connections
  networks:
    - rentflow-net
```

### Port 3000 is already in use

Change the host port mapping in `docker-compose.yml`:

```yaml
frontend:
  ports:
    - "8080:80"   # use port 8080 instead
```

Then update `FRONTEND_URL` in `.env` to match:

```dotenv
FRONTEND_URL=http://localhost:8080
```

### Inspecting the database

```bash
# Interactive psql prompt
docker compose exec db psql -U rentflow -d rentflow

# List tables
\dt

# Exit
\q
```

