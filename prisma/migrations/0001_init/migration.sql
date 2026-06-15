-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'concept',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMaterialPrice" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "dayPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ProjectMaterialPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPersonPrice" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "dayPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ProjectPersonPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "dayPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "dayPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" SERIAL NOT NULL,
    "materialId" INTEGER NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "identifier" TEXT,
    "notes" TEXT,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodStockItem" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "dayPriceSnapshot" DECIMAL(10,2) NOT NULL,
    "discountPct" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),

    CONSTRAINT "PeriodStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodPerson" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "role" TEXT,
    "dayPriceSnapshot" DECIMAL(10,2) NOT NULL,
    "discountPct" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),

    CONSTRAINT "PeriodPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMaterialPrice_projectId_materialId_key" ON "ProjectMaterialPrice"("projectId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPersonPrice_projectId_personId_key" ON "ProjectPersonPrice"("projectId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_materialId_unitNumber_key" ON "StockItem"("materialId", "unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodStockItem_periodId_stockItemId_key" ON "PeriodStockItem"("periodId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodPerson_periodId_personId_key" ON "PeriodPerson"("periodId", "personId");

-- AddForeignKey
ALTER TABLE "ProjectMaterialPrice" ADD CONSTRAINT "ProjectMaterialPrice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialPrice" ADD CONSTRAINT "ProjectMaterialPrice_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPersonPrice" ADD CONSTRAINT "ProjectPersonPrice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPersonPrice" ADD CONSTRAINT "ProjectPersonPrice_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodStockItem" ADD CONSTRAINT "PeriodStockItem_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodStockItem" ADD CONSTRAINT "PeriodStockItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPerson" ADD CONSTRAINT "PeriodPerson_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPerson" ADD CONSTRAINT "PeriodPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
