-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "defaultSupplierId" INTEGER,
ADD COLUMN     "subhireCostBasis" TEXT NOT NULL DEFAULT 'per_huur',
ADD COLUMN     "subhireOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subhireUnitCost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "PeriodMaterialShortage" ADD COLUMN     "subhireCostBasis" TEXT,
ADD COLUMN     "subhireCostOverride" DECIMAL(10,2),
ADD COLUMN     "subhireUnitCost" DECIMAL(10,2),
ADD COLUMN     "subhiredAt" TIMESTAMP(3),
ADD COLUMN     "supplierId" INTEGER;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "vatNumber" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodMaterialShortage_supplierId_idx" ON "PeriodMaterialShortage"("supplierId");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodMaterialShortage" ADD CONSTRAINT "PeriodMaterialShortage_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

