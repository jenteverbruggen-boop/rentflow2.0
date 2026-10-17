# Inhuur + Toewijzen — review fixes (plan)

Follow-up to round 4 C3 (`.plans/2026-10-po-feedback-round4.md`). Source: a
full review of the inhuur flow, of why "Toewijzen" rarely finds anything,
and of the flow for material we don't own (2026-10-17). Phases A–D need no
schema migration; phase E needs one (price basis).

## Decision (grilled 2026-10-17)
- **Removing hired-in units works in every status.** "−" removes, in this
  order: an open (overbooked) unit, then a hired-in unit, then an owned unit.
  The trash button removes all three kinds. Removing a hired-in unit shows
  "Vergeet {leverancier} niet af te bellen".
- **Cancelling a project frees its stock.** On → `geannuleerd`, every owned
  unit (`PeriodStockItem`) of the project becomes an open shortage with the
  same price, setup, discount and set link. The quote's contents are kept and
  the stock is free for other projects at once. Reopening does nothing
  automatically. Toewijzen (and the status gate, as today) tries to take the
  units back.
- **Hired-in rows survive a cancel.** They stay "ingehuurd bij X". The cancel
  response lists them, and the UI warns "Vergeet af te bellen: 4× … bij
  Funrent".
- **Concept projects keep reserving real stock** (first come, first served).
  New: the overbook banner says per line **how many units are free now** and
  **who holds the rest** ("bezet door project X (concept)" with a link). The
  Toewijzen button is only enabled when something is free.
- **Scope own never sees other projects' names** in that hint: only "bezet in
  een ander project".
- **Hired-in → own stock is a manual action.** When own units are free for a
  hired-in row, the Ingehuurd card shows "n eigen units vrij" and an "Eigen
  voorraad gebruiken" button that converts (part of) the row under the lock.
  Toewijzen never touches hired-in rows (supplier may already be ordered).
- **Margin includes hired-in set components.** Each hired component gets its
  pro-rata share of the set's revenue, using the `PeriodBundleBookingComponent`
  weights (same split as payback), × hired units / needed units. Margin is
  revenue − *all* purchase cost. The owned component's payback share drops by
  the same fraction (hired *and* open units of that component).
- **Cijfers shows two buckets: "afgesproken"** (bevestigd/actief/afgerond)
  **and "nog te bevestigen"** (concept). Cancelled projects are left out
  everywhere. The split applies to revenue per month + KPIs, revenue per
  client, the Inhuur card and Top materialen. Invoiced revenue is unchanged
  (it comes from invoices).
- **What the client pays is set per material: per day or per rental.** New
  `Material.priceBasis` (`"per_dag" | "per_huur"`, default `per_dag` = today).
  It is snapshotted on every booking row next to the price, so changing it
  later never reprices existing bookings. It applies to every material (owned
  ones too, e.g. consumables), not only inhuur.
- **The Rentman price of "Inhuur <leverancier>" items is the supplier's
  purchase price.** Import puts it on `subhireUnitCost` (`per_huur`) and sets
  `dayPrice` to 0 until someone enters a selling price.
- **Ad-hoc inhuur from the picker.** "+ Inhuur-item" in the Beschikbaar pane
  takes a name, supplier, selling price + basis and purchase price. It creates
  an inhuur-only `Material` (category "Inhuur") and books it in one go. The
  item stays in the catalogue for reuse.
- **Inhuur-only and own stock are mutually exclusive.** You can't add stock
  items to an inhuur-only material, and you can't tick inhuur-only while
  stock items exist ("verwijder eerst de units"). The import enforces the same.
  If you sometimes own it and sometimes hire it in, use a normal material with
  a default supplier.

## Current state (verified)
- "−" / trash skip hired-in rows: `removeOneFromGroup` only looks at
  `overbookedUnits`/`shortageIds`, then owned assignments —
  `src/hooks/use-material-split-mutations.ts:96-113`. Hired ids are kept out
  of `shortageIds` on purpose — `src/lib/material-shortage.ts:49-60`.
- Server refuses to change or delete a hired-in row —
  `src/app/api/periods/[id]/shortages/[shortageId]/route.ts:39,78`. Undo is
  refused outside concept/geannuleerd, with a message that tells the user to
  "verwijder de lijn" — `src/lib/subhire.ts:123-129`.
  ⇒ an inhuur-only material in a confirmed project cannot be removed at all.
- Availability ignores project status: `freeStockItemIds` —
  `src/lib/booking.ts:6-30`; `bundleAvailableCount` —
  `src/lib/availability.ts:45-70`; `findAvailableStockItems` —
  `src/lib/availability.ts:11-30`. Cancelled projects hold stock forever.
- `fillShortages` only finds stock that is unbooked in every overlapping
  period — `src/lib/material-shortage-db.ts:53-111`. Callers: Toewijzen
  (`src/app/api/periods/[id]/shortages/fill/route.ts:20`), status gate
  (`src/app/api/projects/[id]/route.ts:74-87`), quote accept
  (`src/lib/accept-quote.ts:41-50`).
- Banner shows Toewijzen always, outcome only after the click —
  `src/components/project-overbook-alert.tsx:52-118`.
- A set with an inhuur-only component is always "0 vrij" (component stock 0
  wins the `min`) — `src/lib/availability.ts:56-70`. The picker never lets a
  set be hired in (`canHire` excludes sets) —
  `src/components/material-available-row.tsx:44-49`. If the pre-check is
  skipped (`hiresIn`), a short other component fails with the raw id
  "Onvoldoende voorraad voor component: 12" —
  `src/lib/bundle-booking.ts:59-66`, `src/app/api/periods/[id]/materials/route.ts:61`.
- Margin leaves component cost out: `computeSubhireStats` —
  `src/lib/stats-subhire.ts:39-42`; project card shows inkoop *with*
  components but marge *without* — `src/components/project-subhire-list.tsx:33,71`.
- Payback gives a set component's full share to owned stock even when units
  are hired or open — `src/lib/payback.ts:102-116`.
- Changing a hire's supplier keeps the previous supplier's price —
  `src/lib/subhire.ts:101-109`. Non-money callers have their cost fields
  stripped — `src/app/api/periods/[id]/shortages/[shortageId]/subhire/route.ts:51-56`.
  The edit dialog always sends `supplierId` and lists only active suppliers,
  so a hire with a since-archived supplier can't be edited at all —
  `src/components/subhire-dialog.tsx:71,87`, `src/lib/subhire.ts:101`.
- Booking route takes `subhire.basis/unitCost/costOverride` from the body
  without zod — `src/app/api/periods/[id]/materials/route.ts:29-31`.
- Cijfers has no status filter (cancelled + concept counted as booked) —
  `src/lib/compute-stats.ts:28-31`; booked per month —
  `src/lib/stats-booked.ts:23-48`.
- `PeriodStockItem` carries `shippedAt`/`returnedAt` —
  `prisma/schema.prisma:308-309` (relevant for cancel-conversion).
- Client price is always per day: `lineCost(snapshot × days)` —
  `src/lib/pricing.ts:18-35`, used for owned units (`materialLineCost`,
  `pricing.ts:37-41`) and shortages (`shortageCost`,
  `src/lib/material-shortage.ts:89-101`). A Funrent plate (€0,38) in a 3-day
  period bills €1,14, while the supplier bills `per_huur`.
- Rentman's 23 "Inhuur" items have only "Rental-/Sales price" filled in
  (plates €0,38, round table €7,55; Margin/List price 0, quantity 0) —
  `.plans/tools/Export_Equipment_normal.csv`. Today it becomes `dayPrice`
  (`src/lib/import/rentman-material-parser.ts:108`). `subhireUnitCost` is
  never imported (`src/lib/import/apply-material-import.ts:50-62`).
- Inhuur-only is only offered on the create form
  (`src/components/material-form.tsx:48,71`) and in the detail pane
  (`src/components/material-subhire-section.tsx:66-69`). Nothing stops adding
  stock items to such a material (no `subhireOnly` check anywhere under
  `src/app/api/materials/[id]/stock-items/`), and payback then hides the owned
  units (`src/lib/payback.ts:59`). The section is hidden for sets
  (`material-detail-pane.tsx:64`), but a material with `subhireOnly` can still
  be turned into a set via the `isBundle` PUT (`src/app/api/materials/[id]/route.ts`).
- Ticking "Enkel inhuur" in the detail pane without a default supplier gets a
  400 from the server (`material-subhire-fields.ts:19-27`). `onSave` rejects,
  but `onCheckedChange` doesn't catch it (`material-subhire-section.tsx:68`).
- File-size pressure: `src/lib/subhire.ts` 148, `src/lib/material-shortage-db.ts`
  129, `src/app/api/projects/[id]/route.ts` 122,
  `src/hooks/use-material-split-mutations.ts` 123 lines — new logic goes into
  new modules.

## Open points for the PM (default chosen)
- **Units shipped but not returned are not freed on cancel** (`shippedAt` set,
  `returnedAt` null). They are physically out, so freeing them would let
  another project book a unit that isn't in the warehouse. The cancel response
  lists them.
- **Reopening a cancelled project does not auto-assign.** The user clicks
  Toewijzen (or the status gate does it on bevestigen), as today. This avoids
  stealing units back silently.
- **Changing the supplier of a hire resets its price.** It becomes the
  material's default price when the new supplier is the material's default
  supplier, otherwise "onbekend" (`null`). The fixed total is always cleared.
  Money users see this in the dialog before saving. This is safe because a
  price only ever belongs to one supplier.
- **Sets in the picker get the same supplier selector as flat items.** The
  chosen supplier hires every short, non-inhuur-only component at that
  component's own defaults (request prices are ignored for sets). Inhuur-only
  components count as unlimited in a set's availability.
- **Top materialen shows both numbers per material** (afgesproken / nog te
  bevestigen) and ranks on afgesproken. This is the safest reading of the
  "Top materialen" pick.
- **Payback keeps counting every non-cancelled period** (concept included).
  Changing that is a separate figures decision. Cancelled units drop out on
  their own once they are converted to shortages.
- **"Bezet door" lists at most 3 projects per line, then "+n".**
- **Existing inhuur-only materials in prod get the same treatment as the
  import.** A one-off data step in the E1 migration copies `dayPrice` →
  `subhireUnitCost` (basis `per_huur`) where `subhireUnitCost IS NULL`, and
  sets `dayPrice = 0` and `priceBasis = per_huur`. Existing bookings keep
  their snapshots. ⚠ Until a selling price is filled in, new bookings of those
  items bill €0. That's why E3 adds the "geen verkoopprijs" warning *before*
  this lands.
- **Inhuur-only items default to `priceBasis = per_huur`** (created via the
  form, the picker or the import). Sets stay `per_dag` (no basis on sets in
  this round).
- **Ad-hoc items land in category "Inhuur"** (created when missing). Their
  supplier is the item's default supplier.

---

## Phase A — Inhuur correctness (fixes 1, 2, 4, 8)

### A1. Remove hired-in units (fix 1)
- `src/lib/subhire-remove.ts` (new): `removeHiredUnits(periodId, shortageId,
  count | "all")`. Under `lockMaterials`, re-read the row, check
  `supplierId != null` and the period. Decrement, or delete at 0. Return
  `{ supplierName, removed }`. Allowed in **every** project status (removing
  never creates an open shortage).
- Route: `PATCH /api/periods/[id]/shortages/[shortageId]/subhire` gets a
  `remove: number | "all"` variant (or a sibling `.../subhire/remove`, so PATCH
  keeps meaning "edit"). Prefer the sibling route for clarity. Permission:
  `planning: verwijderen`, the same as the existing shortage DELETE.
- `MaterialGroup` gets `subhireIds: number[]` next to `shortageIds`
  (`src/lib/grouping.ts:21-29`, `src/lib/material-shortage.ts:49-60`).
- `removeOneFromGroup`: open → hired (last `subhireIds`, decrement 1) → owned.
  `removeAllInGroup`: also removes every hired row. Move the shortage and
  subhire mutations into `src/hooks/use-shortage-mutations.ts` to stay under
  150 lines. Surface the `supplierName` warning through the existing
  `onWarnings`.
- `undoSubhire` message (`src/lib/subhire.ts:128`): point to the "−"/trash
  that now works.
- Tests: `subhire.integration.test.ts`: decrement, delete-at-0, refuses an
  open row, works in `bevestigd`. Pure test for the order in which
  `removeOneFromGroup` picks rows (extract the picker as a pure function
  `nextUnitToRemove(group)`).

### A2. Sets with inhuur-only components and hiring sets in (fix 2)
- `bundleAvailableCount`: skip components whose `child.subhireOnly` is true
  in the `min`. If *all* components are inhuur-only, return `Infinity` and
  let the caller clamp it.
- `material-available-row.tsx`: allow the supplier select for sets
  (`canHire` without `!isBundle`). `quantity` for sets is still 1 in the pane
  (`material-available-pane.tsx:88-90`).
- `resolveBookingHires`: for a set, ignore request prices (`canSetCosts`
  false for components). Every short non-inhuur-only component takes the
  request's supplier at its own defaults.
- `bookBundleMaterial` UNAVAIL: use `childName` in the message, and map it to
  a structured 409 `{ shortfall }` in the route so the picker's safety net
  shows numbers.
- Tests: `availability` integration test (set with an inhuur-only component
  is bookable). `resolveBookingSubhire` unit test for set components.

### A3. Changing the supplier of a hire (fix 4)
- `updateSubhire`: validate the supplier only when it **changes**
  (`patch.supplierId !== row.supplierId`). On a change without explicit
  prices, reset `subhireUnitCost`/`subhireCostBasis` from the material when
  the new supplier is `material.defaultSupplierId`, else `unitCost = null`.
  Always clear `subhireCostOverride` on a supplier change. Lives in
  `src/lib/subhire-update.ts` (moved out of `subhire.ts`, line pressure).
- `subhire-dialog.tsx`: in edit mode add the current (possibly archived)
  supplier to the options with the suffix "(gearchiveerd)". On a supplier
  change, prefill or clear the unit cost by the same rule, and clear the fixed
  total.
- Tests: integration: archived supplier with a price-only edit succeeds;
  switching to a non-default supplier nulls the price.

### A4. Validate booking-time subhire input (fix 8)
- zod schema for the POST body in `src/app/api/periods/[id]/materials/route.ts`
  (`subhire: { supplierId int+, basis enum?, unitCost ≥0 nullable?,
  costOverride ≥0 nullable? }`). Keep `canSetCosts` stripping.
- Nit: `src/app/(app)/projects/[id]/pakbon-subhire.tsx:11` comment says
  component rows are skipped, but they aren't (and shouldn't be). Fix the
  comment.

## Phase B — Cancelling frees stock

### B1. Convert owned units on cancel
- `src/lib/release-cancelled-stock.ts` (new): `releaseProjectStock(projectId,
  tx)`. Load all `PeriodStockItem` of the project **except** shipped-not-returned.
  Take `lockMaterials` on their materials. Group by (period, material,
  bundleBookingId, dayPriceSnapshot, setupCostSnapshot, discountPct,
  discountAmount). Call `createOrIncrementShortage` per group (open rows,
  `subhire: null`), then delete the `PeriodStockItem`s. Return `{ released,
  keptShipped: [...], hired: [{ supplier, material, quantity, period }] }`.
- Call it from `PUT /api/projects/[id]` only on the transition
  `existing.status !== "geannuleerd" && status === "geannuleerd"`. The status
  update and the release go in one transaction. Return the summary in the
  response.
- Component units keep `dayPriceSnapshot 0` and their `bundleBookingId`.
  `PeriodBundleBooking` and its component weights stay, so the set line and
  price survive reopening.
- UI: the status-change hook shows a dialog after cancelling: "n units
  vrijgegeven", "nog buiten: …", "Vergeet af te bellen: 4× X bij Funrent".
- Tests: integration: owned flat + set units become open rows with equal
  prices; shipped unit stays; hired rows untouched; invoice lines of the
  project are identical before and after (`invoice-lines` billing parity).

## Phase C — Toewijzen tells you what it can do

### C1. Availability hint endpoint
- `GET /api/projects/[id]/stock-hints` (new; `planning: lezen`). For each
  open shortage: `{ shortageId, freeNow, holders: [{ projectId, name, status,
  units }] }`. For each hired-in row: `{ shortageId, ownFreeNow }`. One
  `freeStockItemIds` per (material, period). Holders come from the overlapping
  `PeriodStockItem`s of *other* projects, grouped per project, max 3 + `more`.
- Scope own: `holders` names and ids are dropped (`{ units, status }` only,
  shown as "bezet in een ander project"). The rule lives in the route, with a
  `redact.test.ts`-style unit test.
- Hook `use-stock-hints.ts` (query key `["stock-hints", projectId]`). It is
  invalidated wherever `["available"]` is today.

### C2. Overbook banner
- `project-overbook-alert.tsx`: per line "n nu vrij" (Toewijzen enabled when
  Σ freeNow > 0) or "bezet door X (concept), Y (bevestigd)" with links. Keep
  under 150 lines by extracting `overbook-line.tsx`.

### C3. Hired-in → own stock
- `src/lib/subhire-to-stock.ts` (new): `useOwnStock(periodId, shortageId,
  quantity)`. Under the lock: re-read the row (must be hired), free ids for the
  period, `fill = min(quantity, free)`. Create `PeriodStockItem`s with the
  row's price, setup, discount and bundleBookingId. Decrement or delete the
  row. Return `{ converted, supplierName }`.
- Route `POST /api/periods/[id]/shortages/[shortageId]/subhire/to-stock`
  (`planning: wijzigen`).
- `project-subhire-list.tsx`: when `ownFreeNow > 0`, show "n eigen units vrij
  · Eigen voorraad gebruiken". Toast: "Vergeet {supplier} af te bellen".
- Tests: integration: partial conversion, refuses an open row, refuses when
  nothing is free, and is never triggered by `fillShortages`.

## Phase D — Figures

### D1. Status buckets in Cijfers
- `src/lib/stats-status.ts` (new): `statusBucket(status) → "afgesproken" |
  "teBevestigen" | null` (null = geannuleerd → skip).
- `computeStats`: `where: { project: { status: { not: "geannuleerd" } } }` and
  tag each period with its bucket.
- `aggregateBookedByMonth` → entries carry `{ agreed, pending }` per
  people/materials/travel/total. `aggregateBookedByClient`, `computeTopMaterials`,
  `computeSubhireStats` get the same split. Update `use-stats.ts` types.
- UI: monthly chart stacks agreed (solid) + pending (lighter/hatched, per the
  `dataviz` skill); KPI "Geboekt" shows both. Client table gets two columns.
  Top materialen shows both and ranks on agreed. The Inhuur card shows a
  bucket per row of figures. Run the `design` skill.
- Tests: pure tests per aggregator (cancelled excluded, buckets sum to the old
  total minus cancelled).

### D2. Set components in margin and payback (fixes 3, 6)
- `src/lib/bundle-share.ts` (new, extracted from `payback.ts:102-116`):
  `componentShare(booking, weights, materialId, days)` → that component's
  revenue share of the set line.
- `computeSubhireStats`: a hired component row gets `revenue +=
  componentShare × hired / (compQty × bookingQty)`. Cost counts fully. Drop
  `componentCost` as a separate "outside the margin" figure (keep it as a
  sub-line "waarvan set-onderdelen"). Same in `project-subhire-list.tsx`: margin =
  sold − all cost.
- `bundleShareFor` (payback): multiply the owned component's share by
  `(needed − shortage units of that component in that booking) / needed`.
  `computePaybackStats` must then load shortages per bundle booking
  (`statsPeriodInclude` already includes `shortages`).
- Tests: `payback.test.ts` + `stats-subhire.test.ts`: set with 2/4 units of a
  component hired. Revenue shares sum to the set line, payback halves.

## Phase E — Material we don't own

### E1. Price basis per material (migration)
- Schema (both files): `Material.priceBasis String @default("per_dag")`, plus
  `priceBasisSnapshot String @default("per_dag")` on `PeriodStockItem` and
  `PeriodMaterialShortage`. Author the Postgres migration per CLAUDE.md. The
  same migration carries the prod data step from the open points (inhuur-only
  materials: `dayPrice` → `subhireUnitCost`, `dayPrice = 0`,
  `priceBasis = per_huur`).
- One helper `billedUnits(basis, days)` (`src/lib/pricing.ts`): `per_huur` →
  1, else `days`. Every material `lineCost` call passes it:
  `materialLineCost`, `shortageCost`, `invoice-lines.ts:108-115`,
  `kosten-period-table`, `material-cost-row`, `material-group-row`,
  `stats-booked`, `stats-top-materials`, payback flat revenue
  (`payback.ts:82-96`), `stats-subhire` revenue. Grep `lineCost(` and
  `dayPriceSnapshot` for the full list during implementation.
- Snapshot at booking: `bookFlatMaterial`, `createOrIncrementShortage` (part of
  the merge key), `fillShortages`, `subhireShortage` split,
  `undoSubhire` fold, B1 release, C3 to-stock. `MaterialGroup` key includes the
  basis (`grouping.ts`, `material-shortage.ts:14-21`).
- UI: price field "Prijs" + select "per dag / per huur" on the material form,
  detail pane and price list (C6: "/dag" vs "/huur"). Picker row shows
  "€x/huur". Invoice/quote line description is unchanged; `unitPrice` is
  already the per-unit total.
- Tests: `pricing.test` (both bases), invoice-lines parity for `per_dag`, and
  a `per_huur` shortage + owned unit in one group.

### E2. Rentman import of inhuur items
- Parser: for an "Inhuur <leverancier>" folder, map "Rental-/Sales price" →
  `subhireUnitCost` and set `subhireCostBasis per_huur`, `dayPrice 0`,
  `priceBasis per_huur`. Ignore "Margin price" for these (it would land on
  `costPrice`, which is meaningless without stock).
- Re-import of an existing item: only fill `subhireUnitCost` when it's empty,
  and never overwrite a selling price that was entered in RentFlow (`dayPrice
  > 0`). Change detection (`apply-material-import.ts:70-79`) follows.
- Refuse (row error) an "Inhuur" row with quantity > 0 (E4 rule).
- Tests: `material-import.test.ts` + real-files test fixture rows.

### E3. "Geen verkoopprijs" warning
- Materials list + detail pane: badge "geen verkoopprijs" when `dayPrice == 0`
  and not a set. In the picker row, show the same hint in amber.
- Inhuur-only with `dayPrice ≤ subhireUnitCost` (money users only): "verkoop ≤
  inkoop".
- Lands **before** E1's data step is deployed.

### E4. Inhuur-only ⟂ own stock
- `POST /api/materials/[id]/stock-items` (+ `bulk`): 409 when `subhireOnly`.
- `subhireFieldsError`: refuse `subhireOnly: true` while the material has stock
  items, and refuse `subhireOnly` + `isBundle` together.
- Material create form: hide "Aantal" when "Enkel inhuur" is ticked (already
  forced to 0).
- `material-subhire-section.tsx`: catch the `onSave` rejection and show the
  server message inline (today it's an unhandled rejection).
- Tests: integration for both refusals.

### E5. Ad-hoc inhuur from the picker
- `material-available-pane.tsx`: "+ Inhuur-item" button opens
  `adhoc-subhire-dialog.tsx`. Fields: name *, supplier * (active), quantity *,
  selling price + basis (money users; otherwise 0 + the E3 warning), purchase
  price + basis (money users).
- `POST /api/periods/[id]/adhoc-subhire` (`planning: wijzigen` **and**
  `materialen: wijzigen`, because it creates a catalogue item). In one
  transaction: find or create category "Inhuur", create the `Material`
  (`subhireOnly`, `defaultSupplierId`, prices), then `bookFlatMaterial` with
  `subhire` (all units are hired in, no stock). Works in every project status,
  because no open shortage is ever created.
- Name clash: when an active material with the same name exists, return 409
  with its id, so the dialog can offer "Bestaand item gebruiken".
- Tests: lib-level (`createAdhocSubhire`): creates material + resolved row,
  reuses the category, refuses a duplicate name.

---

## Execution order
1. **A1 → A3 → A4 → A2.** A1 unblocks stuck confirmed projects (highest pain).
2. **E3 → E4.** Small and safe. E3 must exist before E1's data step.
3. **B1.** Biggest effect on "Toewijzen doet niets".
4. **C1 → C2 → C3.**
5. **E1 → E2 → E5.** The migration. E5 depends on the price basis.
6. **D2 → D1.** D2 is pure lib math. D1 also gets E1's `billedUnits`.

Every phase: `npx tsc --noEmit`, `npm run lint`, lib tests. The `code` skill
before finishing, the `design` skill for C2/C3/D1, the `docs` skill for the
new routes (README endpoints). Advisory-lock races can't be reproduced on
SQLite: reason about them in review, as in C3.

Effort: A ≈ M, B ≈ M, C ≈ M, D ≈ L, E ≈ L (E1 touches every price path).
