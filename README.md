# RentFlow 2.0

A rental-planning tool for managing **projects**, **people**, **materials**, and **bookings**. RentFlow prevents double-booking of people and materials across overlapping project date ranges.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development (SQLite — no Docker needed)](#local-development-sqlite--no-docker-needed)
- [Docker Compose (Production)](#docker-compose-production)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [CI/CD](#cicd)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI | shadcn/ui, Tailwind CSS v4, Radix UI primitives |
| Data fetching | TanStack Query v5 |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 (prod) / SQLite (local dev) |
| Auth | JWT via httpOnly cookie (`jose` + `jsonwebtoken`), bcryptjs |
| Containerisation | Docker (multi-stage standalone build), Docker Compose |
| CI/CD | GitHub Actions → Docker Hub |

---

## Project Structure

```
rentflow2.0/
├── prisma/
│   ├── schema.prisma          # Production schema (PostgreSQL)
│   └── schema.dev.prisma      # Dev schema (SQLite)
├── src/
│   ├── app/
│   │   ├── (auth)/login/      # Public login/register page
│   │   ├── (app)/             # Protected route group (sidebar layout)
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── projects/      # Projects list + [id] detail
│   │   │   ├── people/
│   │   │   ├── materials/
│   │   │   └── planning/
│   │   └── api/               # Next.js Route Handlers (replaces Express)
│   │       ├── auth/          # login, register, logout
│   │       ├── projects/
│   │       ├── people/
│   │       ├── materials/
│   │       └── bookings/
│   ├── middleware.ts           # Edge JWT guard (redirects to /login)
│   ├── components/
│   │   ├── ui/                # shadcn/ui components (auto-generated)
│   │   ├── sidebar.tsx
│   │   ├── project-form.tsx
│   │   ├── person-form.tsx
│   │   └── material-form.tsx
│   ├── lib/
│   │   ├── prisma.ts          # Singleton PrismaClient
│   │   ├── auth.ts            # signToken / verifyToken
│   │   ├── api-auth.ts        # requireAuth() + response helpers
│   │   └── utils.ts           # cn(), statusVariant()
│   ├── providers/
│   │   └── query-provider.tsx # TanStack QueryClientProvider
│   └── types/index.ts         # Shared domain types
├── .env.example               # PostgreSQL env template
├── .env.local.example         # SQLite local dev env template
├── docker-compose.yml         # 2 services: db + app
├── Dockerfile                 # Multi-stage standalone Next.js build
└── package.json
```

---

## Local Development (SQLite — no Docker needed)

The fastest way to run RentFlow locally. No Postgres, no Docker required.

### Prerequisites

- Node.js 20+

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file (uses SQLite)
cp .env.local.example .env.local

# 3. Create and migrate the SQLite dev database (first time only)
npm run db:dev:migrate

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

> Next.js automatically reads `.env.local` and it takes precedence over `.env`, so the SQLite URL is used without touching production config.

### Useful dev commands

| Command | Description |
|---|---|
| `npm run db:dev:migrate` | Apply pending migrations to SQLite dev DB |
| `npm run db:dev:reset` | Wipe and re-create the SQLite dev DB |
| `npm run db:dev:studio` | Open Prisma Studio against the local SQLite DB |
| `npm run db:dev:generate` | Regenerate the Prisma client from the dev schema |

---

## Docker Compose (Production)

Uses PostgreSQL. The app image is pulled from Docker Hub; the container runs `prisma migrate deploy` on startup.

```bash
# 1. Copy and configure env
cp .env.example .env
# Edit DATABASE_URL, POSTGRES_PASSWORD, JWT_SECRET

# 2. Start
docker compose up -d

# 3. Open
open http://localhost:3000
```

To build the image locally instead of pulling it:

```bash
docker compose build
docker compose up -d
```

---

## Environment Variables

### Production (`.env`)

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL username | `rentflow` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `change_me` |
| `POSTGRES_DB` | Database name | `rentflow` |
| `DATABASE_URL` | Prisma connection string | `postgresql://rentflow:change_me@db:5432/rentflow` |
| `JWT_SECRET` | Secret for signing JWT tokens — **must be long and random** | `a_very_long_random_secret` |

### Local dev (`.env.local`)

| Variable | Description | Value |
|---|---|---|
| `DATABASE_URL` | SQLite file path | `file:./prisma/dev.db` |
| `JWT_SECRET` | Local dev secret | any string |

> **Never** commit `.env` or `.env.local`. Both are listed in `.gitignore`.

---

## API Overview

All endpoints except `/api/auth/*` require authentication via an httpOnly cookie (`rentflow_token`) set on login.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login — sets httpOnly cookie |
| `POST` | `/api/auth/logout` | Logout — clears cookie |
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/:id` | Get project with people & materials |
| `PUT` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project (cascades) |
| `GET` | `/api/people` | List all people |
| `POST` | `/api/people` | Add a person |
| `PUT` | `/api/people/:id` | Update a person |
| `DELETE` | `/api/people/:id` | Delete a person |
| `GET` | `/api/materials` | List all materials |
| `POST` | `/api/materials` | Add a material |
| `PUT` | `/api/materials/:id` | Update a material |
| `DELETE` | `/api/materials/:id` | Delete a material |
| `POST` | `/api/bookings/person` | Book a person on a project (conflict check) |
| `DELETE` | `/api/bookings/person/:id` | Remove a person booking |
| `POST` | `/api/bookings/material` | Book material on a project (stock check) |
| `DELETE` | `/api/bookings/material/:id` | Remove a material booking |

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push to any branch | `npm ci` → `prisma generate` → `tsc --noEmit` → `next build` |
| `builds.yml` | CI passes on `main` | Builds & pushes `thewizard2026/rentflow:<sha>` to Docker Hub |
| `release.yml` | CI passes on `main` / manual | Builds & pushes `thewizard2026/rentflow:latest` + `:<sha>` |
