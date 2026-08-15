-- N4.3: retire the legacy User.role string column now that every
-- permission decision goes through User.roleId -> Role.permissions
-- (requireModule()/resolveCurrentAccess(), N2). roleId was backfilled
-- for every existing row by the 20260815120000_add_roles_permissions
-- migration, so it is safe to make it required.
--
-- Defensive re-backfill first: if any row somehow still has a null
-- roleId (it should not, per the migration above), map it from the
-- legacy role string the same way that migration did, falling back to
-- PLANNER, so the NOT NULL constraint below never fails on real data.
UPDATE "User" u
SET "roleId" = r.id
FROM "Role" r
WHERE u."roleId" IS NULL
  AND r.key = CASE
    WHEN upper(u.role) IN ('ADMIN', 'PLANNER', 'VIEWER') THEN upper(u.role)
    ELSE 'PLANNER'
  END;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

ALTER TABLE "User" DROP COLUMN "role";
