# E6 Bundles Design — `.plans/e6-bundles-design.md`

> Status: **AWAITING HUMAN APPROVAL** — do not implement until this doc is explicitly approved.  
> Author: AI worker, 2026-07-11. Covers all constraints listed in `03-phase3.md § E6-design`.

---

## Problem

The seed data already contains "Combinatie" category materials, proving bundles are real business objects. A bookable set (e.g. "Tafel + hoes") must:
- Reserve component StockItems atomically
- Be unbookable as a whole
- Price as sum of components (with nullable override)
- Render on pakbon as parent + indented components
- Leave flat bookings entirely unchanged

---

## Data Model

### Recipe side (what a bundle is)

```prisma
model MaterialComponent {
  id         Int      @id @default(autoincrement())
  parentId   Int
  childId    Int
  quantity   Int      @default(1)
  parent     Material @relation("BundleParent", fields: [parentId], references: [id], onDelete: Cascade)
  child      Material @relation("BundleChild",  fields: [childId],  references: [id], onDelete: Cascade)

  @@unique([parentId, childId])
}
```

`Material.isBundle Boolean @default(false)` — flag so UI can distinguish.  
`Material.bundlePriceOverride Decimal? @db.Decimal(10,2)` — null = live sum of components.

### Booking side (what a bundle booking is)

```prisma
model PeriodBundleBooking {
  id               Int               @id @default(autoincrement())
  periodId         Int
  materialId       Int               // the bundle material
  quantity         Int               @default(1)
  dayPriceSnapshot Decimal           @db.Decimal(10,2)   // snapshotted at booking time
  period           Period            @relation(fields: [periodId], references: [id], onDelete: Cascade)
  material         Material          @relation(fields: [materialId], references: [id], onDelete: Cascade)
  stockItems       PeriodStockItem[] // component assignments
}
```

`PeriodStockItem` gains a nullable `bundleBookingId Int?` field and FK to `PeriodBundleBooking`.  
Flat bookings: `bundleBookingId = null`. Bundle component assignments: `bundleBookingId = <booking id>`.

**Why this solves all problems:**
- Price snapshot is stored on `PeriodBundleBooking` (not on each component's `PeriodStockItem`).
- Unbook = delete `PeriodBundleBooking`; cascade removes its `PeriodStockItem` children.
- Pakbon nesting: `GROUP BY bundleBookingId`; null = flat line, non-null = indent under parent.
- Flat bookings (`bundleBookingId = null`) are byte-for-byte identical to today.

---

## Booking Algorithm

```
FUNCTION bookBundle(periodId, bundleMaterialId, quantity):
  bundle = Material.findUnique(bundleMaterialId, include: components)
  ASSERT bundle.isBundle

  BEGIN prisma.$transaction(interactive)  -- Postgres READ COMMITTED; SQLite serialized
    // Re-check availability INSIDE the transaction (kills TOCTOU race)
    FOR EACH component IN bundle.components:
      available = findAvailableStockItems(component.childId, {from, to})
        // uses strict lt/gt boundaries (B7)
      needed = component.quantity * quantity
      IF available.count < needed: THROW "Onvoldoende voorraad: {component.name}"

    // Snapshot price
    snapshotPrice = bundle.bundlePriceOverride
                    ?? SUM(component.child.dayPrice * component.quantity)

    booking = PeriodBundleBooking.create({ periodId, materialId: bundleMaterialId,
                quantity, dayPriceSnapshot: snapshotPrice })

    // Reserve exactly needed stock items
    FOR EACH component IN bundle.components:
      stockItemIds = first (component.quantity * quantity) available IDs
      PeriodStockItem.createMany(stockItemIds.map(id => ({
        periodId, stockItemId: id,
        dayPriceSnapshot: 0,   // €0 within a set on cost views
        bundleBookingId: booking.id
      })))

  END TRANSACTION
  RETURN booking
```

**SQLite vs Postgres isolation note:**  
SQLite uses serialized writes (file-level lock) so concurrent booking is impossible in practice on dev. Postgres uses READ COMMITTED; the re-check inside the transaction is safe because `PeriodStockItem.create` will fail the `@@unique([periodId, stockItemId])` constraint on a race, and the whole transaction rolls back.

---

## Unbooking

```
DELETE PeriodBundleBooking WHERE id = bookingId
-- Cascade removes all linked PeriodStockItem rows automatically
```

---

## Availability

```
bundleAvailability(bundleMaterialId, from, to):
  FOR EACH component IN bundle.components:
    avail = findAvailableStockItems(component.childId, {from, to})
    maxBookable = floor(avail.count / component.quantity)
  RETURN min(maxBookable over all components)
```

Back-to-back at boundary does NOT conflict (strict `lt`/`gt`, per B7).

---

## Pricing

- `dayPriceSnapshot` on `PeriodBundleBooking` = `bundlePriceOverride ?? SUM(component.dayPrice * component.quantity)`.
- Component `PeriodStockItem.dayPriceSnapshot = 0` — renders €0 on cost views and pakbon.
- `periodTotal`, `periodMaterialsCost` must treat bundle bookings separately (sum `PeriodBundleBooking.dayPriceSnapshot * days * quantity`).
- The existing `periodTotal` helper needs to skip `PeriodStockItem` rows with `bundleBookingId != null` and instead sum from `PeriodBundleBooking`.

---

## UI Surfaces

1. **Material detail pane** — "Components" section (visible only when `isBundle = true`): add/remove components, set quantity, set price override.
2. **Booking flow** (period materials tab) — bundles appear alongside normal materials in the picker. Availability shows "X sets beschikbaar".
3. **Costs tab** — bundle line shows `PeriodBundleBooking.dayPriceSnapshot`; component lines show €0.
4. **Pakbon (B4b)** — parent line + indented component lines.

---

## Migration / Seed Impact

Two new Postgres migration steps:
1. `ALTER TABLE "Material" ADD COLUMN "isBundle" BOOLEAN NOT NULL DEFAULT FALSE;`
2. `ALTER TABLE "Material" ADD COLUMN "bundlePriceOverride" DECIMAL(10,2);`
3. New tables `MaterialComponent`, `PeriodBundleBooking`.
4. `ALTER TABLE "PeriodStockItem" ADD COLUMN "bundleBookingId" INTEGER REFERENCES "PeriodBundleBooking"("id") ON DELETE CASCADE;`

`seed.ts` — add ≥1 demo bundle (e.g. "Tafel set" = Tafel + Stoelhoes × 4).

---

## Test Plan

| Case | Expected |
|---|---|
| Book bundle with full availability | Booking created; component stock items reserved |
| Book bundle when 1 component exhausted | Error "Onvoldoende voorraad"; nothing persisted |
| Back-to-back bundle bookings (end 12:00 / start 12:00) | No conflict (strict boundary) |
| Concurrent booking simulation (same component, 2 requests) | Second fails with P2002 unique; first succeeds |
| Unbook a bundle | All component PeriodStockItems removed; stock freed |
| Flat booking after bundle booking (different period) | Flat booking unaffected |
| Pricing: override null → live sum | dayPriceSnapshot = SUM(component prices) |
| Pricing: override set → override | dayPriceSnapshot = override value |
| periodTotal with bundle bookings | Equals old total for flat projects (regression) |

---

## Non-goals

- Nested bundles (bundle-in-bundle) — explicit out of scope
- Bundle availability across multiple quantities in one booking UI
- Changing component prices retroactively on existing bookings
- Nested pakbon rendering (B4b — phase 5, after this is approved)

---

## E6.1 — Set stock, incomplete sets & catalog UI (follow-up, implemented)

Follow-up after the booking side landed. The recipe/booking model above is unchanged; this only adds a **catalog-side view** of set stock and fixes a price-display bug.

### Set stock (owned, not date-ranged)

Pure helper `computeBundleStock(components)` in `src/lib/bundle-stock.ts` (unit-tested):

```
completeSets   = min over components of floor(totalStock / perSetQty)
componentSum   = SUM(child.dayPrice * perSetQty)          // live price of one set
per component:
  usedInComplete = completeSets * perSetQty
  remaining      = totalStock - usedInComplete
  haveForNext    = min(remaining, perSetQty)
  missingForNext = max(0, perSetQty - remaining)
hasIncomplete  = any component has remaining > 0
```

`/api/materials` GET now returns `bundleStock` + `setPrice` (`bundlePriceOverride ?? componentSum`) for every set. This is the **owned-stock** view (ignores bookings) — distinct from `bundleAvailableCount` which stays the **date-range** view used by the booking picker.

Worked example (recipe: 1 doos + 24 glazen; stock 3 dozen + 50 glazen): `completeSets = min(3, floor(50/24)) = 2`; leftover 1 doos + 2 glazen ⇒ 1 incomplete set, `glazen 2/24 (mist 22)`.

### Bug fix

`/api/materials/available` previously showed a set's `basePrice` as its raw `dayPrice` (0) when no override was set, while booking charged the component sum. Now both use `override ?? componentSum`.

### Catalog UI

- **Detail pane**: sets show `Setprijs` + `Complete sets` (instead of Dagprijs/units) and a `BundleStockSummary` card — complete-set count plus a ⚠️ incomplete-set breakdown listing each component `have/need (mist X)`.
- **List**: `🎁` icon + `"N sets"` (⚠️ if incomplete) per set row; a segmented **Alle / 🎁 Sets / Losse** type filter.
- **Component editing**: each component row has an inline quantity input (`PATCH /components/:componentId`) to correct mistypes; the set price has an override input (empty = automatic component sum) that PUTs `bundlePriceOverride`. A table+cover set can thus be priced cheaper than its parts.
- **Override-wipe fix**: `useMaterialUpdate` now always sends `bundlePriceOverride` in the PUT body, so editing any other field (notes, code…) no longer silently clears a set's override.
- **Picker overflow**: `EntityCombobox` list capped at `max-h-64 overflow-y-auto` so long component lists scroll instead of running off-screen.

### New constraints (tightened vs original)

- A component's child may **not** itself be a set (no nesting) and may **not** be used in more than one set — enforced in `POST /api/materials/:id/components` and reflected in the component picker (filters out already-used materials).
