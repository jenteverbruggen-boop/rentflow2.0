# RentFlow 2.0

A rental-planning tool for managing **projects**, **periods**, **people**, and **materials**. Each project contains one or more named **periods** (date ranges that may overlap); bookings live on a period. Materials are split into individually traceable **stock items** so units assigned to a project can be tracked. People and materials each have a day price; a project can override that price for any material or person to negotiate project-specific rates. Projects produce an itemised cost overview with optional per-booking discounts. Materials can also be grouped into **sets** (bundles): a set owns no stock itself but has a recipe of component materials, the number of complete sets is auto-calculated from component stock (with a warning for the leftover incomplete set), and booking a set reserves its components atomically. Bookings can also carry one-time costs: a per-unit setup/teardown cost on a material (charged once, not per day) and per-person travel costs entered on a period booking (rate × number of trips/nights). The project cost overview breaks totals into Personen, Materialen, and Reiskosten. Each period's material bookings also have a packing-list checklist — tick-boxes per physical unit for "verzonden"/"terug" — so it's visible what's currently out, overdue, or back. The project detail page is tab-based — `Overzicht`, `Periodes` (with a Gantt-style timeline), `Personen`, `Materialen`, `Kosten`, and `Notities`. RentFlow rejects cross-project double-bookings and warns on same-project overlaps. Freeform **notes** (a call or meeting with a customer, optionally with photos) can be created unassigned and linked to a project or a client later — visible on that project's Notities tab, or in a general Notities view filterable by project, client, or unassigned, with who created/last edited each note tracked.

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
│   │   │   ├── planning/
│   │   │   └── notes/             # General notes view (filter by project/client/unassigned)
│   │   └── api/                  # Next.js Route Handlers
│   │       ├── auth/             # login, register, logout
│   │       ├── projects/         # CRUD + [id]/periods + [id]/prices/{material,person}/[xId]
│   │       ├── periods/          # [id] CRUD + [id]/materials + [id]/people
│   │       ├── people/           # CRUD + /available
│   │       ├── materials/        # CRUD + /available + [id]/stock-items (+ /bulk add/remove)
│   │       ├── stock-items/      # [id] PATCH / DELETE
│   │       ├── notes/            # CRUD + [id]/images
│   │       └── note-images/      # [id] GET (serve bytes) / DELETE
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
│   │   ├── project-costs-tab.tsx
│   │   ├── project-notes-tab.tsx
│   │   ├── note-list.tsx / note-card.tsx / note-form-dialog.tsx  # General + per-project notes UI
│   │   └── note-images.tsx           # Photo upload/thumbnail grid on a note
│   ├── lib/
│   │   ├── prisma.ts             # Singleton PrismaClient
│   │   ├── auth.ts               # signToken / verifyToken
│   │   ├── api-auth.ts           # requireAuth() + response helpers
│   │   ├── pricing.ts            # periodDays, line/period/project totals, formatEUR, effective price helpers
│   │   ├── availability.ts       # Stock item + person conflict / warning logic
│   │   ├── effective-price.ts    # Server-side resolver: project override → fallback to global
│   │   ├── project-include.ts    # Shared Prisma include for project queries
│   │   ├── notes.ts              # Note list/get/create/update/delete + serializer
│   │   ├── note-images.ts        # NoteImage store/get/delete (Bytes in Postgres, mirrors documents.ts)
│   │   └── utils.ts              # cn(), statusVariant()
│   ├── hooks/
│   │   ├── use-availability.ts   # TanStack Query wrappers for /available endpoints
│   │   └── use-notes.ts          # TanStack Query wrappers for /api/notes
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

All endpoints except `/api/auth/*` and `/api/calendar/:token` require authentication via an httpOnly cookie (`rentflow_token`) set on login. `/api/calendar/:token` is token-authenticated instead — the token itself is the credential, so a request for a bogus/revoked token returns a plain `404` rather than the cookie-auth redirect to `/login`. Money fields (`dayPrice`, `dayPriceSnapshot`, `setupCost`, `discountPct`/`discountAmount`, travel costs, price overrides, `dayRate`/`hourRate` on functions, etc.) are stripped from every response below for a caller whose role lacks `Kosten/Facturen` read access — those fields then arrive as `null` (or an empty array/`false` for whole-record fields), not omitted from the JSON shape. A role with `scope: own` (own-data-only, for freelancers) additionally sees `GET /api/projects`/`GET /api/projects/:id` filtered to only the projects they're booked on (every period of an owned project, not just their own), never sees money regardless of their `Kosten/Facturen` level, is read-only everywhere, and gets `403` on every standalone catalogue endpoint (people, materials, clients, locations, categories, functions) plus `/api/people/available` and `/api/materials/available` — that data is visible only embedded in their own projects. Two deliberate exceptions to read-only: a `scope: own` caller can still read their own person documents (attesten), just not anyone else's; and can create/edit notes (never delete), but only against a project they're actually booked on, and only edit a note they themselves wrote — see `/api/notes` below. On the **write** side the mirror rule applies: a caller who cannot *see* money cannot meaningfully send it back (the full-record forms echo the redacted `null`/`0` they were given), so submitted money fields from such a caller are ignored entirely — the request succeeds and the persisted values are left untouched, rather than being rejected or overwritten with the redacted placeholder. A caller who *can* see money but lacks `Kosten/Facturen: wijzigen` is still `403`'d on any value that actually differs from what is stored, and an unchanged echo is let through so the rest of the body can save.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login — sets httpOnly cookie |
| `POST` | `/api/auth/logout` | Logout — clears cookie |
| `GET` | `/api/projects?from&to` | With no query string: every project, full nested tree (periods + bookings) — unchanged since before I2. With both `from`/`to`: only projects overlapping that range, in a materially lighter shape for the planning page (periods carry `peopleCount`/`materialsCount` instead of the full nested person/material/travel-cost trees) |
| `GET` | `/api/planning/persons?from&to` | Person-mode planning view — one row per person with their bookings in range (`{ personId, name, bookings }[]`), each booking flagging `overlapAck` (H2's forced-double-booking marker). `from`/`to` are required. `scope: own` is restricted to the caller's own row (never denied outright) |
| `POST` | `/api/projects` | Create a project (auto-creates a default "Hoofdperiode") |
| `GET` | `/api/projects/export` | Download every project as a real `.xlsx` (P2.3) — export only, no import counterpart (a project's real content is a booking graph, not a flat row). `scope: own` is filtered to owned projects, same as `GET /api/projects` itself, never denied outright |
| `GET` | `/api/bookings/export` | Download every person/material/bundle booking, flattened, one row per booking with `kind`/`entityName`/`quantity` (P2.3) — export only. Money columns omitted entirely without `Kosten/Facturen: lezen`. `scope: own` filtered the same way as projects |
| `GET` | `/api/projects/:id` | Get project with periods, bookings, stock items, persons |
| `PUT` | `/api/projects/:id` | Update a project. Leaving `status` `concept`/`geannuleerd` for any other status first tries to resolve open overbooked material (see `/api/periods/:id/shortages/fill`), then refuses with `409 { error, shortages }` and leaves the status unwritten if anything is still overbooked |
| `DELETE` | `/api/projects/:id` | Delete a project (cascades to periods + bookings) |
| `POST` | `/api/projects/:id/periods` | Create a period on a project. `endDate` must be strictly after `startDate` and the period must overlap the project's own date range, or `400` |
| `PUT` | `/api/projects/:id/prices/material/:materialId` | Upsert a project-scoped day-price override for a material — body `{ dayPrice }`. Cascades: re-snapshots every existing `PeriodStockItem` of this material in this project to the new price |
| `DELETE` | `/api/projects/:id/prices/material/:materialId` | Remove the project-scoped material override. Cascades: re-snapshots every existing `PeriodStockItem` of this material in this project back to the material's global `dayPrice` |
| `PUT` | `/api/projects/:id/prices/person/:personId` | Upsert a project-scoped day-price override for a person — body `{ dayPrice }`. Cascades: re-snapshots every existing `PeriodPerson` for this person in this project to the new price |
| `DELETE` | `/api/projects/:id/prices/person/:personId` | Remove the project-scoped person override. Cascades: re-snapshots every existing `PeriodPerson` for this person in this project back to the person's global `dayPrice` |
| `PATCH` | `/api/periods/:id` | Rename / re-schedule a period. Same `endDate`/overlap validation as create, or `400` |
| `DELETE` | `/api/periods/:id` | Delete a period (cascades to its bookings) |
| `POST` | `/api/periods/:id/materials` | Book `{ materialId, quantity, discountPct?, discountAmount?, allowOverbook? }` — auto-assigns units not already booked in any overlapping period (including this one), snapshots the effective day price (project override if set, otherwise the material's `dayPrice`) and the material's `setupCost` per unit, returns `{ assignments, warnings }`. On a `concept`/`geannuleerd` project, a request that exceeds what's free returns `409` with `{ error, shortfall: { requested, available } }` unless `allowOverbook: true` is set, in which case every free unit is booked and the rest is recorded as a `PeriodMaterialShortage` (surfaced as a Dutch warning string in `warnings`) instead of failing; on any other project status, exceeding availability always returns plain `409`. A DB unique constraint on `(periodId, stockItemId)` prevents the same unit from being assigned to the same period twice |
| `PATCH` | `/api/periods/:id/materials/:assignmentId` | Update discount, re-snapshot price (`{ resnapshotPrice: true }`), or tick the packing-list checklist (`{ shipped?: boolean, returned?: boolean }` — the server stamps `shippedAt`/`returnedAt` itself; un-shipping also clears `returned`, and `returned: true` is rejected while not shipped) |
| `DELETE` | `/api/periods/:id/materials/:assignmentId` | Remove a stock-item booking |
| `POST` | `/api/periods/:id/shortages/fill` | Resolve every open `PeriodMaterialShortage` on this period's project against stock that has since freed up or grown — books what it can, decrements or removes each row, returns `{ filled, remaining }` |
| `PATCH` | `/api/periods/:id/shortages/:shortageId` | Adjust an overbooked line's quantity — `{ quantity }`; `quantity: 0` deletes the row |
| `DELETE` | `/api/periods/:id/shortages/:shortageId` | Remove an overbooked line outright |
| `POST` | `/api/periods/:id/people` | Book `{ personId, functionId?, billingUnit? ("dag"\|"uur", default "dag"), discountPct?, discountAmount?, allowOverlap? }` — snapshots the effective rate through the five-level cascade (project override → client rate card → person-function rate → function default → person's `dayPrice` → 0, `src/lib/effective-price.ts`) at the requested unit, falling back to a day rate and echoing `billingUnit: "dag"` if no hourly rate resolves (Q19); `rateSnapshot` is set only for an "uur" booking, read by `personLineCost()` for hourly billing. Returns `{ assignment, warnings }`. Returns `409` if the person is already assigned to this period, or `409` with `{ error, blockingProject: { id, name, from, to } }` if blocked by an overlapping booking on another project — pass `allowOverlap: true` to book anyway (persists `overlapAck: true`); the API refuses without it regardless of what the client sends otherwise. A DB unique constraint on `(periodId, personId)` enforces the per-period uniqueness |
| `GET` | `/api/periods/:id/people/preview-price?personId&functionId&unit` | Resolve `{ dayPriceSnapshot, source, unit }` for a candidate booking before confirming it — same cascade as the POST above, no write |
| `PATCH` | `/api/periods/:id/people/:assignmentId` | Update role, discount, re-snapshot price, set a custom `{ startAt, endAt }` window (both `null` to clear back to the whole period; both must be provided together, and must fall inside the period with `endAt` after `startAt`), or select specific working days with `{ days: [{ startAt, endAt }, …] }` — the complete set replaces whatever was stored, `[]` clears back to the whole period, and each entry must fall inside the period, end after it starts, and not overlap another entry (`400` otherwise). Selected days are what gets billed (`personLineCost()` counts them instead of the period's length) and what blocks availability, so an unselected day inside the period stays bookable elsewhere. `startAt`/`endAt` are maintained server-side as the envelope of the selected days |
| `DELETE` | `/api/periods/:id/people/:assignmentId` | Remove a person booking |
| `GET`/`POST` | `/api/periods/:id/people/:assignmentId/travel` | List / add travel-cost lines for a person's booking (`{ label?, unitCost, quantity }`). Total per line = `unitCost × quantity` (e.g. transport 4× or overnight 2×). `unitCost` accepts a comma decimal (`"12,50"`); a blank `quantity` means 1. A rejected body returns `400` with a Dutch message naming the field |
| `PATCH`/`DELETE` | `/api/periods/:id/people/:assignmentId/travel/:travelId` | Edit or remove a travel-cost line |
| `GET` | `/api/materials?includeArchived` | List materials (includes `totalStock` count derived from stock items). Archived materials are excluded by default; pass `includeArchived=true` to include them. For a set (`isBundle`), also returns `setPrice` (the price override, or the live sum of component day-prices) and `bundleStock` — `{ completeSets, hasIncomplete, componentSum, components[] }`, the number of complete sets buildable from component stock plus a per-component breakdown of the leftover incomplete set |
| `POST` | `/api/materials` | Add a material — body includes `dayPrice`, optional `setupCost` (one-time op-/afbouw cost per unit) and `initialStock`. `costPrice`/`listPrice`/`revenueBefore` (K4) are never sent on create — they default to `null` (unknown), not `0`, so a fresh material is excluded from `payback` until set via the detail pane's inline edit |
| `GET` | `/api/materials/:id` | Get a material with its stock items |
| `PUT` | `/api/materials/:id` | Update a material (name, category, dayPrice, `setupCost`, notes, `isBundle`, `bundlePriceOverride` — a fixed set price, or `null` for the automatic component sum, optional `archived`, `costPrice` — purchase/aankoopprijs per unit, `listPrice` — reference catalogue price, `revenueBefore` — lifetime revenue earned before this material was tracked in RentFlow, all three feeding `GET /api/stats`'s `payback`) |
| `DELETE` | `/api/materials/:id` | Delete a material (cascades stock items + bookings) |
| `GET` | `/api/materials/available?from&to&excludePeriodId&projectId` | Per-material `{ availableCount, totalStock, availableStockItemIds }` for a date range, excluding archived materials. When `projectId` is supplied, `material.dayPrice` is the effective price for that project and `material.basePrice` + `material.hasOverride` are also returned. For a set, `availableCount` is the number of complete sets bookable in the range (min over components of `floor(freeUnits / perSetQty)`) and `basePrice` is the price override or the live component sum |
| `POST` | `/api/materials/import/preview` | Upload a materials export (`multipart/form-data`, field `file`, `.csv` or `.xlsx`) — parses a Rentman equipment export or a RentFlow round-trip export and classifies each row as `new`/`updated`/`unchanged`/`skipped` against the current catalogue (matched by `code`) without writing anything |
| `POST` | `/api/materials/import` | Apply the same upload for real — creates/updates materials (auto-creating categories as needed), generates stock items for new materials, and never touches existing bookings' price snapshots. A bad row is reported, not fatal to the rest of the file |
| `POST` | `/api/import/:entity/preview` | Generalised preview (P3) — `:entity` is `materials`\|`people`\|`clients`\|`locations` (never `invoices`, in either mode). Body `multipart/form-data`: `file`, `mode` (`update`\|`replace`). `mode: "replace"` additionally returns `toDelete` (every current row) and, if any exist, `blockers` — a non-empty `blockers` array means apply will refuse. Never writes |
| `POST` | `/api/import/:entity/apply` | Applies the previewed file. `mode: "update"` requires `:entity`'s own module at `wijzigen`; `mode: "replace"` requires `verwijderen` plus body field `typedConfirmation` matching the entity's exact Dutch label (e.g. `"materialen"`) — a bare confirm button is never enough. Re-runs the referential check server-side regardless of what the client's preview showed; `409` with the full blocker list if anything is still referenced. A permitted replace truncates then reloads in one transaction and writes an `ImportAudit` row |
| `GET` | `/api/materials/export?includeArchived` | Download the material catalogue as a real `.xlsx` (P2.2) — mirrors the on-screen archived-material default. Money columns (`dayPrice`/`setupCost`/`costPrice`/`listPrice`/`revenueBefore`/`bundlePriceOverride`) are entirely absent from the header row without `Kosten/Facturen: lezen`, never blanked |
| `GET` | `/api/materials/:id/components` | List a set's components (`{ childId, quantity, child }[]`) |
| `POST` | `/api/materials/:id/components` | Add a component `{ childId, quantity }` to a set. Rejects a self-reference, a child that is itself a set (no nesting), a duplicate, or a child already used in another set — a stock item can belong to at most one set |
| `PATCH` | `/api/materials/:id/components/:componentId` | Change a component's per-set quantity |
| `DELETE` | `/api/materials/:id/components/:componentId` | Remove a component from a set |
| `GET` | `/api/materials/:id/stock-items` | List individual units of a material |
| `POST` | `/api/materials/:id/stock-items` | Add a unit — `unitNumber` auto-assigned, `identifier` optional |
| `POST` | `/api/materials/:id/stock-items/bulk` | Add `count` (1-500) blank units in one transaction, numbered after the current max — `{ added, fromUnit, toUnit }` |
| `DELETE` | `/api/materials/:id/stock-items/bulk` | Remove units by `{ count }` (the `count` highest unit numbers) or by `{ ids }`. All-or-nothing: if any targeted unit has ever been booked, nothing is deleted and the response is `409` with `{ error, blockedUnits, removable }`; an id not belonging to the material is a `400` |
| `PATCH` | `/api/stock-items/:id` | Edit a unit's identifier or notes |
| `DELETE` | `/api/stock-items/:id` | Delete a unit — `409` if it is currently booked |
| `GET` | `/api/people` | List all people (with `dayPrice`) |
| `GET` | `/api/people/export` | Download every person as a real `.xlsx` (P2.2). `functions` is a comma-separated list of function names, not ids. `dayPrice` is entirely absent from the header row without `Kosten/Facturen: lezen` |
| `POST` | `/api/people` | Add a person — body includes `dayPrice` |
| `PUT` | `/api/people/:id` | Update a person |
| `DELETE` | `/api/people/:id` | Delete a person |
| `GET` | `/api/functions?includeArchived=1` | List the function (crew-role) catalogue with company-default `dayRate`/`hourRate`. Archived functions are excluded unless `includeArchived=1`. Every row carries `_count` — `{ people, assignments, clientRates }` — so the UI can show what a function is still used by |
| `POST` | `/api/functions` | Add a function — `{ name, dayRate?, hourRate? }` |
| `PUT` | `/api/functions/:id` | Update a function's name, company-default rates, or `archived` flag. Reachable from the pencil on each chip in the person form as well as the Functies manager |
| `DELETE` | `/api/functions/:id` | Hard-delete a function — allowed **only** when nothing references it (`people`, `assignments` and `clientRates` all zero). Otherwise `409` with a message naming the actual counts, directing the caller to archive instead. This is deliberate: `PeriodPerson.functionId` is optional with no `onDelete`, so Prisma would default to `SetNull` and silently blank the function on historical (possibly already-invoiced) bookings |
| `GET` | `/api/people/available?from&to&excludePeriodId&sameProjectId&projectId` | Per-person `{ isAvailable, blockingProject?, sameProjectWarning? }`. When `projectId` is supplied, `person.dayPrice` is the effective price for that project and `person.basePrice` + `person.hasOverride` are also returned |
| `GET` | `/api/clients/export` | Download every client as a real `.xlsx` (P2.2). No money column exists on `Client` today |
| `GET` | `/api/locations/export` | Download every location as a real `.xlsx` (P2.2). No money column exists on `Location` today |
| `GET`/`POST` | `/api/clients/:id/rates` | List / add a client's per-function rate card (`{ functionId, dayRate?, hourRate? }`) — module `Kosten/Facturen`. No rows means the booking picker offers every function at its normal rate (L3.2) |
| `PUT`/`DELETE` | `/api/clients/:id/rates/:functionId` | Edit or remove one rate-card row |
| `POST` | `/api/invoices` | Create a draft invoice from a project — body `{ projectId, invoiceRole: "deposit"\|"final"\|"standalone", depositType?, depositValue? }`. Generates grouped-per-period lines (people/materials/bundles/travel) via the same cost maths as the Kosten tab; a `"final"` role deducts every prior non-`concept` deposit invoice for the project. `201`, `status: "concept"`, no `number` yet. Refuses with `409` if the project still has open overbooked material (see `/api/periods/:id/shortages/fill`). Module `Kosten/Facturen`; denied outright (`403`) for `scope: own` regardless of matrix level |
| `GET` | `/api/invoices?status&clientId&projectId&kind` | List invoices (all filters optional) |
| `GET` | `/api/invoices/export` | Download every invoice as a real `.xlsx` (P2.3) — export only, no import in any mode, ever (an invoice's number is gapless/sequential and every figure is frozen once sent). Denied entirely (`403`) for `scope: own`, same as every other `Kosten/Facturen` route |
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
| `GET` | `/api/calendar-feeds` | List the caller's own calendar-feed tokens (their company feed plus the person feed of whoever they are linked to) — gated on `planning: lezen` (the module the feed content belongs to). `?all=1` returns every *person* feed instead, for the People page's per-person links, and additionally requires `personen: lezen` |
| `POST` | `/api/calendar-feeds` | Issue or reissue (revoke-then-recreate) a feed token — body `{ kind: "person"\|"company", personId? }`. `kind: "company"` additionally requires `scope: all` and is refused (`400`) for `scope: own` regardless of matrix level. For `kind: "person"`, an omitted `personId` means the caller's own linked person (self-service on `planning: lezen`); naming someone else's `personId` requires `personen: wijzigen`, and a caller with no linked person and no `personId` gets a `400` |
| `DELETE` | `/api/calendar-feeds/:id` | Revoke a feed token, under the same rule that governs issuing it (own company feed, own person feed, or anyone's person feed with `personen: wijzigen`) — `404`, never `403`, when the caller may not touch it, so feed ids cannot be enumerated |
| `GET` | `/api/person-link-suggestions` | Unlinked users whose e-mail matches exactly one unlinked person — module `Gebruikers`, read. Read-only and advisory: applying a suggestion goes through `PATCH /api/users/:id`. Matching is case-insensitive exact e-mail only, and is skipped when the address is ambiguous on either side; names are never compared |
| `GET` | `/api/calendar/:token` | Token-authenticated (not cookie-authenticated) iCalendar feed — `text/calendar`. Resolves the token to a `person` (that person's own bookings) or `company` (every project/period, unfiltered) feed. A person feed is keyed on the **person**, not on a user account, so someone who never logs in can still be handed a subscribable URL from the People page. A bogus/revoked token is `404`, never a redirect. A company feed's token is revoked automatically when the issuing user's role or that role's scope changes. Periods carrying real hours are emitted as UTC timestamps; a period stored as a bare midnight-UTC window (legacy/imported data) is emitted as a whole-day `VALUE=DATE` event, so a Brussels client no longer renders it starting 02:00 and spilling into the next day |
| `GET` | `/api/notes?projectId&clientId&unassigned&q` | List notes — module `Notities`. `unassigned=1` returns only notes with neither `projectId` nor `clientId` set; `q` does a plain (case-sensitive on Postgres, case-insensitive on SQLite dev) substring match on title/body. A note can be linked to a project or a client, never both. `scope: own` only ever sees notes on a project they're booked on — `clientId`/`unassigned` are ignored for them |
| `POST` | `/api/notes` | Create a note — body `{ title, body, noteDate?, projectId?, clientId? }` (`noteDate` defaults to now). Stamps `createdById`/`createdByName` from the caller; `400` if both `projectId` and `clientId` are set. One of the two deliberate write exceptions for `scope: own` (see the API Overview intro): `projectId` is required and must be a project they're booked on, `clientId` is refused outright |
| `GET` | `/api/notes/:id` | Get one note with its linked project/client and image metadata (never the image bytes). `scope: own` gets `404`, not `403`, for a note outside their own projects |
| `PUT` | `/api/notes/:id` | Update a note, including assigning/unassigning it to a project or client. Stamps `updatedById`/`updatedByName` from the caller. `scope: own` may only edit a note they themselves wrote, on a project they're still booked on, and any `projectId`/`clientId` they send is silently ignored rather than honoured |
| `DELETE` | `/api/notes/:id` | Delete a note (cascades its images) — always denied (`403`) for `scope: own`, unlike create/update |
| `POST` | `/api/notes/:id/images` | Upload a photo (`multipart/form-data`, field `file`, `image/*` only) — `400` over 5 MB or past 10 images on the note. `scope: own` may only add a photo to a note they themselves wrote |
| `GET` | `/api/note-images/:id` | Serve one note photo's bytes inline. `scope: own` gets `404` for a photo outside their own projects |
| `DELETE` | `/api/note-images/:id` | Remove one photo from a note. `scope: own` may only remove a photo from a note they themselves wrote |

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
- **Bulk "re-snapshot stale prices" action.** The price-drift warning surfaces individual lines where `dayPriceSnapshot` no longer matches the current material/person `dayPrice`. A project-level action would re-snapshot every stale line in one call, useful when refreshing a long-running project after a price-list update.
- **Peppol integration.** Send invoices to the Belgian Peppol network for automatic submission to government clients. This is a requirement for any invoice sent to a Belgian public authority, and will be implemented in a future release.
