-- CreateTable
CREATE TABLE "ImportAudit" (
    "id" SERIAL NOT NULL,
    "entity" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCounts" JSONB NOT NULL,
    "blockedBy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportAudit_entity_createdAt_idx" ON "ImportAudit"("entity", "createdAt");
