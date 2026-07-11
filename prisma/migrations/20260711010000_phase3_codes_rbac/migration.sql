-- Phase 3 DDL: Material.code, User.personId, role migration

-- Step 1: Add Material.code column (no index yet)
ALTER TABLE "Material" ADD COLUMN "code" TEXT;

-- Step 2: Backfill codes from notes field
UPDATE "Material" SET "code" = (
  SELECT SUBSTRING("notes" FROM '\m(\d{3,4}-\d{3})\M')
) WHERE "notes" IS NOT NULL;

-- Step 3: Deduplicate — lowest id keeps code, duplicates get cleared (they'll be re-assigned by the app)
WITH ranked AS (
  SELECT id, code, ROW_NUMBER() OVER (PARTITION BY code ORDER BY id) AS rn
  FROM "Material" WHERE code IS NOT NULL
)
UPDATE "Material" SET code = NULL
FROM ranked WHERE "Material".id = ranked.id AND ranked.rn > 1;

-- Step 4: Now safe to add unique index
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- Step 5: User.personId
ALTER TABLE "User" ADD COLUMN "personId" INTEGER;
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Migrate role values and change default
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'admin';
UPDATE "User" SET "role" = 'PLANNER' WHERE "role" = 'user';
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PLANNER';
