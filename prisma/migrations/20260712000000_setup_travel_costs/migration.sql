-- Setup/teardown cost on materials + per-person travel costs

ALTER TABLE "Material" ADD COLUMN "setupCost" DECIMAL(10,2);

ALTER TABLE "PeriodStockItem" ADD COLUMN "setupCostSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "PersonTravelCost" (
  "id" SERIAL NOT NULL,
  "periodPersonId" INTEGER NOT NULL,
  "label" TEXT,
  "unitCost" DECIMAL(10,2) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PersonTravelCost_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PersonTravelCost" ADD CONSTRAINT "PersonTravelCost_periodPersonId_fkey"
  FOREIGN KEY ("periodPersonId") REFERENCES "PeriodPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
