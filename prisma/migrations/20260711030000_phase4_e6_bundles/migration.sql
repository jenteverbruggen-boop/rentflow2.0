-- E6: Bundle models

ALTER TABLE "Material" ADD COLUMN "isBundle" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Material" ADD COLUMN "bundlePriceOverride" DECIMAL(10,2);

ALTER TABLE "Period" ADD COLUMN dummy TEXT;
ALTER TABLE "Period" DROP COLUMN dummy;

ALTER TABLE "PeriodStockItem" ADD COLUMN "bundleBookingId" INTEGER;

CREATE TABLE "MaterialComponent" (
  "id" SERIAL NOT NULL,
  "parentId" INTEGER NOT NULL,
  "childId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "MaterialComponent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialComponent_parentId_childId_key" ON "MaterialComponent"("parentId","childId");
ALTER TABLE "MaterialComponent" ADD CONSTRAINT "MaterialComponent_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialComponent" ADD CONSTRAINT "MaterialComponent_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PeriodBundleBooking" (
  "id" SERIAL NOT NULL,
  "periodId" INTEGER NOT NULL,
  "materialId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "dayPriceSnapshot" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "PeriodBundleBooking_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PeriodBundleBooking" ADD CONSTRAINT "PeriodBundleBooking_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeriodBundleBooking" ADD CONSTRAINT "PeriodBundleBooking_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeriodStockItem" ADD CONSTRAINT "PeriodStockItem_bundleBookingId_fkey"
  FOREIGN KEY ("bundleBookingId") REFERENCES "PeriodBundleBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
