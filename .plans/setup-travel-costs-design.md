# Setup/Teardown Cost + Travel Cost — Design

> Status: **approved, implementing**. Author: AI worker, 2026-07-12.

Two independent cost additions. Both are one-time / count-based — they are **never multiplied by rental days** (unlike day-price lines in `pricing.ts`).

---

## A. Material setup/teardown cost (per unit, one-time)

**Decisions:** one combined field; charged **per booked unit** (3 tents → 3× setup); financial only.

### Data model
- `Material.setupCost Decimal? @db.Decimal(10,2)` — nullable, `null`/`0` = none. ("Op-/afbouwkosten")
- `PeriodStockItem.setupCostSnapshot Decimal @default(0) @db.Decimal(10,2)` — snapshotted per unit at booking time.

### Booking
`POST /periods/:id/materials` (flat bookings only): each created `PeriodStockItem` gets `setupCostSnapshot = material.setupCost ?? 0`. Bundle-component items keep `0` (components are €0 within a set).

### Pricing (`src/lib/pricing.ts`)
- `materialLineCost(line, days)` = `dayPriceSnapshot × days` (with discounts, unchanged) **+ `setupCostSnapshot`** (added once, not × days).
- `periodMaterialsCost` / `periodTotal` therefore already include setup via the line helper. Vitest updated.

### UI
- `MaterialForm` + detail pane: optional "Op-/afbouwkosten" field (inline-edit via `useMaterialUpdate` → PUT already round-trips it once added).
- Kosten tab / cost summary: setup shown as part of the material total (breakdown line "op-/afbouw" where a row has it).

---

## B. Travel cost per person-per-period (attached to the booking)

**Decision (reframed):** travel is entered **when a person is booked on a period** — it varies by person/location/distance. Each person-booking can carry several travel lines (e.g. "Transport 4× €30" + "Overnachting 2× €80"), covering daily / overnight / a combination.

### Data model
```prisma
model PersonTravelCost {
  id             Int          @id @default(autoincrement())
  periodPersonId Int
  label          String?      // e.g. "Transport", "Overnachting"
  unitCost       Decimal      @db.Decimal(10,2)
  quantity       Int          @default(1)   // the multiplier ("4 times")
  periodPerson   PeriodPerson @relation(fields: [periodPersonId], references: [id], onDelete: Cascade)
}
```
`PeriodPerson.travelCosts PersonTravelCost[]`. Deleting a person-booking cascades its travel lines. No price snapshot needed — travel lines are the source of truth (edited live, not re-snapshotted).

### API
Nested CRUD under the person booking:
- `GET`/`POST` `/api/periods/:id/people/:assignmentId/travel`
- `PATCH`/`DELETE` `/api/periods/:id/people/:assignmentId/travel/:travelId`

`assignmentId` = the `PeriodPerson.id`. POST body `{ label?, unitCost, quantity }`.

### Pricing (`src/lib/pricing.ts`)
- New `periodTravelCost(period)` = `Σ over people, over travelCosts (unitCost × quantity)`.
- `projectCostSummary` grows a third bucket: `{ people, materials, travel, total }` — a separate **Reiskosten** line (aggregated across all people).
- `periodTotal` includes travel.

### UI
- Period **Personen** tab: each booked-person row gets a small "Reiskosten" editor (add/edit/remove lines: omschrijving, bedrag, aantal). Shown inline or in a popover.
- Period/project **Kosten** tab: a "Reiskosten" line alongside Personen and Materialen.

---

## Migration
- Update `prisma/schema.prisma` (Postgres, `Decimal`) **and** `prisma/schema.dev.prisma` (SQLite, `Float`).
- Dev: `npm run db:dev:migrate` (db push).
- Prod: author `prisma/migrations/<ts>_setup_travel_costs/migration.sql` (ALTER Material + PeriodStockItem, CREATE PersonTravelCost) per the CLAUDE.md `prisma migrate diff` flow.

## Types (`src/types/index.ts`)
- `Material.setupCost?: number | null`
- `PeriodStockItem.setupCostSnapshot: number`
- new `PersonTravelCost`; `PeriodPerson.travelCosts?: PersonTravelCost[]`
- `projectCostSummary` return shape `+ travel`.

## Files touched
schema ×2, migration, `pricing.ts` (+ `pricing.test.ts`), `project-include.ts`, `types/index.ts`, material booking route, material PUT/POST + form + detail pane, new people-travel routes, period people tab UI + a travel editor component, cost-summary / project-costs-tab.
