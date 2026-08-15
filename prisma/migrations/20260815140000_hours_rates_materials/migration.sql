-- DDL-2 (phase 2): booking hours, function rates and material cost
-- fields. Additive only — no existing column is dropped or narrowed,
-- and every new column is nullable or has a default that matches
-- today's implicit behavior, so no existing row changes value and no
-- existing dayPriceSnapshot/query shape is affected.

-- Function: company-default rates (L1). Both nullable — a function
-- with no rate falls back further down effective-price.ts's chain.
ALTER TABLE "Function" ADD COLUMN "dayRate" DECIMAL(10, 2);
ALTER TABLE "Function" ADD COLUMN "hourRate" DECIMAL(10, 2);

-- PersonFunction: per-person override rates (L1).
ALTER TABLE "PersonFunction" ADD COLUMN "dayRate" DECIMAL(10, 2);
ALTER TABLE "PersonFunction" ADD COLUMN "hourRate" DECIMAL(10, 2);

-- ClientFunctionRate: new table, per-client rate card (L3).
CREATE TABLE "ClientFunctionRate" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "functionId" INTEGER NOT NULL,
    "dayRate" DECIMAL(10, 2),
    "hourRate" DECIMAL(10, 2),

    CONSTRAINT "ClientFunctionRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientFunctionRate_clientId_functionId_key"
    ON "ClientFunctionRate"("clientId", "functionId");

ALTER TABLE "ClientFunctionRate"
    ADD CONSTRAINT "ClientFunctionRate_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientFunctionRate"
    ADD CONSTRAINT "ClientFunctionRate_functionId_fkey"
    FOREIGN KEY ("functionId") REFERENCES "Function"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Material: archive flag + cost/list/pre-import-revenue figures
-- (M1 import, K4 payback, phase 3).
ALTER TABLE "Material" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Material" ADD COLUMN "costPrice" DECIMAL(10, 2);
ALTER TABLE "Material" ADD COLUMN "listPrice" DECIMAL(10, 2);
ALTER TABLE "Material" ADD COLUMN "revenueBefore" DECIMAL(10, 2);

-- StockItem: optional per-unit cost override (K4).
ALTER TABLE "StockItem" ADD COLUMN "costPrice" DECIMAL(10, 2);

-- PeriodPerson: assignment-level time window (H1), forced-overlap
-- marker (H2), the chosen function (L2), and hourly-billing fields
-- (H5/L5). `startAt`/`endAt` null means "inherit the period window" —
-- every existing row keeps that behavior unchanged. `billingUnit`
-- defaults to 'dag' (today's only mode) and `rateSnapshot` stays null
-- on every existing row, so H5.1's `rateSnapshot ?? dayPriceSnapshot`
-- precedence reads every historical booking exactly as before.
ALTER TABLE "PeriodPerson" ADD COLUMN "functionId" INTEGER;
ALTER TABLE "PeriodPerson" ADD COLUMN "startAt" TIMESTAMP(3);
ALTER TABLE "PeriodPerson" ADD COLUMN "endAt" TIMESTAMP(3);
ALTER TABLE "PeriodPerson" ADD COLUMN "overlapAck" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PeriodPerson" ADD COLUMN "billingUnit" TEXT NOT NULL DEFAULT 'dag';
ALTER TABLE "PeriodPerson" ADD COLUMN "rateSnapshot" DECIMAL(10, 2);

ALTER TABLE "PeriodPerson"
    ADD CONSTRAINT "PeriodPerson_functionId_fkey"
    FOREIGN KEY ("functionId") REFERENCES "Function"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
