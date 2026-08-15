-- N1.2: custom roles, module registry storage, permission matrix.
-- Schema commit 1 of 2 in phase 1 — User.role stays until N4.3 retires it;
-- both columns coexist for the rest of this phase.

CREATE TABLE "Role" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT NOT NULL DEFAULT 'all',
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

CREATE TABLE "RolePermission" (
  "id" SERIAL NOT NULL,
  "roleId" INTEGER NOT NULL,
  "module" TEXT NOT NULL,
  "access" TEXT NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RolePermission_roleId_module_key" ON "RolePermission"("roleId", "module");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "roleId" INTEGER;

ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the three system roles (renameable, undeletable — enforced in
-- application code, not by the schema).
INSERT INTO "Role" ("key", "label", "isSystem", "scope") VALUES
  ('ADMIN', 'Admin', true, 'all'),
  ('PLANNER', 'Planner', true, 'all'),
  ('VIEWER', 'Viewer', true, 'all');

-- Fully-open seed (decision C1): every role gets verwijderen on every
-- module, so nobody loses access on deployment. The PO tightens it
-- themselves via N3.3's recommended-defaults action.
INSERT INTO "RolePermission" ("roleId", "module", "access")
SELECT r."id", m.module, 'verwijderen'
FROM "Role" r
CROSS JOIN (VALUES
  ('projecten'), ('planning'), ('personen'), ('materialen'), ('klanten'),
  ('locaties'), ('kosten_facturen'), ('cijfers'), ('gebruikers'), ('instellingen')
) AS m(module);

-- Backfill User.roleId from the legacy User.role string. Match is
-- case-insensitive against the three system role keys (the column has no
-- check constraint, so nothing has ever guaranteed upper case). Anything
-- that doesn't match — including NULL — falls back to PLANNER and is
-- logged via RAISE NOTICE so an operator can review it after the fact,
-- rather than silently dropped.
DO $$
DECLARE
  rec RECORD;
  planner_id INTEGER;
  matched_id INTEGER;
BEGIN
  SELECT "id" INTO planner_id FROM "Role" WHERE "key" = 'PLANNER';

  FOR rec IN SELECT "id", "role" FROM "User" LOOP
    SELECT "id" INTO matched_id
    FROM "Role"
    WHERE "key" = UPPER(rec."role") AND "isSystem" = true;

    IF matched_id IS NULL THEN
      RAISE NOTICE 'User % had unmatched role "%": defaulted roleId to PLANNER', rec."id", rec."role";
      UPDATE "User" SET "roleId" = planner_id WHERE "id" = rec."id";
    ELSE
      UPDATE "User" SET "roleId" = matched_id WHERE "id" = rec."id";
    END IF;
  END LOOP;
END $$;
