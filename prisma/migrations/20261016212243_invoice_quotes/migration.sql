-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "sourceQuoteId" INTEGER,
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Invoice_sourceQuoteId_idx" ON "Invoice"("sourceQuoteId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

