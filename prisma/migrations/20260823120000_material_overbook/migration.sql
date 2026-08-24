-- CreateTable
CREATE TABLE "PeriodMaterialShortage" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "bundleBookingId" INTEGER,
    "dayPriceSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "setupCostSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),

    CONSTRAINT "PeriodMaterialShortage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodMaterialShortage_periodId_idx" ON "PeriodMaterialShortage"("periodId");

-- AddForeignKey
ALTER TABLE "PeriodMaterialShortage" ADD CONSTRAINT "PeriodMaterialShortage_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodMaterialShortage" ADD CONSTRAINT "PeriodMaterialShortage_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodMaterialShortage" ADD CONSTRAINT "PeriodMaterialShortage_bundleBookingId_fkey" FOREIGN KEY ("bundleBookingId") REFERENCES "PeriodBundleBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

