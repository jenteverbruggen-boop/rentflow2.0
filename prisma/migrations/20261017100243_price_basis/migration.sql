-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "priceBasis" TEXT NOT NULL DEFAULT 'per_dag';

-- AlterTable
ALTER TABLE "PeriodMaterialShortage" ADD COLUMN     "priceBasisSnapshot" TEXT NOT NULL DEFAULT 'per_dag';

-- AlterTable
ALTER TABLE "PeriodStockItem" ADD COLUMN     "priceBasisSnapshot" TEXT NOT NULL DEFAULT 'per_dag';


-- Data step (hand-written, not part of the schema diff): inhuur-only materials
-- whose purchase price was never entered carry the supplier's price in
-- "dayPrice" (that is what the Rentman import put there). Move it to
-- "subhireUnitCost" (billed per rental), clear the selling price until someone
-- enters one, and bill the client per rental. Rows that already have a
-- purchase price keep their selling price and basis. Existing bookings keep
-- their snapshots.
UPDATE "Material"
SET "subhireUnitCost" = "dayPrice",
    "subhireCostBasis" = 'per_huur',
    "dayPrice" = 0,
    "priceBasis" = 'per_huur'
WHERE "subhireOnly" = true
  AND "subhireUnitCost" IS NULL;
