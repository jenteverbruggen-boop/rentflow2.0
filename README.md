# RentFlow 2.0

A rental-planning tool for managing **projects**, **periods**, **people**, and **materials**. Each project contains one or more named **periods** (date ranges that may overlap); bookings live on a period. Materials are split into individually traceable **stock items** so units assigned to a project can be tracked. People and materials each have a day price; a project can override that price for any material or person to negotiate project-specific rates. Projects produce an itemised cost overview with optional per-booking discounts. The project detail page is tab-based — `Overzicht`, `Periodes` (with a Gantt-style timeline), `Personen`, `Materialen`, and `Kosten`. RentFlow rejects cross-project double-bookings and warns on same-project overlaps.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development (SQLite — no Docker needed)](#local-development-sqlite--no-docker-needed)
- [Docker Compose (Production)](#docker-compose-production)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [CI/CD](#cicd)
- [Future plan list](#future-plan-list)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI | shadcn/ui, Tailwind CSS v4, Radix UI primitives |
| Data fetching | TanStack Query v5 |
| ORM | Prisma 7 |
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
│   │   ├── (auth)/login/         # Public login/register page
│   │   ├── (app)/                # Protected route group (sidebar layout)
│   │   │   ├── page.tsx          # Dashboard
│   │   │   ├── projects/         # List + [id] tabbed detail page
│   │   │   ├── people/
│   │   │   ├── materials/
│   │   │   └── planning/
│   │   └── api/                  # Next.js Route Handlers
│   │       ├── auth/             # login, register, logout
│   │       ├── projects/         # CRUD + [id]/periods + [id]/prices/{material,person}/[xId]
│   │       ├── periods/          # [id] CRUD + [id]/materials + [id]/people
│   │       ├── people/           # CRUD + /available
│   │       ├── materials/        # CRUD + /available + [id]/stock-items
│   │       └── stock-items/      # [id] PATCH / DELETE
│   ├── proxy.ts                  # Edge JWT guard (Next.js 16 — not middleware.ts)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components (do not edit)
│   │   ├── sidebar.tsx
│   │   ├── project-form.tsx
│   │   ├── person-form.tsx
│   │   ├── material-form.tsx
│   │   ├── period-list.tsx       # Period rail on Periodes tab
│   │   ├── period-form.tsx       # Dialog with out-of-range warning
│   │   ├── period-bookings.tsx   # Assigned persons + stock items per period
│   │   ├── availability-browser.tsx  # Tabs + search + category/role filter
│   │   ├── price-drift-warning.tsx   # Amber triangle + re-snapshot popover
│   │   ├── stock-items-sheet.tsx     # Side sheet for managing units
│   │   ├── stock-item-form.tsx
│   │   ├── timeline.tsx              # Reusable Gantt-style bar component
│   │   ├── cost-line-row.tsx         # Row in the itemised cost table
│   │   ├── project-price-overrides.tsx  # Project-scoped day-price overrides
│   │   ├── project-overview-tab.tsx
│   │   ├── project-periods-tab.tsx
│   │   ├── project-persons-tab.tsx
│   │   ├── project-materials-tab.tsx
│   │   └── project-costs-tab.tsx
│   ├── lib/
│   │   ├── prisma.ts             # Singleton PrismaClient
│   │   ├── auth.ts               # signToken / verifyToken
│   │   ├── api-auth.ts           # requireAuth() + response helpers
│   │   ├── pricing.ts            # periodDays, line/period/project totals, formatEUR, effective price helpers
│   │   ├── availability.ts       # Stock item + person conflict / warning logic
│   │   ├── effective-price.ts    # Server-side resolver: project override → fallback to global
│   │   ├── project-include.ts    # Shared Prisma include for project queries
│   │   └── utils.ts              # cn(), statusVariant()
│   ├── hooks/
│   │   └── use-availability.ts   # TanStack Query wrappers for /available endpoints
│   ├── providers/
│   │   └── query-provider.tsx    # TanStack QueryClientProvider
│   └── types/index.ts            # Shared domain types
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

- Node.js 24+

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
| `npm run db:dev:seed` | Seed the SQLite dev DB with demo users, projects, periods, stock items |
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
| `GET` | `/api/projects` | List all projects (with nested periods + bookings) |
| `POST` | `/api/projects` | Create a project (auto-creates a default "Hoofdperiode") |
| `GET` | `/api/projects/:id` | Get project with periods, bookings, stock items, persons |
| `PUT` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project (cascades to periods + bookings) |
| `POST` | `/api/projects/:id/periods` | Create a period on a project |
| `PUT` | `/api/projects/:id/prices/material/:materialId` | Upsert a project-scoped day-price override for a material — body `{ dayPrice }`. Cascades: re-snapshots every existing `PeriodStockItem` of this material in this project to the new price |
| `DELETE` | `/api/projects/:id/prices/material/:materialId` | Remove the project-scoped material override. Cascades: re-snapshots every existing `PeriodStockItem` of this material in this project back to the material's global `dayPrice` |
| `PUT` | `/api/projects/:id/prices/person/:personId` | Upsert a project-scoped day-price override for a person — body `{ dayPrice }`. Cascades: re-snapshots every existing `PeriodPerson` for this person in this project to the new price |
| `DELETE` | `/api/projects/:id/prices/person/:personId` | Remove the project-scoped person override. Cascades: re-snapshots every existing `PeriodPerson` for this person in this project back to the person's global `dayPrice` |
| `PATCH` | `/api/periods/:id` | Rename / re-schedule a period |
| `DELETE` | `/api/periods/:id` | Delete a period (cascades to its bookings) |
| `POST` | `/api/periods/:id/materials` | Book `{ materialId, quantity, discountPct?, discountAmount? }` — auto-assigns units not already booked in any overlapping period (including this one), snapshots the effective day price (project override if set, otherwise the material's `dayPrice`), returns `{ assignments, warnings }`. Returns `409` if `quantity` exceeds available units. A DB unique constraint on `(periodId, stockItemId)` prevents the same unit from being assigned to the same period twice |
| `PATCH` | `/api/periods/:id/materials/:assignmentId` | Update discount or re-snapshot price (`{ resnapshotPrice: true }`) |
| `DELETE` | `/api/periods/:id/materials/:assignmentId` | Remove a stock-item booking |
| `POST` | `/api/periods/:id/people` | Book `{ personId, role?, discountPct?, discountAmount? }` — snapshots the effective day price (project override if set, otherwise the person's `dayPrice`), returns `{ assignment, warnings }`. Returns `409` if the person is already assigned to this period or is blocked by an overlapping booking on another project. A DB unique constraint on `(periodId, personId)` enforces the per-period uniqueness |
| `PATCH` | `/api/periods/:id/people/:assignmentId` | Update role, discount, or re-snapshot price |
| `DELETE` | `/api/periods/:id/people/:assignmentId` | Remove a person booking |
| `GET` | `/api/materials` | List materials (includes `totalStock` count derived from stock items) |
| `POST` | `/api/materials` | Add a material — body includes `dayPrice` and optional `initialStock` |
| `GET` | `/api/materials/:id` | Get a material with its stock items |
| `PUT` | `/api/materials/:id` | Update a material (name, category, dayPrice, notes) |
| `DELETE` | `/api/materials/:id` | Delete a material (cascades stock items + bookings) |
| `GET` | `/api/materials/available?from&to&excludePeriodId&projectId` | Per-material `{ availableCount, totalStock, availableStockItemIds }` for a date range. When `projectId` is supplied, `material.dayPrice` is the effective price for that project and `material.basePrice` + `material.hasOverride` are also returned |
| `GET` | `/api/materials/:id/stock-items` | List individual units of a material |
| `POST` | `/api/materials/:id/stock-items` | Add a unit — `unitNumber` auto-assigned, `identifier` optional |
| `PATCH` | `/api/stock-items/:id` | Edit a unit's identifier or notes |
| `DELETE` | `/api/stock-items/:id` | Delete a unit — `409` if it is currently booked |
| `GET` | `/api/people` | List all people (with `dayPrice`) |
| `POST` | `/api/people` | Add a person — body includes `dayPrice` |
| `PUT` | `/api/people/:id` | Update a person |
| `DELETE` | `/api/people/:id` | Delete a person |
| `GET` | `/api/people/available?from&to&excludePeriodId&sameProjectId&projectId` | Per-person `{ isAvailable, blockingProject?, sameProjectWarning? }`. When `projectId` is supplied, `person.dayPrice` is the effective price for that project and `person.basePrice` + `person.hasOverride` are also returned |

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push to any branch | `npm ci` → `prisma generate` → `tsc --noEmit` → `next build` |
| `release.yml` | CI passes on `main` | Semantic-release tag → Docker build → push `ghcr.io/<repo>:latest` + `:<sha>` + `:<semver>` |

---

## Future plan list

Not in scope for the current release, kept here so the direction is visible:

- **Barcode / QR scan to pick specific stock items.** Today, booking a material picks units automatically by `unitNumber`. The next step is a scan-driven flow at booking time so the operator confirms exactly which physical units are shipped to the project (and detects mis-pulls before they leave the warehouse).
- **Per-unit shipped / returned timestamps + packing-list checklist.** Each `PeriodStockItem` would carry `shippedAt` / `returnedAt` so the system can show what is currently out, what is overdue, and what is back. The UI would expose a per-period packing list with tick-boxes that operators check off as units are loaded and unloaded.
- **Edit a booking's discount after creation.** Right now a discount is set when the booking is created; changing it requires removing and re-adding the booking. A dedicated discount popover on each booking line would patch `discountPct` / `discountAmount` in place.
- **Bulk "re-snapshot stale prices" action.** The price-drift warning surfaces individual lines where `dayPriceSnapshot` no longer matches the current material/person `dayPrice`. A project-level action would re-snapshot every stale line in one call, useful when refreshing a long-running project after a price-list update.
