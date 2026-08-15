# Phase 2 exit report

All of phase 2 (items 1, 3, 7 — DDL-2, H1/H2, L1-L3, M1, J2a) is merged onto
`main` via fast-forward, branch by branch. `npx tsc --noEmit`, `npm run lint`,
and `npm test` are green on `main` at HEAD (**423 passed, 3 todo, 35 test
files**).

## 1. Branch + commit list per item

| Item | Branch | Commits (oldest → newest) |
|---|---|---|
| DDL-2 | `ddl2-hours-rates-materials` | `543e59a` feat(db): add booking hours, function rates and material cost fields |
| L1 — function rates | `l1-function-rates` | `12c7b9f` fix(people): stop wiping person functions on every save · `0f45b89` feat(pricing): resolve rates through one function-aware path · `099498f` feat(people): manage functions and their rates · `a77cb10` test(pricing): cover the five-level resolution order |
| L2 — booking a function | `l2-booking-function` | `eace02e` feat(bookings): record the chosen function on an assignment (L2.1 + backfill) · `d9caffa` feat(bookings): choose a function when booking a person (L2.2) · `79748f6` feat(documents): print the chosen function on the callsheet (L2.3) |
| L3 — client rate cards | `l3-client-rates` | `c19fe1b` feat(clients): manage per-client function rates (L3.1) · `9559274` feat(bookings): scope the function picker to the client's rate card (L3.2) · `14b6bb7` feat(pricing): apply client rates above the person override (L3.3) |
| H1 — assignment hours | `h1-assignment-hours` | `adb429d` feat(bookings): compare availability against the assignment window (H1.1) · `50fadfa` fix(bookings): book a person inside a transaction (H1.2) · `d954f9c` feat(bookings): set custom hours on an assignment (H1.3) · `bf55259` test(availability): cover assignment windows (H1.4) |
| H2 — overlap override | `h2-overlap-override` | `0f8c24e` feat(bookings): allow a confirmed double booking (H2.1) · `46ba387` feat(bookings): flag forced double bookings everywhere (H2.2) |
| H5/L5 — hourly billing | `h5-hourly-billing` | `c052ae3` feat(pricing): bill person lines per hour or per day (H5.1) · `69b56df` feat(bookings): choose the billing unit when booking (H5.2) · `0259212` test(pricing): cover hourly billing and day-rate regressions (H5.3) |
| J2a — cost print document | `j2a-cost-document` | `6f6a9a8` feat(documents): printable cost overview with company and client details |
| M1 — material import | `m1-material-import` | `d455b69` fix(materials): use the full category prefix in generated codes (nextCode fix) · `65b6542` feat(import): parse equipment exports (M1.1) · `33090d6` feat(import): compute an import preview (M1.2) · `a8af82c` feat(materials): archive materials and hide them by default (M1.3) · `4c0de81` feat(import): apply an import (M1.4) · `7fe9cff` feat(materials): import screen with preview and confirm (M1.5) · `1c73b8b` test(import): cover the real export files (M1.6) |

## 2. Postgres round-trip evidence for H1.3 (Brussels hours on a UTC server)

**Not run.** No live Postgres instance or browser session was available in
this environment (the same caveat stated for every prior datetime-sensitive
item this session, e.g. H4's `brusselsWallClockToUtc()`). H1.3's assignment
window conversion was verified by reading its exact logic against
`period-form.tsx`'s already-shipped, working equivalent — both rely on the
browser's own local timezone (Europe/Brussels for this app's users) via
`new Date(datetimeLocalValue).toISOString()` — not by exercising a real
booking against a server whose OS clock is UTC. This is stated explicitly in
`d954f9c`'s own commit body, per H1.3's own requirement to flag rather than
claim an unverified round-trip.

## 3. L2.1 backfill result

Run against the local SQLite dev DB (`npm run backfill:functions`):

- **7 matched, 0 unmatched.**
- Expected: `prisma/seed.ts`'s people↔function mapping is 1:1 by
  construction, so every legacy `role` string matches a `Function.name`
  exactly.
- **Production was not run** — no Postgres access in this environment. The
  PO runs `npm run backfill:functions` against the real database and reviews
  the unmatched list the script prints (each unmatched row logged with its
  `id` and `role` text, never guessed at).

## 4. M1.6 import result against both real files

Against `.plans/tools/Export_Equipment_normal.csv` and `..._advanced.csv`,
through the same parse → detect → adapt → apply pipeline the API routes use:

- **Normal file:** 103 materials created, 11 categories created, 1,631
  `StockItem` rows generated. The one genuine code collision (`9998-902`,
  IDs 707/708) is reported as an error without failing the rest of the file
  — ID 707 ("Vorken (vis)") keeps the code; ID 708 ("Messen (Vis)") is
  skipped. (Of the "5 duplicate-code groups" the brief flags, 4 are
  serialized items sharing one `ID` across multiple rows — grouped
  correctly into one material each, not collisions; only `9998-902` is a
  true cross-`ID` collision and produces the 1 reported error.)
- **Advanced file:** 287 materials created, all `archived: true`. Confirmed
  absent from the `archived: false` counts that mirror
  `materials/route.ts`'s default list filter and
  `materials/available/route.ts`'s unconditional one (M1.3).
- **Re-import idempotency:** re-importing either file alone, and both
  together, yields `created: 0` on the second pass with no duplicate
  materials or categories (103 + 287 = 390 materials, 11 categories, stable
  across repeated runs).
- **4 bundle shells needing manual contents:** the normal file's 3 `Virtual
  combination` rows (`0201-999` "Tap + aciet", `0401-006` "cocktailtafel met
  hoes (zwart)", `0401-011` "Buffettafel met hoes (zwart)") import as
  `isBundle: true` with **zero components** — Rentman's own `Combination
  structure` column is never populated in either export, so there is no
  recipe data to import. The 4th (`0201-017` "Schepijs vriezer", `Physical
  combination`) is **not** a bundle per the design doc's own resolved rule —
  it imports as an ordinary material with real stock. These 3 (not 4) empty
  bundle shells need their components added manually via the existing
  bundle-editor UI (`use-bundle-editor.ts`) before they're bookable as sets.

## 5. Money field / redaction / guard coverage

- `src/lib/redact.ts`'s `SCALAR_DENYLIST` gained `dayRate`, `hourRate`,
  `rateSnapshot` (L1/H5) and `costPrice`, `listPrice` (DDL-2/M1) — every new
  money-bearing field introduced this phase is covered.
- `src/lib/route-guards.test.ts` (N2.5's guard enumeration) still passes:
  **136/136** — every route handler declares a module guard, including all
  new routes added this phase (`/api/functions*`, `/api/clients/[id]/rates*`,
  `/api/periods/[id]/people/[assignmentId]` PATCH's new fields,
  `/api/materials/import*`).

## 6. Day-billed figures unchanged / historical snapshots not recomputed

- **H5.3:** all 18 pre-existing `pricing.test.ts` cases pass **unchanged,
  byte-identical** after H5.1's `personLineCost` rewrite — verified by
  running the full file, not just the new hourly-billing cases, since the
  rewrite touches the function every one of those cases calls.
- **L1.2:** `effective-price.integration.test.ts` includes a historical
  fixture (`Historical Alice`, a `PeriodPerson` row with `rateSnapshot: null`
  and a `dayPriceSnapshot` deliberately frozen at a value that would **not**
  match the person's *current* `dayPrice`) proving `effectivePersonPrice`
  never recomputes an already-booked assignment's price when called with no
  `functionId` — exactly the calling convention every pre-L2 caller uses.

## 7. For the PO to check

- Book yourself **08:00–17:00** on one project and **18:00–23:00** on
  another the same day — confirm both bookings succeed (H1.1's assignment
  window replaces the old whole-day-only overlap check).
- Force a deliberate double booking (same person, overlapping windows,
  different projects) — confirm it is flagged with the blocking project's
  name and window, and requires an explicit "Toch dubbel boeken" to proceed
  (H2).
- Import `Export_Equipment_advanced.csv` via **Materialen → ⬆️ Importeren**
  and confirm the 287 archived flightcases stay out of the materials list,
  the booking-availability picker, and the bundle-component picker, while
  remaining reachable directly (e.g. via their own stock-items view) if
  ever needed.
