# PO Feedback Roadmap — July 2026

> Source: product owner feedback (Dutch), transformed into actionable work items for AI workers (Opus/Sonnet).
> Status: **v5 FINAL — two adversarial review rounds + three question rounds incorporated.** Only Q8 (label format) remains open for the PO.
> Reference PDFs analysed: Ref 1 = pakbon (packing slip), Ref 2 = call sheet (both from "The Original Group" ERP).

## Decisions from question round (2026-07-10)

| # | Decision |
|---|---|
| Q4 | Person ↔ Function is **many-to-many**; booking/call sheet picks one functie per assignment. |
| Q9 | Roles: **ADMIN / PLANNER / VIEWER**. Public registration **disabled** — admin creates accounts. |
| Q6 | Code format `{prefix}01-{3-digit seq}`; subgroup fixed to `01` in v1; **code does NOT change** when a material changes category; manually overridable, unique. |
| Q12 | Smartphone integratie = **PWA (installable)** + **camera barcode/QR scanning** for material lookup. No push notifications for now. |
| Q3 | Periods get **start/end times** (schema already stores DateTime — but see B7: data migration + timezone spec required). |
| Q2 | **Two sidebar items**: Klanten and Locaties; locations are free-standing (reusable across clients). |
| Q13 | **Bundles/sets are in scope** (tafel + hoes as one bookable set) → item E6. Flat pakbon (B4a) ships first; nested bundle rendering follows (B4b). |
| Q1 | Deleting a client with linked projects is **blocked** (error message); archiving can come later. |
| Q5 | Attest-PDFs (and logo) stored **in the database** for now (`Bytes` column) — quick and working; storage goes behind a small abstraction so it can swap to files/S3 later. No Docker volume needed. |
| Q7 | QR payload = **deep-link URL** to the material page; Code128 barcode carries the raw code. |
| Q10 | Person ↔ User = **simple account link** (`User.personId`); rights stay role-based. **Pulled forward to phase 3** (with F1/D1). |
| Q11 | **Logo upload in v1** of settings; pakbon/call sheet header renders it (stored per Q5). |
| Q14 | Projectnummer = the internal autoincrement **id** (matches ref-PDF style "213"). No schema work. |
| Q15 | Bundle price = **sum of component prices with manual override** per bundle. |
| Q16 | Back-to-back periods (end 12:00 / start 12:00) do **NOT** conflict — boundary comparison becomes strict (`lt`/`gt`) in availability checks. |
| Q8 | ⛔ **Still open**: label format/printer (62 mm roll vs A4 sticker sheet) — blocks E5 only. |

## Current-state facts (verified against codebase, 2 review rounds)

- `Project.client` and `Project.location` are free-text nullable strings (`prisma/schema.prisma:19-32`). No human-facing project number (only autoincrement `id`) — pakbon/call sheet print "Projectnummer".
- `Person.role` is a free-text nullable string; `PeriodPerson.role` is an assignment-level override.
- `Material.category` is free-text with **composite** seed values (`composeCategory()`, `prisma/seed.ts:98-104`): `"Meubilair - Fysiek item"`, `"Catering - Virtuele combinatie"`, bare `"Fysiek item"`. "Combinatie" values prove **bundles exist in the source data**.
- Item codes (e.g. `0401-006`) live only inside `Material.notes` — no dedicated column. Real data has **duplicate codes** (`9998-902` twice), malformed codes (`898-…`, `0000-…`), multiple subgroups per prefix.
- `User.role` is a string, **not enforced anywhere**; JWT payload is `{ id, email, name }` (`src/lib/auth.ts:5-9`) — **no role claim**. Live holes: public `/api/auth/register`; any authenticated user can PATCH any user's role (`src/app/api/users/[id]/route.ts:22-54`). `User.role @default("user")` (`schema.prisma:15`).
- **Dev migration workflow broken** (P3019: `migration_lock.toml` pinned to postgresql; `0001_init` is Postgres SQL). Dev SQLite is seed-driven.
- **All existing/seeded periods store midnight timestamps** (`prisma/seed.ts:316-318`); overlap checks are inclusive datetime comparisons (`src/lib/availability.ts:22-25,46-49`); API parses `new Date(body.startDate)` raw (`src/app/api/periods/[id]/route.ts:18`) — date-only strings parse as UTC, datetime-local strings as server-local. Day-bucket comparisons exist in `planning/page.tsx:50`, `project-periods-tab.tsx:55-62`, `period-form.tsx:34-36,58-60`; pricing uses `differenceInCalendarDays + 1` (`src/lib/pricing.ts:16-19`).
- Booking flow checks availability **before** `$transaction` (batched creates only) — TOCTOU race exists today (`src/app/api/periods/[id]/materials/route.ts:27-62`).
- No file upload, no server-side PDF generation, **no test infrastructure**. Costs tab prints via `window.print()` + print CSS.
- `docker-compose.yml`: volume only for `db` — the `app` service has none.
- Dashboard stat cards display-only; planning items not clickable; costs tab has no materials/people split; no settings page.
- `proxy.ts` matcher only excludes `_next/static|_next/image|favicon.ico` — a web manifest or icons would be login-walled (`src/proxy.ts:29`).
- `src/lib/grouping.ts:13-22` groups bookings by `stockItem.materialId` (flat) — fine for a flat pakbon, insufficient for bundle nesting.

## Conventions for all work items

- Follow `CLAUDE.md`: 150-line file limit, types in `src/types/index.ts`, `requireAuth()` + response helpers in every route, React Hook Form + Zod, TanStack Query, never edit `src/components/ui/`.
- Every schema change lands in **both** `prisma/schema.prisma` (PostgreSQL) **and** `prisma/schema.dev.prisma` (SQLite). Money fields: `Decimal @db.Decimal(10,2)` in Postgres ↔ `Float` in SQLite.
- **No Prisma enums** (SQLite + shared generated client): model "enums" as `String` + TS union + Zod.
- Every entity-extraction item must **also update `prisma/seed.ts`** — dev is seeded, not migrated.
- Schema-touching items within a phase are **serialized**: one designated DDL commit lands first, feature workers follow. Never two workers editing schema files concurrently.
- `npx tsc --noEmit` must pass; `code` skill for review, `design` skill for UI, `cicd` skill for Docker/workflow edits, `docs` skill after schema/API changes.
- Anything touching booking/availability logic (`src/lib/availability.ts`) is **critical** — extra review + tests (B7, E6).
- UI copy Dutch (nl-BE); code/identifiers English.

---

## Workstream Z — Foundations

### Z1. Repair dev DB workflow `M` `P0` `blocks all schema work`
`db:dev:*` scripts fail (P3019). Implement: SQLite dev via `prisma db push` (adjust scripts), Postgres migrations authored via `prisma migrate diff` (no local shadow DB). Document the recipe in CLAUDE.md.
- **Accept:** `npm run db:dev:reset && npm run db:dev:migrate` (or replacements) succeed from clean checkout; a sample no-op Postgres migration validates.

### Z2. Test infrastructure (vitest) `S` `P1`
Add vitest + `npm test`; first tests target `src/lib/pricing.ts`. Needed by B6/B7/E3/E6/F1.
- **Accept:** `npm test` runs CI-compatible with ≥1 real test.

### Z3. Human-facing project number `S` `P1` `✓ decided (Q14)`
Render the autoincrement `id` as projectnummer on documents. No schema work.
- **Accept:** pakbon/call sheet show the project id as "Projectnummer".

---

## Workstream A — Dashboard

### A1. Clickable stat cards `S` `P1` `no deps`
Stat cards become real links to `/projects`, `/people`, `/materials` with hover affordance per `design` skill.
- **Accept:** each card navigates; keyboard accessible.

---

## Workstream B — Projects

### B1. Client as a separate entity `L` `P1` `deps: Z1`
`Client { id, name, contactName?, email?, phone?, address?, postalCode?, city?, vatNumber?, notes? }`; `Project.clientId Int?`. Keep legacy string, backfill by distinct-name match, drop after verification. Update `seed.ts`.
- API: `GET/POST /api/clients`, `GET/PUT/DELETE /api/clients/[id]` — DELETE returns an error while projects reference the client (decided Q1).
- UI: sidebar item **"Klanten"** (People pattern); ProjectForm searchable combobox (shadcn `command`) with inline "+ Nieuwe klant".
- **Accept:** create project with existing or inline-created client; legacy projects unaffected until backfill.

### B2. Location as a separate entity `M` `P1` `deps: Z1`
`Location { id, name, address?, postalCode?, city?, phone?, notes? }`; `Project.locationId Int?`. Free-standing (decided). Sidebar item **"Locaties"**; combobox + inline create; `seed.ts`.
- **Accept:** as B1. Full address renders on documents.

### B3. Quick status change on project detail `S` `P1` `no deps`
Inline `Select`/`DropdownMenu` on the detail-header status badge, PUT `{status}`, optimistic mutation, invalidate `["projects"]`.
- **Accept:** status changes without opening the edit dialog.

### B4a. Pakbon — flat version `L` `P2` `deps: B1, B2, B7, E1, E3, F4, Z3` *(does NOT wait for E6)*
Match Ref 1 layout minus bundle nesting:
- Company header from settings (F4); meta: opdrachtgever, locatie + address, projectnummer (Z3), accountmanager, aangemaakt op.
- Tijdschema (period / van–tot with times, B7).
- Materialen grouped by category: aantal, `[ ] [ ]` double check-off boxes, naam, code, totaal — via `groupMaterialAssignments`. No code → `TEMP`.
- Signature blocks uitvoerder/klant. Printable route `/projects/[id]/pakbon`, print CSS (`window.print()`, no PDF lib).
- **Accept:** pakbon for a project with 2 periods and 3 categories prints on A4 matching Ref 1's structure (flat lines).

### B4b. Pakbon — nested bundle lines `M` `P3` `deps: B4a, E6`
Bundles render as parent line + indented component lines with own codes (Ref 1 pattern).
- **Accept:** a booked bundle prints as parent + indented components.

### B5. Call sheets from People tab `L` `P3` `deps: B1, B2, B7, D1, F4, Z3` *(PO: "op termijn")*
Match Ref 2: header, "Callsheet — {project}", meta; per period: location block, tijdschema with times, medewerkers table (naam, functie, van, tot, telefoon). Printable route `/projects/[id]/callsheet`.
- **Accept:** all periods render with crew, functie, phone.

### B6. Cost breakdown: materials vs people `M` `P1` `deps: Z2`
Extend `ProjectCostsTab` (154 lines — extract subcomponents): per-period + project-level subtotals Personen/Materialen + grand total. Extend `src/lib/pricing.ts` + vitest tests.
- **Accept:** costs tab and print view show per-kind subtotals per period and per project.

### B7. Period start/end times `L` `P1` `deps: Z1 — includes a DATA migration (not schema DDL)`
Schema stores DateTime, but this is **not** UI-only (review-verified):
- **Data normalization:** legacy periods end at midnight; a timed booking (e.g. from 14-05 10:00) would no longer overlap a period ending `14-05T00:00` — the last day silently unblocks. One-off migration + seed change: legacy `endDate` → 23:59:59 same day.
- **Boundary convention (decided Q16):** back-to-back periods do NOT conflict — overlap comparison becomes strict at the boundary (`startDate lt to && endDate gt from` in `src/lib/availability.ts:22-25,46-49`), so end 12:00 / start 12:00 allows direct re-booking. Vitest cases: touching boundaries (no conflict), 1-minute overlap (conflict), legacy full-day periods post-normalization (still block their full last day).
- **Timezone spec:** client submits full ISO strings **with offset** (from `datetime-local` values via date-fns local formatting); never send bare `yyyy-MM-ddTHH:mm` (parses server-local: UTC in Docker vs Brussels in dev). Display via local `format(d, "dd-MM-yyyy HH:mm")` — never `toISOString().slice(...)` (`period-form.tsx:34-36` pattern must go).
- **Call-site sweep (enumerated):** `planning/page.tsx:50` day bucketing (startOfDay/endOfDay normalization), `project-periods-tab.tsx:55-62` timeline range, `period-form.tsx:58-60` out-of-range warning (project dates stay date-only midnight — compare against endOfDay of project end), `pricing.ts:16-19` calendar-day count (regression tests: end 23:59 vs 00:00 next day must not shift billed days).
- UI: `datetime-local` inputs in period form; times shown in period lists, timelines, planning, documents.
- **Accept:** period 10:00–18:00 entered in Brussels round-trips identically on a UTC server; legacy full-day periods still block their full last day; pricing unchanged for migrated periods (vitest); planning shows a Monday-10:00 project in Monday's column.

---

## Workstream C — Planning

### C1. Clickable calendar items `S` `P1` `no deps`
Calendar items open a `Popover` (project name, client, location, status, period dates, 👥/📦 counts, "Naar project →" link). Week-summary rows also link.
- **Accept:** popover opens on click; link navigates to detail.

---

## Workstream D — People

### D1. Functions as shared entities — M2M `L` `P1` `deps: Z1`
`Function { id, name }` + `PersonFunction { personId, functionId }` (decided M2M). `PeriodPerson.role` becomes a combobox pre-filled from the person's functies. Backfill distinct `Person.role` → Functions + links; `seed.ts`.
- API: `GET/POST /api/functions`, `PUT/DELETE /api/functions/[id]`; PersonForm multi-select combobox with inline create.
- **Accept:** two people share one functie; rename updates both; booking picks one of the person's functies.

### D2. Person addresses `S` `P1` `deps: Z1`
`address?, postalCode?, city?, country?` on `Person` (both schemas + migration + seed); PersonForm + detail display.
- **Accept:** address editable and visible.

### D3. Certificate (attest) PDF uploads `M` `P2` `deps: Z1` `✓ storage decided (Q5: in DB)`
`PersonDocument { id, personId, filename, label, mimeType, sizeBytes, data Bytes, createdAt, expiresAt? }` — **file bytes stored in the database** (decided: quick and working; no Docker volume, no cicd work). Enforce `application/pdf` + 10 MB in the handler (no default body cap in Next 16).
- **Storage abstraction:** all read/write goes through `src/lib/documents.ts` (store/retrieve/delete by id) so the backend can swap to disk/S3 later without touching routes or UI. List queries must `select` metadata only — never pull `data` into list payloads.
- API: `POST /api/people/[id]/documents` (multipart), `GET /api/documents/[id]` (auth-checked stream with correct Content-Type/Disposition), `DELETE /api/documents/[id]`.
- UI: documents section on person detail (upload/list/download/delete, expiry badge).
- **Accept:** upload→list→download works; non-PDF and >10 MB rejected; person list/detail queries don't fetch blob data; file survives container restart (it's in Postgres).

---

## Workstream E — Materials

### E1. Category as entity with create-on-the-fly `M` `P1` `deps: Z1`
`Category { id, name, prefix }`; `Material.categoryId Int?`. Backfill normalizes composite strings (strip `" - {type}"` or re-derive from code prefix; bare `"Fysiek item"` → no category). Keep legacy string until verified; `seed.ts`.
- MaterialForm combobox + inline "+ Nieuwe categorie" (name + prefix); MaterialsTreePane groups by relation.
- **Accept:** pick-or-create inline; tree groups correctly; 14 legacy composites collapse cleanly.

### E2. Inline quick-edit in material detail pane `M` `P1` `no deps`
Dagprijs, category, notes click-to-edit in `MaterialDetailPane` (PO: "beneden bepaalde dingen onmiddellijk aanpassen"). PUT per field, optimistic.
- **Accept:** dagprijs changed in ≤2 clicks without MaterialForm.

### E3. Auto-generated material codes `M` `P1` `deps: E1, Z2`
`Material.code String? @unique`; rule `{prefix}01-{next seq}` (decided), server-side on create, editable, stable across category changes.
- **Migration hazard:** dedupe `9998-902` + malformed codes deterministically (first keeps code; duplicates get next free seq; log) **before** adding the unique index — a failed index bricks `migrate deploy`. `seed.ts` writes the column. Vitest for the generator.
- **Accept:** new Meubilair material gets next free `04xx-xxx`; codes unique; dedupe documented.

### E4. Barcode / QR generation `M` `P2` `deps: E3`
Code 128 + QR on the detail pane. QR payload = **deep-link URL** (decided Q7), barcode = raw code. Smallest maintained lib (`bwip-js` / `jsbarcode` + `qrcode`).
- **Accept:** codes render; phone-scanning the QR opens the material page.

### E5. Printable material label `M` `P3` `⛔ blocked on Q8 (label format/printer)`
Label: name, code, category, barcode/QR; print CSS per PO's format answer.
- **Accept:** print preview shows correctly sized label.

### E6. Bundles / sets `XL` `P2` `deps: E1, Z2; critical booking logic; design doc first`
Bookable sets (tafel + hoes). **Worker writes `.plans/e6-bundles-design.md` for approval before implementing.** Review-verified model requirements the design must satisfy:
- Recipe: `MaterialComponent { parentId, childId, quantity }` alone is **insufficient** — virtual bundles have no StockItems (no row for the parent's price snapshot) and nothing ties component assignments to a bundle *instance* (pakbon can't nest; unbooking can't find components). Design must add a booking-side model, e.g. `PeriodBundleBooking { id, periodId, materialId, dayPriceSnapshot, ... }` + nullable `PeriodStockItem.bundleBookingId`.
- Booking must use an **interactive `prisma.$transaction` with the availability re-check inside** — the current flow checks before the transaction (TOCTOU race, multiplied by N components). Note SQLite (dev) vs Postgres (prod) isolation differences in the test plan.
- Availability of a bundle = min over components; **pricing (decided Q15):** bundle price defaults to the sum of component prices, with a manual override per bundle (override field nullable; null = live sum). Components render €0 within the set on cost views/pakbon.
- Extra tests on `src/lib/availability.ts`.
- **Accept (v1):** define a bundle in materials UI; booking reserves component stock atomically with conflict re-check; unbooking removes the whole instance; flat bookings unchanged; pricing per Q15 decision.

---

## Workstream F — Users, roles & settings

### F1. Roles ADMIN/PLANNER/VIEWER + enforcement `L` `P1` `deps: Z2`
Role stays `String` (TS union + Zod). Migrate `"admin"`→`ADMIN`, `"user"`→`PLANNER`, **and flip the column `@default` to `"PLANNER"`** (schema.prisma:15) so future create paths can't mint a legacy role.
- **Intended ability loss (explicit):** today a `"user"` can manage users (`/api/users/*` has no role check) — after F1, PLANNER loses that. This is the point, but say so in the changelog.
- **Token work:** add `role` to `TokenPayload`/`signToken`/login; `requireRole()` falls back to DB lookup for pre-migration cookies (7-day lifetime) or forces re-login.
- **Close holes:** disable `/api/auth/register` (login page loses the link); `/api/users/*` + `/settings` ADMIN-only; no self-promotion; document production ADMIN bootstrap (env-seeded first admin).
- Matrix v1: mutations = ADMIN/PLANNER; users/settings = ADMIN; reads = any authenticated. UI hides per role (server authoritative).
- **Accept:** migrated `"user"` account: 200 on POST `/api/projects`, 403 on PATCH `/api/users/[id]`; VIEWER 403 on POST `/api/projects`; register disabled; stale token still resolves a role; Gebruikers nav hidden for non-admin.

### F2. Per-user permission overrides `M` `P4` `deps: F1` — parked (PO: "eventuele rechten")

### F3. Link Person ↔ User `M` `P2` `deps: D1, F1` `✓ decided (Q10) — pulled to phase 3`
Simple account link: `User.personId Int? @unique` (both schemas + migration + seed). Rights stay role-based (F1) — functie does NOT drive permissions. UserForm gets an optional person-combobox; user table shows the linked person.
- Groundwork for later "eigen planning / eigen documenten" views — those are separate future items.
- **Accept:** admin links/unlinks a user to a person; a person can back exactly one account; nothing changes in what the user may do (role decides).

### F4. Settings page `M` `P1` `deps: Z1`
`/settings` (ADMIN-only once F1 lands) + `Setting` key-value model (both schemas + seed). v1: company info for documents (name, address, phone, VAT, IBAN) **plus logo upload (decided Q11)** — logo bytes stored in DB via the same abstraction as D3 (image type, size-capped, served via an auth-exempt-safe route for print views). API: `GET/PUT /api/settings`.
- **Accept:** company info + logo editable; pakbon header renders both from settings.

---

## Workstream G — Smartphone (decided scope)

### G1. PWA installability `S` `P1` `no deps`
Next 16 file convention: `src/app/manifest.ts` → `/manifest.webmanifest` (see `node_modules/next/dist/docs/.../metadata/manifest.md`) + icons + theme colour. **Must add manifest/icon paths to `proxy.ts` public matcher** (`src/proxy.ts:29`) — currently they'd 307 to `/login` and installability fails.
- **Accept (worker-verifiable):** unauthenticated `curl /manifest.webmanifest` → 200 valid JSON (name/icons/start_url/display); each icon URL → 200. Manual PO check: install prompt on phone.

### G2. Camera barcode/QR scanning `M` `P3` `deps: E4 (sequencing, not PO-blocked)`
QR deep-link works via the native camera app; in-app scanner via `BarcodeDetector` with library fallback for Code128.
- **Accept:** scanning a printed label on a phone lands on the material detail page.

---

## Execution order

| Phase | Items | Notes |
|---|---|---|
| 0 — unblock | Z1 | Dev DB workflow before any schema/data work |
| 1 — quick wins | A1, B3, C1, E2, Z2, Z3, G1 | Truly schema-free; parallel-safe |
| 2 — foundations | **DDL commit 1** (B1+B2+D1+D2+E1+F4 models + B7 data migration) → then B1, B2, B7, D1, D2, E1, F4 feature work in parallel | B7 moved here: it ships a data migration |
| 3 — codes, RBAC, bundles | **DDL order: E3 first, then F3 (`User.personId`), then E6 (after design-doc approval)**; E3, B6, F1, F3 in parallel where deps allow; E6 follows | E6 is XL — expect multiple worker sessions |
| 4 — documents & uploads | B4a (flat pakbon — no E6 dep), E4, D3 | PO's #1 ask ships here regardless of E6 status |
| 5 — later / blocked | B4b (E6), B5, E5 (⛔Q8), G2, F2 | "Op termijn" + the one parked question |

Parallelisation rule: within a phase, **only one worker touches `prisma/schema*.prisma` + migrations**; that commit lands first.

---

## Remaining open questions for PO

- **Q8 (E5) ⛔:** Welk labelformaat/printer voor materiaallabels — labelrol (bv. Brother 62 mm) of A4 stickervellen? *(Blocks only E5; everything else proceeds.)*

All other questions (Q1, Q5, Q7, Q10, Q11, Q14, Q15, Q16) were resolved on 2026-07-10 — see the decisions table at the top.
