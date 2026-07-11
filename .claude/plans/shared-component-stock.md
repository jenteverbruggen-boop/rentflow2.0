# Plan: Allow an item to belong to multiple sets (shared component stock)

## Context

Today a material component may live in only **one** set — an app-level guard added in E6.1
(`POST /api/materials/:id/components`) rejects a child already used in another set. The user
wants to revisit this: real inventory has one physical pool of e.g. cocktail tables that feeds
*both* a "table + black cover" set and a "table + white cover" set. Booking one set must draw
down the shared table stock for the other. When the numbers divide cleanly (10 tables, 5 black
+ 5 white covers) there is never a conflict; otherwise the sets compete for the shared tables.

**Key finding — the hard part already works.** Booking availability is computed at the physical
`StockItem` level. Both `bundleAvailableCount` (availability.ts) and the in-transaction re-check in
`bookBundle` (periods/[id]/materials/route.ts) query *all* stock items of a child material and
subtract whatever is booked in any overlapping period — regardless of which set or flat booking
reserved them. So booking "table + black" already reduces "table + white" availability. The DB
also already permits multi-set membership (`MaterialComponent` is unique only on
`[parentId, childId]`). **No schema change / migration is needed.**

What's missing: (1) remove the artificial one-set guard; (2) surface sharing in the UI so users
see that an item is shared and that a set's "complete sets" number is a per-set ceiling; (3) close
a pre-existing cross-period concurrency race that set-sharing makes easier to hit; (4) thorough
tests of the sharing/booking logic.

### Decisions (confirmed with user)
- **Catalog "complete sets" display**: keep the existing per-set number as a *max*, and flag each
  shared component with a "🔗 gedeeld met …" note. Do **not** invent a global allocation. Booking
  time remains the source of truth.
- **Concurrency**: harden the cross-period race now (Postgres advisory lock), for flat *and* bundle
  bookings.

---

## Changes

### 1. Remove the one-set guard (the actual unblock)
`src/app/api/materials/[id]/components/route.ts` — delete the `alreadyUsed` lookup + rejection
(lines ~54-62). Keep the self-component check and the "no nested bundle" check (`child.isBundle`).

### 2. Sharing data — one pure helper, used by both material endpoints
New `src/lib/bundle-sharing.ts`: `computeSharingMap(components)` → `Map<childId, {id,name}[]>`
listing which set(s) each child belongs to. Pure + unit-tested.

- `src/app/api/materials/route.ts` (GET): the query already loads `components`. Add the reverse
  relation `usedInBundles: { include: { parent: { select: { id, name } } } }`. Attach
  `usedInSets: {id,name,quantity}[]` to every material. For bundles, pass a `sharedWith:{id,name}[]`
  onto each `computeBundleStock` component **input** (it spreads through to the output unchanged, so
  `computeBundleStock` itself needs no logic change — just the extended input type).
- `src/app/api/materials/available/route.ts` (GET): for bundles, attach
  `sharedComponents: string[]` (names of components that are used in >1 set) so the booking picker
  can show a hint. Availability numbers are unchanged (already correct).

### 3. Extract + harden the booking logic — `src/lib/booking.ts` (NEW)
Move the booking algorithm out of the route (the route file is already 180 lines, over the 150
limit) into a testable lib with an **injectable client** (`client = prisma`) so integration tests
can pass their own:
- `freeStockItemIds(client, materialId, from, to, excludePeriodId?)` — single source of truth for
  "which units of a material are free in [from,to)", strict `lt/gt` boundaries (B7). Replaces the
  duplicated queries in `route.ts` (`availableForMaterial`) and the inline query in `bookBundle`.
- `lockMaterials(tx, materialIds)` — on Postgres only, `SELECT pg_advisory_xact_lock(<classid>, id)`
  for each distinct materialId in **sorted** order (deadlock-safe); no-op otherwise. Postgres is
  detected via `DATABASE_URL` not starting with `file:` (mirrors `src/lib/prisma.ts`). This
  serializes concurrent reservations on the same material across overlapping periods, closing the
  cross-period overbook the `@@unique([periodId, stockItemId])` constraint can't catch. SQLite dev
  is already serialized, so the no-op is correct there.
- `bookFlatMaterial({...})` and `bookBundleMaterial({...})` — each opens one **interactive**
  `$transaction`: `lockMaterials` → re-check via `freeStockItemIds` → create rows. Throws
  `Error & {code:"UNAVAIL"}` on shortage; lets P2002 propagate. (The flat path today checks
  availability *outside* its transaction — moving it inside is part of the hardening.)

`src/app/api/periods/[id]/materials/route.ts` — slim to: parse/auth → load period+material → call
the right lib fn → map `UNAVAIL`/`P2002` → `conflict(...)`, else `serverError`. Preserves the
existing response shapes (`{assignments,warnings}` / `{bundleBooking,warnings}`) and discount fields.

`src/lib/availability.ts` — give `bundleAvailableCount` an optional injected client param (for
integration tests) and reuse `freeStockItemIds` where practical. Behaviour unchanged.

### 4. UI — show sharing (types in `src/types/index.ts` first)
Add optional fields: `Material.usedInSets`, `BundleStockComponentInput.sharedWith`, and a picker
`sharedComponents`.
- `src/components/bundle-component-editor.tsx`: **remove** the `usedInAnySet` filter (lines 28-33)
  so any non-bundle, non-self material is selectable. Show a "🔗 ook in: …" hint for children
  already used elsewhere.
- `src/components/bundle-component-row.tsx`: small "🔗 gedeeld" badge when the child's `sharedWith`
  is non-empty.
- `src/components/bundle-stock-summary.tsx`: label the count as a **max** and, per shared component,
  render "🔗 gedeeld met [set]". Copy makes clear the real limit is enforced at booking.
- `src/components/material-detail-pane.tsx`: for a **non-bundle** item with `usedInSets`, add a
  "🔗 Gedeeld — zit in N sets: …" section so opening the item shows its set membership.
- `src/components/materials-tree-pane.tsx`: append a 🔗 marker to a set's badge when it has a
  shared component.
- `src/components/material-split-editor.tsx` (booking picker): for a bundle row with
  `sharedComponents`, show a light "🔗 deelt voorraad" line so the sharing is visible at booking.

### 5. Seed / migration
None. No schema change. **Do not edit `prisma/seed.ts`** — it is already modified by the other
agent in this worktree; integration tests seed their own data.

---

## Tests (the point of this work)

- **`src/lib/booking.integration.test.ts` (NEW, real ephemeral SQLite, DI client)** — the core
  confidence. `beforeAll`: `execSync('prisma db push --schema=prisma/schema.dev.prisma')` against a
  temp `file:` DB, construct a `PrismaClient` with `PrismaLibSql`, seed materials + stock items.
  Cases:
  - Shared reduction: sets A & B share child M (stock 5). Book A (needs 2) → reserves #1,#2; book B
    (needs 2) in an overlapping period → reserves #3,#4 (disjoint). Assert no unit double-booked.
  - **Clean match**: 10 tables, 5 black + 5 white covers → book 5 black sets + 5 white sets; all
    succeed, all 10 tables consumed, zero conflicts.
  - **Cross-set exhaustion**: book 6 black sets then 5 white sets → second fails `UNAVAIL` (only 4
    tables left), nothing partially persisted.
  - Flat + bundle contend for the same material (flat booking reduces bundle availability).
  - Back-to-back boundary (end == start) → no conflict (strict `lt/gt`).
  - Unbook (`DELETE PeriodBundleBooking`) frees the shared stock for the other set.
  - `bundleAvailableCount` shared scenarios mirror the above.
- **`src/lib/bundle-sharing.test.ts` (NEW)** — `computeSharingMap`: no-share, 2-set share, 3-set.
- **`src/lib/booking.lock.test.ts` (NEW, mocked)** — `lockMaterials` emits `pg_advisory_xact_lock`
  (sorted ids) only for a non-`file:` URL; no-op for a `file:` URL. (SQLite can't exercise the
  Postgres lock, so this is unit-level.)
- Keep `bundle-stock.test.ts`, `availability.test.ts`, `pricing.test.ts` green.

---

## Verification

1. `npx tsc --noEmit` (zero errors) + `npm run lint` + `npm run test` (all suites, incl. new
   integration test).
2. Manual (dev SQLite via `npm run dev`): create a "Cocktailtafel" item (10 units), a "Zwarte hoes"
   (say 8) and "Witte hoes" (8); create two sets each = table + its cover. Confirm: the component
   picker now offers the table for the second set; both sets list the table as 🔗 shared; the item
   detail shows "zit in 2 sets"; booking N black sets drops the white set's "X sets beschikbaar" in
   the picker; a clean 5/5 split books with no conflict.
3. Postgres advisory lock: optional — verify via `docker compose up -d db` that the app boots and a
   bundle books; the lock path is covered by the unit test + serialized SQLite guarantee.

## Commit (careful — shared worktree)
Another agent is editing this worktree (many files already `M`, incl. `availability.ts`,
`material-split-editor.tsx`, `availability.test.ts`, `seed.ts`). At commit time: re-run
`git status`, `git add` **only this feature's explicit paths**, and `git diff --cached` before
committing. For any file already modified by the other agent that I also touched, flag it to the
user before including it rather than sweeping in their in-flight work. Never `git add -A`.
