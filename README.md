# RentFlow 2.0

A rental-planning tool for managing **projects**, **periods**, **people**, and **materials**. Each project contains one or more named **periods** (date ranges that may overlap); bookings live on a period. Materials are split into individually traceable **stock items** so units assigned to a project can be tracked. People and materials each have a day price; a project can override that price for any material or person to negotiate project-specific rates. Projects produce an itemised cost overview with optional per-booking discounts. Materials can also be grouped into **sets** (bundles): a set owns no stock itself but has a recipe of component materials, the number of complete sets is auto-calculated from component stock (with a warning for the leftover incomplete set), and booking a set reserves its components atomically. Bookings can also carry one-time costs: a per-unit setup/teardown cost on a material (charged once, not per day) and per-person travel costs entered on a period booking (rate × number of trips/nights). The project cost overview breaks totals into Personen, Materialen, and Reiskosten. The project detail page is tab-based — `Overzicht`, `Periodes` (with a Gantt-style timeline), `Personen`, `Materialen`, and `Kosten`. RentFlow rejects cross-project double-bookings and warns on same-project overlaps.

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
| CI/CD | GitHub Actions → GHCR (`ghcr.io`) |

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
| `npm run backfill:functions` | One-off: match existing bookings' legacy `role` text against `Function.name` and populate `functionId` where it matches exactly (L2.1); logs every unmatched row instead of guessing |
| `npm run backfill:person-functions` | One-off: the same match for `Person.role` — creates the corresponding `PersonFunction` row where it matches and none already exists (L4.1); logs every unmatched row for manual mapping before `Person.role`/`PeriodPerson.role` are dropped |
| `npm run test:postgres` | Runs only `invoice-numbering.postgres.test.ts` — the invoice-numbering concurrency test, which needs a real Postgres (`docker compose up -d db`) and skips itself under the default SQLite `npm test` |

---

## Docker Compose (Production)

Uses PostgreSQL. The app image is pulled from GHCR (`ghcr.io/jenteverbruggen-boop/rentflow2.0`); the container runs `prisma migrate deploy` on startup. Production runs on the PO's own server/VPS, not a managed platform.

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

All endpoints except `/api/auth/*` and `/api/calendar/:token` require authentication via an httpOnly cookie (`rentflow_token`) set on login. `/api/calendar/:token` is token-authenticated instead — the token itself is the credential, so a request for a bogus/revoked token returns a plain `404` rather than the cookie-auth redirect to `/login`. Money fields (`dayPrice`, `dayPriceSnapshot`, `setupCost`, `discountPct`/`discountAmount`, travel costs, price overrides, `dayRate`/`hourRate` on functions, etc.) are stripped from every response below for a caller whose role lacks `Kosten/Facturen` read access — those fields then arrive as `null` (or an empty array/`false` for whole-record fields), not omitted from the JSON shape. A role with `scope: own` (own-data-only, for freelancers) additionally sees `GET /api/projects`/`GET /api/projects/:id` filtered to only the projects they're booked on (every period of an owned project, not just their own), never sees money regardless of their `Kosten/Facturen` level, cannot write anywhere, and gets `403` on every standalone catalogue endpoint (people, materials, clients, locations, categories, functions) plus `/api/people/available` and `/api/materials/available` — that data is visible only embedded in their own projects. The one exception is person documents: a `scope: own` caller can still read their own attesten, just not anyone else's.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login — sets httpOnly cookie |
| `POST` | `/api/auth/logout` | Logout — clears cookie |
| `GET` | `/api/projects?from&to` | With no query string: every project, full nested tree (periods + bookings) — unchanged since before I2. With both `from`/`to`: only projects overlapping that range, in a materially lighter shape for the planning page (periods carry `peopleCount`/`materialsCount` instead of the full nested person/material/travel-cost trees) |
| `GET` | `/api/planning/persons?from&to` | Person-mode planning view — one row per person with their bookings in range (`{ personId, name, bookings }[]`), each booking flagging `overlapAck` (H2's forced-double-booking marker). `from`/`to` are required. `scope: own` is restricted to the caller's own row (never denied outright) |
| `POST` | `/api/projects` | Create a project (auto-creates a default "Hoofdperiode") |
| `GET` | `/api/projects/:id` | Get project with periods, bookings, stock items, persons |
| `PUT` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project (cascades to periods + bookings) |
| `POST` | `/api/projects/:id/periods` | Create a period on a project. `endDate` must be strictly after `startDate` and the period must overlap the project's own date range, or `400` |
| `PUT` | `/api/projects/:id/prices/material/:materialId` | Upsert a project-scoped day-price override for a material — body `{ dayPrice }`. Cascades: re-snapshots every existing `PeriodStockItem` of this material in this project to the new price |
| `DELETE` | `/api/projects/:id/prices/material/:materialId` | Remove the project-scoped material override. Cascades: re-snapshots every existing `PeriodStockItem` of this material in this project back to the material's global `dayPrice` |
| `PUT` | `/api/projects/:id/prices/person/:personId` | Upsert a project-scoped day-price override for a person — body `{ dayPrice }`. Cascades: re-snapshots every existing `PeriodPerson` for this person in this project to the new price |
| `DELETE` | `/api/projects/:id/prices/person/:personId` | Remove the project-scoped person override. Cascades: re-snapshots every existing `PeriodPerson` for this person in this project back to the person's global `dayPrice` |
| `PATCH` | `/api/periods/:id` | Rename / re-schedule a period. Same `endDate`/overlap validation as create, or `400` |
| `DELETE` | `/api/periods/:id` | Delete a period (cascades to its bookings) |
| `POST` | `/api/periods/:id/materials` | Book `{ materialId, quantity, discountPct?, discountAmount? }` — auto-assigns units not already booked in any overlapping period (including this one), snapshots the effective day price (project override if set, otherwise the material's `dayPrice`) and the material's `setupCost` per unit, returns `{ assignments, warnings }`. Returns `409` if `quantity` exceeds available units. A DB unique constraint on `(periodId, stockItemId)` prevents the same unit from being assigned to the same period twice |
| `PATCH` | `/api/periods/:id/materials/:assignmentId` | Update discount or re-snapshot price (`{ resnapshotPrice: true }`) |
| `DELETE` | `/api/periods/:id/materials/:assignmentId` | Remove a stock-item booking |
| `POST` | `/api/periods/:id/people` | Book `{ personId, functionId?, billingUnit? ("dag"\|"uur", default "dag"), discountPct?, discountAmount?, allowOverlap? }` — snapshots the effective rate through the five-level cascade (project override → client rate card → person-function rate → function default → person's `dayPrice` → 0, `src/lib/effective-price.ts`) at the requested unit, falling back to a day rate and echoing `billingUnit: "dag"` if no hourly rate resolves (Q19); `rateSnapshot` is set only for an "uur" booking, read by `personLineCost()` for hourly billing. Returns `{ assignment, warnings }`. Returns `409` if the person is already assigned to this period, or `409` with `{ error, blockingProject: { id, name, from, to } }` if blocked by an overlapping booking on another project — pass `allowOverlap: true` to book anyway (persists `overlapAck: true`); the API refuses without it regardless of what the client sends otherwise. A DB unique constraint on `(periodId, personId)` enforces the per-period uniqueness |
| `GET` | `/api/periods/:id/people/preview-price?personId&functionId&unit` | Resolve `{ dayPriceSnapshot, source, unit }` for a candidate booking before confirming it — same cascade as the POST above, no write |
| `PATCH` | `/api/periods/:id/people/:assignmentId` | Update role, discount, re-snapshot price, or set a custom `{ startAt, endAt }` window (both `null` to clear back to the whole period; both must be provided together, and must fall inside the period with `endAt` after `startAt`) |
| `DELETE` | `/api/periods/:id/people/:assignmentId` | Remove a person booking |
| `GET`/`POST` | `/api/periods/:id/people/:assignmentId/travel` | List / add travel-cost lines for a person's booking (`{ label?, unitCost, quantity }`). Total per line = `unitCost × quantity` (e.g. transport 4× or overnight 2×) |
| `PATCH`/`DELETE` | `/api/periods/:id/people/:assignmentId/travel/:travelId` | Edit or remove a travel-cost line |
| `GET` | `/api/materials?includeArchived` | List materials (includes `totalStock` count derived from stock items). Archived materials are excluded by default; pass `includeArchived=true` to include them. For a set (`isBundle`), also returns `setPrice` (the price override, or the live sum of component day-prices) and `bundleStock` — `{ completeSets, hasIncomplete, componentSum, components[] }`, the number of complete sets buildable from component stock plus a per-component breakdown of the leftover incomplete set |
| `POST` | `/api/materials` | Add a material — body includes `dayPrice`, optional `setupCost` (one-time op-/afbouw cost per unit) and `initialStock` |
| `GET` | `/api/materials/:id` | Get a material with its stock items |
| `PUT` | `/api/materials/:id` | Update a material (name, category, dayPrice, `setupCost`, notes, `isBundle`, `bundlePriceOverride` — a fixed set price, or `null` for the automatic component sum, optional `archived`) |
| `DELETE` | `/api/materials/:id` | Delete a material (cascades stock items + bookings) |
| `GET` | `/api/materials/available?from&to&excludePeriodId&projectId` | Per-material `{ availableCount, totalStock, availableStockItemIds }` for a date range, excluding archived materials. When `projectId` is supplied, `material.dayPrice` is the effective price for that project and `material.basePrice` + `material.hasOverride` are also returned. For a set, `availableCount` is the number of complete sets bookable in the range (min over components of `floor(freeUnits / perSetQty)`) and `basePrice` is the price override or the live component sum |
| `POST` | `/api/materials/import/preview` | Upload a materials export (`multipart/form-data`, field `file`, `.csv` or `.xlsx`) — parses a Rentman equipment export or a RentFlow round-trip export and classifies each row as `new`/`updated`/`unchanged`/`skipped` against the current catalogue (matched by `code`) without writing anything |
| `POST` | `/api/materials/import` | Apply the same upload for real — creates/updates materials (auto-creating categories as needed), generates stock items for new materials, and never touches existing bookings' price snapshots. A bad row is reported, not fatal to the rest of the file |
| `GET` | `/api/materials/:id/components` | List a set's components (`{ childId, quantity, child }[]`) |
| `POST` | `/api/materials/:id/components` | Add a component `{ childId, quantity }` to a set. Rejects a self-reference, a child that is itself a set (no nesting), a duplicate, or a child already used in another set — a stock item can belong to at most one set |
| `PATCH` | `/api/materials/:id/components/:componentId` | Change a component's per-set quantity |
| `DELETE` | `/api/materials/:id/components/:componentId` | Remove a component from a set |
| `GET` | `/api/materials/:id/stock-items` | List individual units of a material |
| `POST` | `/api/materials/:id/stock-items` | Add a unit — `unitNumber` auto-assigned, `identifier` optional |
| `PATCH` | `/api/stock-items/:id` | Edit a unit's identifier or notes |
| `DELETE` | `/api/stock-items/:id` | Delete a unit — `409` if it is currently booked |
| `GET` | `/api/people` | List all people (with `dayPrice`) |
| `POST` | `/api/people` | Add a person — body includes `dayPrice` |
| `PUT` | `/api/people/:id` | Update a person |
| `DELETE` | `/api/people/:id` | Delete a person |
| `GET` | `/api/people/available?from&to&excludePeriodId&sameProjectId&projectId` | Per-person `{ isAvailable, blockingProject?, sameProjectWarning? }`. When `projectId` is supplied, `person.dayPrice` is the effective price for that project and `person.basePrice` + `person.hasOverride` are also returned |
| `GET`/`POST` | `/api/clients/:id/rates` | List / add a client's per-function rate card (`{ functionId, dayRate?, hourRate? }`) — module `Kosten/Facturen`. No rows means the booking picker offers every function at its normal rate (L3.2) |
| `PUT`/`DELETE` | `/api/clients/:id/rates/:functionId` | Edit or remove one rate-card row |
| `POST` | `/api/invoices` | Create a draft invoice from a project — body `{ projectId, invoiceRole: "deposit"\|"final"\|"standalone", depositType?, depositValue? }`. Generates grouped-per-period lines (people/materials/bundles/travel) via the same cost maths as the Kosten tab; a `"final"` role deducts every prior non-`concept` deposit invoice for the project. `201`, `status: "concept"`, no `number` yet. Module `Kosten/Facturen`; denied outright (`403`) for `scope: own` regardless of matrix level |
| `GET` | `/api/invoices?status&clientId&projectId&kind` | List invoices (all filters optional) |
| `GET` | `/api/invoices/:id` | Get one invoice with its lines, payments and linked credit notes |
| `POST` | `/api/invoices/:id/finalize` | Allocate a gapless sequential number (`{year}-{seq:04d}` by default, credit notes always `CN-` + the same template) and flip `concept → verzonden`, freezing every line and total. `409` if the invoice is not currently `concept` |
| `PATCH` | `/api/invoices/:id` | Update `{ notes?, footer?, dueDate? }` — `concept` only, `409` otherwise |
| `DELETE` | `/api/invoices/:id` | Delete a draft invoice — `concept` only, `409` otherwise ("sent invoices are never deleted, only credited") |
| `POST` | `/api/invoices/:id/lines` | Add a manual line `{ description, quantity, unit, unitPrice, vatRate?, section? }` — `concept` only, `201 InvoiceLine`, recomputes the invoice's totals |
| `PATCH`/`DELETE` | `/api/invoices/:id/lines/:lineId` | Edit (`200 InvoiceLine`) or remove (`204`) a line — `concept` only, recomputes totals |
| `POST` | `/api/invoices/:id/regenerate` | Re-runs the line generator against the live project, discarding every current line including manual ones — `concept` only |
| `POST` | `/api/invoices/:id/credit-note` | Create a draft credit note against a sent (non-`concept`) invoice — body `{ lines?: { lineId, quantity? }[] }` (omit for a full mirror, provide for a partial one, each capped at its own original line's quantity). `201 Invoice` (`kind: "creditnota"`, own `credit` number series) — goes through the same `/finalize` endpoint afterwards to be numbered |
| `POST` | `/api/invoices/:id/payments` | Record a payment `{ amount, paidAt, method?, reference?, notes? }` — `400` if the invoice is `concept` or a credit note. `201 Payment`; may flip the invoice to `betaald` in the same transaction once the balance reaches zero |
| `PATCH`/`DELETE` | `/api/invoices/:id/payments/:paymentId` | Edit (`200 Payment`) or remove (`204`) a payment; may flip the invoice back to `verzonden` if the correction re-opens a balance |
| `GET` | `/api/stats?from&to` | Aggregate business figures — module `Cijfers`, denied entirely (`403`) for `scope: own` regardless of matrix level. Returns `{ range, revenueByMonth, revenueByClient, personUtilisation, topMaterials, payback }`. Booked revenue is attributed to the *period* (pro-rata split by calendar days across a month boundary); invoiced revenue to the *invoice's own* invoiceDate month — the two series are not directly comparable by design. Archived materials are excluded from `topMaterials` and `payback`. `payback: { best, worst }` (each up to 10 materials with `{ materialId, name, code, earned, costBasis, paybackPct }`) ignores `from`/`to` entirely — it's lifetime-to-date; a material with no known cost price is excluded, never shown at 0% |
| `GET` | `/api/calendar-feeds` | List the caller's own calendar-feed tokens — gated on `planning: lezen` (the module the feed content belongs to) |
| `POST` | `/api/calendar-feeds` | Issue or reissue (revoke-then-recreate) a feed token — body `{ kind: "personal"\|"company" }`. `kind: "company"` additionally requires `scope: all` and is refused (`400`) for `scope: own` regardless of matrix level |
| `DELETE` | `/api/calendar-feeds/:id` | Revoke one of the caller's own feed tokens — `404` if it belongs to someone else |
| `GET` | `/api/calendar/:token` | Token-authenticated (not cookie-authenticated) iCalendar feed — `text/calendar`. Resolves the token to a `personal` (the linked person's own bookings, or a single explanatory event if no person is linked) or `company` (every project/period, unfiltered) feed. A bogus/revoked token is `404`, never a redirect. A company feed's token is revoked automatically when the issuing user's role or that role's scope changes |

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push to any branch | `npm ci` → `prisma generate` (Postgres) → `tsc --noEmit` → `prisma generate` (SQLite dev) → `npm test` → `prisma generate` (Postgres) → `next build` |
| `release.yml` | CI passes on `main` | Semantic-release tag → Docker build → push `ghcr.io/<repo>:latest` + `:<sha>` + `:<semver>` |

---

## Future plan list

Not in scope for the current release, kept here so the direction is visible:

- **Barcode / QR scan to pick specific stock items.** Today, booking a material picks units automatically by `unitNumber`. The next step is a scan-driven flow at booking time so the operator confirms exactly which physical units are shipped to the project (and detects mis-pulls before they leave the warehouse).
- **Per-unit shipped / returned timestamps + packing-list checklist.** Each `PeriodStockItem` would carry `shippedAt` / `returnedAt` so the system can show what is currently out, what is overdue, and what is back. The UI would expose a per-period packing list with tick-boxes that operators check off as units are loaded and unloaded.
- **Edit a booking's discount after creation.** Right now a discount is set when the booking is created; changing it requires removing and re-adding the booking. A dedicated discount popover on each booking line would patch `discountPct` / `discountAmount` in place.
- **Bulk "re-snapshot stale prices" action.** The price-drift warning surfaces individual lines where `dayPriceSnapshot` no longer matches the current material/person `dayPrice`. A project-level action would re-snapshot every stale line in one call, useful when refreshing a long-running project after a price-list update.
