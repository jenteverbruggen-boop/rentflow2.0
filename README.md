# RentFlow 2.0

A rental-planning tool for managing **projects**, **people**, **materials**, and **bookings**. RentFlow prevents double-booking of people and materials across overlapping project date ranges.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start — Docker Compose](#quick-start--docker-compose)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [API Overview](#api-overview)
- [CI/CD](#cicd)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, Express 4, Prisma 5, PostgreSQL 15 |
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios |
| Auth | JWT (`jsonwebtoken`), bcryptjs |
| Containerisation | Docker (multi-stage builds), Docker Compose |
| CI/CD | GitHub Actions → Docker Hub |

---

## Project Structure

```
rentflow2.0/
├── .github/
│   ├── workflows/        # GitHub Actions (CI, build, release)
│   └── prompts/          # Copilot prompt files
├── Backend/              # Node.js / Express REST API
│   ├── Prisma/           # Prisma schema & migrations
│   └── src/
│       ├── lib/          # Shared Prisma singleton
│       ├── middleware/   # JWT auth middleware
│       └── routes/       # Express route handlers
├── Frontend/             # React + Vite + Tailwind SPA
│   └── src/
│       ├── api/          # Axios client with auth interceptor
│       ├── components/   # Reusable UI components
│       ├── context/      # AuthContext (JWT)
│       └── pages/        # Route-level page components
├── docker-compose.yml    # Production compose (uses Docker Hub images)
└── .env                  # Environment variables (never commit secrets)
```

---

## Quick Start — Docker Compose

The fastest way to run RentFlow locally is with Docker Compose.  
See **[docs/docker-compose.md](docs/docker-compose.md)** for a full annotated example including PostgreSQL, all environment variables, and common commands.

### TL;DR

```bash
# 1. Copy the example env file and fill in your secrets
cp .env.example .env

# 2. Pull images and start all services (db, backend, frontend)
docker compose up -d

# 3. Open the app
open http://localhost:3000
```

> The backend automatically runs `prisma migrate deploy` on startup, so the database schema is applied on first boot.

---

## Environment Variables

Copy `.env.example` to `.env` and set each value before starting.

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL username | `rentflow` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `change_me` |
| `POSTGRES_DB` | Database name | `rentflow` |
| `DATABASE_URL` | Prisma connection string | `postgresql://rentflow:change_me@db:5432/rentflow` |
| `JWT_SECRET` | Secret used to sign JWT tokens — **must be long and random** | `a_very_long_random_secret` |
| `FRONTEND_URL` | Allowed CORS origin for the backend | `http://localhost:3000` |

> **Never** commit your `.env` file. It is listed in `.gitignore`.

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)

### Backend

```bash
cd Backend
npm install

# Start a local Postgres instance (or use Docker):
docker run -d --name rentflow-db \
  -e POSTGRES_USER=rentflow \
  -e POSTGRES_PASSWORD=rentflow_secret \
  -e POSTGRES_DB=rentflow \
  -p 5432:5432 postgres:15

# Copy and configure environment variables
cp ../.env.example .env  # adjust DATABASE_URL to point to localhost

# Apply migrations and generate Prisma client
npx prisma migrate deploy
npx prisma generate

# Start the dev server (auto-restarts on change)
npm run dev
# → API listening on http://localhost:3001
```

### Frontend

```bash
cd Frontend
npm install

# Start the Vite dev server (proxies /api to localhost:3001)
npm run dev
# → App running on http://localhost:5173
```

---

## API Overview

All endpoints (except `/api/auth/*`) require a `Bearer <token>` Authorization header.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive a JWT |
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/:id` | Get project details |
| `PUT` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project |
| `GET` | `/api/people` | List all people |
| `POST` | `/api/people` | Add a person |
| `GET` | `/api/materials` | List all materials |
| `POST` | `/api/materials` | Add a material |
| `GET` | `/api/bookings` | List all bookings |
| `POST` | `/api/bookings` | Create a booking (checks for conflicts) |

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push to any branch | Installs frontend deps and runs `npm run build` to verify the code compiles |
| `builds.yml` | Push to `master` | Builds & pushes Docker images to Docker Hub |
| `release.yml` | Push to `master` / manual | Builds, tags with `:latest` + `:<sha>`, pushes to Docker Hub |
