# Phase 2 — PO items 1, 3 and 7: hours, rates, material import, cost document

> Read `00-README.md` first. Source decisions: `.plans/2026-08-po-feedback-round2.md` (Q17–Q19, Q30–Q33, Q34b, Q36a–c, Q22).
> **v2 — two adversarial review rounds folded in (10 findings, 1 high-severity compile break).**
> 9 items + 1 DDL commit, ~29 commits.
> **Gate to start:** phase 1 merged · **PO has retested H3/H4/J1 from phase 0** (the cheap fixes may already cover much of item 1).

## Order

```
DDL-2 (alone, first)
  ├─► L1 (function rates) ──► L2 (function at booking) ──► L3 (client rate cards)
  ├─► H1 (hours per booking) ──► H2 (overlap override)
  │        └─► H5/L5 (hourly billing)  [needs L1's rates + H1's windows]
  ├─► M1 (material import)              [independent]
  └─► J2a (cost document)               [independent]
```

**One worker owns `src/lib/pricing.ts`** for H5/L5. **One worker owns `src/lib/availability.ts`** for H1/H2. `src/lib/effective-price.ts` is owned by whoever does L1→L2→L3 — keep that chain with a single worker, since L3 slots into the resolution order L1 defines.

## Inherited obligations from phase 1

Phase 1 built a redaction layer and a guard test. Everything added here must satisfy them:

1. **Every new route needs a `requireModule(...)` guard** or N2.5's enumeration test fails. New routes in this phase: `functions` management additions, `clients/[id]/rates` (L3), the import endpoints (M1).
2. **Every new money field must be added to `src/lib/redact.ts`** (built in N2.1): `Function.dayRate`, `Function.hourRate`, `PersonFunction.dayRate/hourRate`, `ClientFunctionRate.dayRate/hourRate`, `Material.costPrice`, `Material.listPrice`, `Material.revenueBefore`, `StockItem.costPrice`, and the new rate snapshot on `PeriodPerson`. A freelancer with `Kosten/Facturen: geen` must not receive any of them.
3. **Resolve the `TODO(L1)` markers** left at `src/app/api/functions/route.ts` and `functions/[id]/route.ts` in N2.3 — that is L1.1's job.
4. **Every new money field must go through Y1's serializer** — never return a raw `Decimal`.

---

## DDL-2 — the shared migration `lands alone, first`

**Branch:** `ddl2-hours-rates-materials` · **one commit**

**`feat(db): add booking hours, function rates and material cost fields`**

Both `prisma/schema.prisma` (Decimal money) **and** `prisma/schema.dev.prisma` (Float money), plus `prisma/seed.ts`.

| Model | Change | For |
|---|---|---|
| `PeriodPerson` | `startAt DateTime?`, `endAt DateTime?` | H1 — null means "inherit the period window" |
| `PeriodPerson` | `overlapAck Boolean @default(false)` | H2 — marks a deliberately forced double booking |
| `PeriodPerson` | `functionId Int?` + relation to `Function` | L2 |
| `PeriodPerson` | `billingUnit String @default("dag")`, `rateSnapshot Decimal?` | H5/L5 — `dag`\|`uur`; `rateSnapshot` is the unit rate actually charged |
| `Function` | `dayRate Decimal?`, `hourRate Decimal?` | L1 — the company default |
| `PersonFunction` | `dayRate Decimal?`, `hourRate Decimal?` | L1 — the per-person override |
| `ClientFunctionRate` | **new**: `id, clientId, functionId, dayRate Decimal?, hourRate Decimal?, @@unique([clientId, functionId])` | L3 |
| `Material` | `archived Boolean @default(false)`, `costPrice Decimal?`, `listPrice Decimal?`, `revenueBefore Decimal?` | M1 + K4 |
| `StockItem` | `costPrice Decimal?` | K4 — optional per-unit override |
| **Inverse relation fields (mandatory)** | `Function.assignments PeriodPerson[]`, `Function.clientRates ClientFunctionRate[]`, `Client.functionRates ClientFunctionRate[]` | Prisma **fails schema validation** without the other side of each relation. `Function` today has only `id, name, people` (`prisma/schema.prisma:46-50`), so all three are new. Omitting them makes DDL-2's own `npm run db:dev:reset` verification fail. |

- `@@unique([periodId, personId])` on `PeriodPerson` **stays** (Q17 chose one window per person per period, not the shift model). Do not touch it.
- Keep `dayPriceSnapshot` as-is. `rateSnapshot` + `billingUnit` are additive so existing rows keep working; H5 decides the read precedence.
- **`src/types/index.ts` is this commit's responsibility too.** It is a hand-maintained mirror, not generated (`PeriodPerson` at `:196-206`). Add `startAt`, `endAt`, `overlapAck`, `functionId`, `billingUnit`, `rateSnapshot`, the `Function` rate fields, `ClientFunctionRate`, and the `Material`/`StockItem` additions here — otherwise H1.3, H2.2, L2.2 and H5.1 each guess which of them owns it.
- **Extract the CSV parsing helper out of `prisma/seed.ts` in this commit.** M1.1 is told to reuse the header-detection and dedup logic at `seed.ts:98-259`, but `seed.ts` belongs to the DDL owner (one-owner rule) — so the DDL worker moves that logic into `src/lib/` and makes `seed.ts` call it. M1.1 then only imports it and never edits the seed. Copy-pasting instead would duplicate exactly what this plan forbids elsewhere.
- Seed: give at least one seeded function a `hourRate`, give **one person two functions at different rates** (seed currently maps 1:1, `prisma/seed.ts:316-325`, so multi-function UI is otherwise untested), add one `ClientFunctionRate` row, and set `costPrice`/`revenueBefore` on a couple of materials so K4 has data in phase 3.
- **No behaviour change** — nothing reads the new columns yet.
- **Verify:** `npm run db:dev:reset` succeeds; `docker compose run --rm app sh -c "npx prisma migrate deploy"` applies cleanly against Postgres; existing bookings unaffected.

**DDL rollback protocol:** if this migration must change after feature workers have branched, issue a **new forward migration** and announce it. Never edit an applied migration. No feature worker starts before this commit is merged.

---

## L1 — Rates on functions

**Branch:** `l1-function-rates` · **first in the L chain**

### Current state (verified)

- `Function` is name-only (`prisma/schema.prisma:46-50`); `PersonFunction` a bare junction (`:52-59`). Neither is read by the booking flow, `effective-price.ts`, availability, or the callsheet.
- Price resolution today: project override → `Person.dayPrice` → 0 (`src/lib/effective-price.ts:12-19`), **duplicated** inline at `src/app/api/people/available/route.ts:34-37` and client-side at `src/components/line-price-popover.tsx:42`.
- `src/app/api/people/route.ts` and `[id]/route.ts` have **no zod schema** — the only routes of their kind without one.
- `PUT /api/people/[id]` replaces the whole function set with `deleteMany: {} + create` (`[id]/route.ts:12-62`).
- No functions management page exists; functions are created only inline from the person form (`src/components/person-form.tsx:93-97`).

### Decided resolution order (Q30 + Q32b)

```
ProjectPersonPrice override
  → ClientFunctionRate (L3)
  → PersonFunction rate
  → Function default
  → Person.dayPrice
  → 0
```

### Commits

**L1.1 — `fix(people): stop wiping person functions on every save`** ← **must come before the rate columns are used**
- `PUT /api/people/[id]` currently does `deleteMany: {} + create`, which would **destroy every per-person rate row on any person save** once L1 puts rates on `PersonFunction`. Convert to a diff (add/remove only what changed).
- Add the missing zod schemas to `people/route.ts` and `people/[id]/route.ts` while you are there — same commit is acceptable since both are input validation on the same endpoints.
- Also resolve the `TODO(L1)` markers from phase 1: `functions/*` keeps its Personen module but **redacts `dayRate`/`hourRate`** for callers without `Kosten/Facturen: lezen` (via `src/lib/redact.ts`).
- **Verify:** a person save preserves rate rows; a `Kosten/Facturen: geen` caller gets functions without rates.

**L1.2 — `feat(pricing): resolve rates through one function-aware path`**
- Rewrite `src/lib/effective-price.ts` to implement the order above and return **both the amount and its source level** (`"project" | "client" | "person-function" | "function" | "person" | "none"`). With five levels, an unexplained number is a support call.
- **Update the four real callers in this same commit, or the build breaks.** `effectivePersonPrice`/`effectiveMaterialPrice` are called at `src/app/api/periods/[id]/people/route.ts:52`, `periods/[id]/people/[assignmentId]/route.ts:22`, `periods/[id]/materials/route.ts:51`, and `periods/[id]/materials/[assignmentId]/route.ts:22` — each assigns the result straight into a Decimal-typed `dayPriceSnapshot`. Returning `{ amount, source }` without touching them leaves `tsc --noEmit` failing and every person/material booking broken for several commits. Either destructure `.amount` at all four sites here, or keep a thin number-returning wrapper until L2.2.
- **There are three copies of the resolution logic, not two.** Besides the inline duplicates at `people/available/route.ts:34-37` and `line-price-popover.tsx:42`, `src/lib/pricing.ts:6-24` exports `effectiveMaterialPriceFromProject` and `effectivePersonPriceFromProject` — a client-side reimplementation. Reconcile all three onto one mechanism (server) plus, if the client genuinely needs it, one clearly-named client helper that mirrors it and is covered by the same tests.
- **Historical protection (required):** existing `dayPriceSnapshot` values were frozen under the old order. This commit must not recompute them. Add a regression test asserting a seeded historical booking's cost is byte-identical before and after.
- **Verify:** unit tests at every level, including "no rate anywhere → 0" and "project override beats everything".

**L1.3 — `feat(people): manage functions and their rates`**
- A functions management page (there is none today) plus rate fields: day and hour rate per function, and a per-person override on the person form's function chips.
- Both rate inputs optional — a function with no hour rate falls back to day billing (Q19).
- Gate on the right module + redact rates per L1.1.

**L1.4 — `test(pricing): cover the five-level resolution order`**
- Every level, every fallback, plus the source label. This test is the contract L3 extends.

**Out of scope:** using the rates at booking time (L2), hourly quantity maths (H5/L5).

---

## L2 — Pick the function at booking time

**Branch:** `l2-booking-function` · **after L1**

### Current state

Booking silently copies `p.person.role` into the assignment: `src/components/person-split-editor.tsx:151` sends `role: p.person.role ?? undefined`. There is **no function picker anywhere**. The printed callsheet's column headed "Functie" renders that legacy free-text field (`src/app/(app)/projects/[id]/callsheet/page.tsx:109`). `PATCH /api/periods/[id]/people/[assignmentId]` accepts a `role` string (`:26`) that no UI ever sends.

**L2.1 — `feat(bookings): record the chosen function on an assignment`**
- Write `PeriodPerson.functionId` on create; keep `role` as a display fallback for now (L4 retires it in phase 4).
- **Backfill** existing assignments by exact name match against `Function.name` — clean in seed data (1:1, `seed.ts:316-325`), but real data may not match. **Log every unmatched row rather than guessing**, and report the count.

**L2.2 — `feat(bookings): choose a function when booking a person`**
- Picker in the booking flow: default to the person's only function; when they have several, require a choice. Show the resolved rate **and its source** (from L1.2) before confirming.
- Snapshot behaviour must match the existing convention (`src/app/api/periods/[id]/people/route.ts:52` sets `dayPriceSnapshot` from `effectivePersonPrice`).
- `person-split-editor.tsx` was split in phase 0 (Y3.3) — extend the extracted component, do not re-inflate the parent.

**L2.3 — `feat(documents): print the chosen function on the callsheet`**
- `callsheet/page.tsx:109` reads from the relation instead of the legacy string, falling back to `role` only where `functionId` is null (pre-backfill rows).

---

## L3 — Client rate cards

**Branch:** `l3-client-rates` · **after L2**

`Client` links only to `Project` (`prisma/schema.prisma:32`); nothing client→function exists today. Q32 chose a rate card that **both filters the picker and prices it**.

**L3.1 — `feat(clients): manage per-client function rates`**
- CRUD on `ClientFunctionRate` from the client detail page: add function, set day/hour rate, remove.
- API: `GET/POST /api/clients/[id]/rates`, `PUT/DELETE /api/clients/[id]/rates/[functionId]` — module **Kosten/Facturen** (these are commercial terms), and add them to N2.5's guard coverage.

**L3.2 — `feat(bookings): scope the function picker to the client's rate card`**
- On a project for a client with rate-card rows, the picker offers **only** those functions.
- **Critical fallback:** a client with **no** rate-card rows must show **all** functions, not none — otherwise creating a new client breaks booking entirely. Test this explicitly.

**L3.3 — `feat(pricing): apply client rates above the person override`**
- Slot `ClientFunctionRate` into `effective-price.ts` between the project override and the person-function rate (Q32b: the client card wins). Extend L1.4's tests to all five levels with the client level populated.
- **Verify:** booking a person on a prg project charges prg's agreed rate even when that person has their own higher rate; the source label reads `"client"`.

---

## H1 — Assignment-level time windows `critical booking logic`

**Branch:** `h1-assignment-hours` · **owns `src/lib/availability.ts`**

### Current state

- Overlap detection is already strict: `AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }]` (`src/lib/availability.ts:92`; same shape at `:28,65,125`). Back-to-back periods do not conflict — round-1 Q16, tested at `src/lib/availability.test.ts:29-64`.
- A person is booked **per period**, so a Mon–Fri period books them solid.
- `POST /api/periods/[id]/people` does check-then-create with **no transaction and no `P2002` catch** (`src/app/api/periods/[id]/people/route.ts:24-47`), unlike the material path which uses `$transaction` + pg advisory locks (`src/lib/booking.ts:34,61,120`). A lost race surfaces as a raw 500.

**H1.1 — `feat(bookings): compare availability against the assignment window`**
- Add `effectiveWindow(assignment)` returning the assignment's `startAt`/`endAt` when set, else the period's. Make `checkPersonAvailability` (`availability.ts:85-96`) compare against it.
- Keep the strict `lt`/`gt` boundary — it is already correct and tested. Do not touch the stock/bundle paths.
- Validate server-side: the window must fall inside its period and `endAt > startAt`.
- **Update `src/lib/availability.test.ts` in this commit, not in H1.4.** The existing tests mock `periodPerson.findFirst` against the current period-level `AND` filter shape (`availability.test.ts:29-76`). Changing the query shape here while deferring the test rewrite to H1.4 leaves `npm test` red for three commits, violating the green-at-every-commit rule. H1.4 then *adds* the new window cases on top.

**H1.2 — `fix(bookings): book a person inside a transaction`**
- Wrap check-then-create in an interactive `$transaction` with the availability re-check **inside**, mirroring `src/lib/booking.ts:61,120`. Catch `P2002` → `conflict()` as the material route does (`src/app/api/periods/[id]/materials/route.ts:46,65`).
- This is a pre-existing race, fixed here because H1 makes the window finer and the race likelier.

**H1.3 — `feat(bookings): set custom hours on an assignment`**
- **Fix the silent dead end while you are here.** `src/components/person-split-editor.tsx:36-39,44` hides anyone already in `period.people` from the available list with no explanation. Since the unique constraint stays (one window per person per period), a user trying to give an already-booked person a second window in the same period hits a wall with no message — and the API's informative `conflict("… staat al toegewezen aan deze periode")` (`src/app/api/periods/[id]/people/route.ts:26-28`) is never reached because the client filters the request away. Show the person as a **disabled row with an explanation** ("al toegewezen — pas de uren aan op de bestaande boeking") instead of removing them silently.
- Optional "eigen uren" on the assignment row (extend the phase-0 split components). Show the window in `src/components/period-bookings.tsx:52` and on the callsheet.
- **Apply the Time rule:** these are the first datetime fields written from a per-assignment form. Send full ISO strings with offset; never `.slice(0, 10)`; never bare `yyyy-MM-ddTHH:mm`. **Verify against Postgres, not SQLite**: a Brussels 18:00–23:00 window must round-trip identically on a UTC server and must not shift when read back into a `datetime-local` input. Record the round-trip evidence in the commit body.

**H1.4 — `test(availability): cover assignment windows`**
- Same-day non-overlapping windows allowed; 1-minute overlap blocked; touching boundaries allowed; a window narrower than the period frees the rest of the day; **null window behaves exactly as today** (regression); the transaction re-check rejects a racing double-insert.

---

## H2 — Explicit double-booking override

**Branch:** `h2-overlap-override` · **after H1**

**H2.1 — `feat(bookings): allow a confirmed double booking`**
- `POST /api/periods/[id]/people` accepts `allowOverlap: true`; without it an overlap is still refused. Persist `overlapAck = true`. **The API must refuse without the flag** — never let the client be the only gate.
- Confirm dialog naming the conflicting project and window.

**H2.2 — `feat(bookings): flag forced double bookings everywhere`**
- Badge on the assignment row, in `period-bookings.tsx`, and on the callsheet. Planning surfaces it in phase 3 (I3).
- **Verify:** an overlapping booking is refused by default, accepted after confirmation, and visibly marked wherever that person appears.

---

## H5/L5 — Hourly billing

**Branch:** `h5-hourly-billing` · **after H1 + L1** · **owns `src/lib/pricing.ts`**

Today any window bills a full day: `periodDays` is `differenceInCalendarDays + 1` floored at 1 (`src/lib/pricing.ts:26-35`) and `personLineCost` is `snapshot × days` (`:58-60`). Time of day is never read.

**H5.1 — `feat(pricing): bill person lines per hour or per day`**
- Read `billingUnit` + `rateSnapshot` from the assignment. For `uur`, derive hours from the effective window (H1); for `dag`, keep today's calendar-day maths exactly.
- **Keep the signature `personLineCost(line, days)`** — `line` is the assignment, so it already carries the unit, the rate and the window after DDL-2. The three call sites (`src/components/person-split-editor.tsx:209`, `period-bookings.tsx:66`, `project-costs-tab.tsx:139`) then need no change, which is what makes the byte-identical guarantee achievable.
- **Precedence for the rate:** `rateSnapshot ?? dayPriceSnapshot`. Every existing row has `rateSnapshot = null`, so historical lines keep using `dayPriceSnapshot` and produce identical figures. Never backfill `rateSnapshot`.
- **Fallback (Q19):** if the resolved function has no hour rate, bill a full day — and make the UI say so rather than silently charging a day for three hours.
- Round consistently with the existing helpers (cents at each step — do not "improve" the rounding strategy here).

**H5.2 — `feat(bookings): choose the billing unit when booking`**
- Unit selector next to the function picker (L2.2); snapshot the unit and the resolved rate.

**H5.3 — `test(pricing): cover hourly billing and day-rate regressions`**
- A 4-hour evening assignment at an hourly rate bills 4 × hour rate; a function without an hour rate still bills a day; **every existing day-billed figure is byte-identical** (this is the regression that protects historical projects).

---

## M1 — Material import

**Branch:** `m1-material-import` · independent · ⛔ **prefer `.plans/data-import-export-design.md` approved first** (it defines the shared parse→preview→apply pipeline that P3 reuses in phase 4; M1 may proceed without it if the design doc slips, but then P3 must adopt M1's shape rather than the reverse)

### The files (verified 2026-08-14)

Converted CSVs and a working stdlib converter live in `.plans/tools/`. Both exports share an identical 82-column layout; the content does not.

| | "normal" (`Export_Equipment_20260814.xlsx`) | "advanced" (`… (1).xlsx`) |
|---|---|---|
| Rows / unique IDs / unique codes | 113 / 104 / 103 | 287 / 287 / 287 |
| Type | 109 Physical item, 1 Physical combination, 3 Virtual combination | **287 Physical combination** |
| Archived | 0 for all | **1 for all** |
| Price | 4 zero, max €15 000 | **0 for all** |
| Stock method | 16 Serialized, 97 Bulk | 287 Bulk |
| Codes | 111 × `NNNN-NNN`, 2 plain digits, **5 duplicates** incl. `9998-902` | 287 plain digits, no duplicates |
| Folder | 11 values (`0501-Tenten`, …) | empty |

The normal file's 103 codes are a **100% match** with `prisma/seed-data/materials.csv` — it is the same master, re-exported in English. Rows are a flattened **equipment × serial-number join**, so equipment repeats; dedupe on the export's `ID` column.

### Column mapping

| Source | Target | Notes |
|---|---|---|
| `Code` | `Material.code` (`@unique`) | 5 duplicates → dedupe deterministically before insert (round 1 already had to for `9998-902`); first wins, rest get the next free code via `src/lib/material-code.ts`, all logged |
| `Name (in database)` | `Material.name` | |
| `Folder (Folder)` `0501-Tenten` | `Category.prefix` `0501` + `Category.name` `Tenten` | 11 categories, auto-created (Q36b) |
| `Rental-/Sales price` | `Material.dayPrice` | 4 zero-priced rows |
| `Type of equipment` | `Material.isBundle` | "…combination" → true (4 rows). **The export has no component data** (`Combination structure` empty in both files) → bundles import as empty shells; their contents must be entered by hand. Say this in the import report. |
| `Stock calculation method` + `Current quantity` | `StockItem` rows | Serialized → one per serial row, `identifier` from `Manufacturer serial number (Serial number)`; Bulk → generate `Current quantity` units |
| `Internal remark` | `Material.notes` | 2 rows |
| `Archived` | `Material.archived` | the advanced file is 100% archived (Q34b) |
| purchase price, `List price` | `Material.costPrice`, `Material.listPrice` | Q36c — also the input for K4 payback |
| `ID` | import bookkeeping | the stable external key for deduping the serial join |
| everything else | **not imported** | declined (Q36c): dimensions, weight, volume, power, current, margin price, critical stock, ledger accounts, factor/discount groups, webshop fields, purchase date, book value |

### Commits

**M1.1 — `feat(import): parse equipment exports`**
- A parser producing normalised rows from `.xlsx` **and** `.csv`. Prefer no heavy dependency — the xlsx format is a zip of XML and a ~40-line stdlib reader handled both files during recon (`.plans/tools/xlsx-to-csv.py` is the proof); if you add a library, justify it in the commit body.
- Reuse the header-detection and dedup logic already in `prisma/seed.ts:98-259`.
- Pure function + unit tests against **both real files** in `.plans/tools/`. No DB writes in this commit.

**M1.2 — `feat(import): compute an import preview`**
- `POST /api/materials/import/preview` (module **Materialen: wijzigen**) returning per-row classification: `new` / `updated` / `unchanged` / `skipped` / `error`, each with the source line number and a reason, plus totals.
- Match on `code`, update existing (Q36a). Never write in this endpoint.

**M1.3 — `feat(materials): archive materials and hide them by default`** ← **do this before applying an import**
- `archived` is a new concept. The **complete** surface, verified by grepping `prisma.material.` and the material-consuming components — the earlier draft of this brief missed four of these:
  - `src/app/api/materials/route.ts` (the list)
  - `src/app/api/materials/available/route.ts` (booking availability)
  - `src/app/api/materials/[id]/components/route.ts` — **missed before**: the bundle-component picker would offer archived children
  - `src/app/api/periods/[id]/materials/route.ts` — **missed before**: booking an archived material must be refused, not merely hidden
  - `src/app/(app)/page.tsx` — **missed before**: the dashboard's "Materialen" stat counts the full list, so importing the advanced file would inflate it from ~103 to ~390
  - `src/app/(app)/materials/labels/page.tsx`, `src/components/materials-tree-pane.tsx`, `materials-filter-bar.tsx`, `material-split-editor.tsx`, `stock-items-sheet.tsx`, `src/hooks/use-materials.ts`, `use-bundle-editor.ts`
  - forward: K4's payback lists (phase 3)
- **Missing one puts 287 archived flightcases in a booking dropdown or a dashboard count.** Enumerate what you covered in the commit body.

**M1.4 — `feat(import): apply an import`**
- `POST /api/materials/import` (module **Materialen: wijzigen**, same as the preview — state the guard explicitly so N2.5's enumeration test passes) — one transaction, auto-creating categories, generating stock items, honouring `archived`.
- **Never let one bad row abort the file**; collect and report skipped rows.
- Must not touch existing bookings' snapshots.

**M1.5 — `feat(materials): import screen with preview and confirm`**
- Upload → preview table → confirm. The preview is mandatory (Q36b); there is no direct-apply path.

**M1.6 — `test(import): cover the real export files`**
- Import the normal file into a seeded DB: 103 materials, 11 categories, correct prices and stock counts, the 5 duplicate codes reported without failing. Import the advanced file: 287 archived, hidden from the tree and the booking picker. Re-import both: no duplicate categories, no duplicate materials.

---

## J2a — Make the cost print a document

**Branch:** `j2a-cost-document` · independent · skill: `design`

`src/components/project-costs-tab.tsx`'s print view (`:71-79`) does **not** use `DocumentHeader`, so unlike the pakbon and callsheet it prints with no company name, address, BTW number, IBAN or logo. This is the literal answer to "facturen moeten properder", and it ships before the real invoice entity (J2b, phase 3).

**J2a.1 — `feat(documents): printable cost overview with company and client details`**
- New printable route `/projects/[id]/kosten` reusing `PrintLayout` + `DocumentHeader` (`src/components/print/`).
- Add the client billing block — `Client` already has `address`, `postalCode`, `city`, `vatNumber` (`prisma/schema.prisma:21-33`), but only the name is passed into `meta` today (`document-header.tsx:74-106`).
- Include the project number (= id, round-1 Z3) and the date. Travel lines sit outside the subtotal per phase 0's J1.
- ⚠️ **`DocumentHeader` fetches `/api/settings`**, which phase 1 gated at `Instellingen: lezen` (N2 subtlety 3). Whoever must print needs that access — verify with a non-admin role and, if it fails, say so in the report rather than loosening the guard.

**J2a.2 — `feat(documents): print styling for the cost overview`**
- Clean line/subtotal/BTW/total typography; no interactive controls (discount popovers, price editors) bleeding into print. Print CSS consolidation is J3 in phase 3 — do not do it here, but do not add a fourth stylesheet either: reuse `PrintLayout`'s.

---

## Phase 2 exit report

1. Branch + commit list per item.
2. **Postgres round-trip evidence for H1.3** (Brussels hours on a UTC server) — or an explicit statement it could not be run.
3. The L2.1 backfill result: how many assignments matched a function by name, and the list of unmatched ones for the PO to map.
4. The M1.6 import result against both real files, including the 5 duplicate codes and the 4 bundle shells needing manual contents.
5. Confirmation that all new money fields were added to `src/lib/redact.ts` and that N2.5's guard test still passes with the new routes.
6. Confirmation that day-billed figures are unchanged (H5.3's regression) and that historical snapshots were not recomputed (L1.2).
7. For the PO to check: book yourself 08:00–17:00 on one project and 18:00–23:00 on another the same day; force a deliberate double booking and confirm it is flagged; import the equipment file and confirm the archived flightcases stay hidden.
