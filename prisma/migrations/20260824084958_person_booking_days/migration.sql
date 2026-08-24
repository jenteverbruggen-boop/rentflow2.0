-- CreateTable
CREATE TABLE "PeriodPersonDay" (
    "id" SERIAL NOT NULL,
    "periodPersonId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodPersonDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodPersonDay_periodPersonId_idx" ON "PeriodPersonDay"("periodPersonId");

-- AddForeignKey
ALTER TABLE "PeriodPersonDay" ADD CONSTRAINT "PeriodPersonDay_periodPersonId_fkey" FOREIGN KEY ("periodPersonId") REFERENCES "PeriodPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

