-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "correctionOfId" INTEGER;

-- CreateIndex
CREATE INDEX "Invoice_correctionOfId_idx" ON "Invoice"("correctionOfId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

