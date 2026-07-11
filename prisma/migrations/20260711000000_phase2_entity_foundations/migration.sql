-- Phase 2 DDL: entity foundations
-- Client, Location, Function, PersonFunction, Category, Setting
-- Plus new columns on Project, Person, Material

-- New lookup tables
CREATE TABLE "Client" (
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
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Location" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "postalCode" TEXT,
  "city" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Function" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Function_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Function_name_key" ON "Function"("name");

CREATE TABLE "PersonFunction" (
  "personId" INTEGER NOT NULL,
  "functionId" INTEGER NOT NULL,
  CONSTRAINT "PersonFunction_pkey" PRIMARY KEY ("personId","functionId")
);

CREATE TABLE "Category" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

CREATE TABLE "Setting" (
  "key" TEXT NOT NULL,
  "value" TEXT,
  "blob" BYTEA,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- New columns on existing tables
ALTER TABLE "Project" ADD COLUMN "clientId" INTEGER;
ALTER TABLE "Project" ADD COLUMN "locationId" INTEGER;

ALTER TABLE "Person" ADD COLUMN "address" TEXT;
ALTER TABLE "Person" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Person" ADD COLUMN "city" TEXT;
ALTER TABLE "Person" ADD COLUMN "country" TEXT;

ALTER TABLE "Material" ADD COLUMN "categoryId" INTEGER;

-- Foreign keys
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PersonFunction" ADD CONSTRAINT "PersonFunction_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonFunction" ADD CONSTRAINT "PersonFunction_functionId_fkey"
  FOREIGN KEY ("functionId") REFERENCES "Function"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: distinct Project.client strings -> Client rows
INSERT INTO "Client" ("name")
SELECT DISTINCT "client" FROM "Project" WHERE "client" IS NOT NULL AND "client" != ''
ON CONFLICT DO NOTHING;

UPDATE "Project" p SET "clientId" = c."id"
FROM "Client" c WHERE p."client" = c."name";

-- Backfill: distinct Project.location strings -> Location rows
INSERT INTO "Location" ("name")
SELECT DISTINCT "location" FROM "Project" WHERE "location" IS NOT NULL AND "location" != ''
ON CONFLICT DO NOTHING;

UPDATE "Project" p SET "locationId" = l."id"
FROM "Location" l WHERE p."location" = l."name";

-- Backfill: distinct Person.role strings -> Function rows + PersonFunction links
INSERT INTO "Function" ("name")
SELECT DISTINCT "role" FROM "Person" WHERE "role" IS NOT NULL AND "role" != ''
ON CONFLICT DO NOTHING;

INSERT INTO "PersonFunction" ("personId", "functionId")
SELECT p."id", f."id" FROM "Person" p
JOIN "Function" f ON f."name" = p."role"
WHERE p."role" IS NOT NULL AND p."role" != '';

-- Backfill: Material.category composites -> Category rows
-- Strip the " - Fysiek item" / " - Virtuele combinatie" suffix
INSERT INTO "Category" ("name", "prefix")
SELECT DISTINCT
  CASE
    WHEN "category" LIKE '% - %' THEN TRIM(SPLIT_PART("category", ' - ', 1))
    ELSE "category"
  END AS cat_name,
  '9999' AS prefix
FROM "Material"
WHERE "category" IS NOT NULL
  AND "category" != ''
  AND "category" NOT IN ('Fysiek item', 'Virtuele combinatie')
  AND (
    CASE WHEN "category" LIKE '% - %' THEN TRIM(SPLIT_PART("category", ' - ', 1)) ELSE "category" END
  ) NOT IN (SELECT "name" FROM "Category")
ON CONFLICT DO NOTHING;

UPDATE "Material" m SET "categoryId" = c."id"
FROM "Category" c
WHERE (
  CASE WHEN m."category" LIKE '% - %' THEN TRIM(SPLIT_PART(m."category", ' - ', 1)) ELSE m."category" END
) = c."name"
AND m."category" IS NOT NULL
AND m."category" NOT IN ('Fysiek item', 'Virtuele combinatie');

-- B7 data normalization: legacy midnight endDates -> 23:59:59
UPDATE "Period" SET "endDate" = "endDate" + INTERVAL '23 hours 59 minutes 59 seconds'
WHERE EXTRACT(HOUR FROM "endDate") = 0
  AND EXTRACT(MINUTE FROM "endDate") = 0
  AND EXTRACT(SECOND FROM "endDate") = 0;
