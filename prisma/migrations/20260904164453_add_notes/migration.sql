-- CreateTable
CREATE TABLE "Note" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "noteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" INTEGER,
    "clientId" INTEGER,
    "createdById" INTEGER,
    "createdByName" TEXT NOT NULL,
    "updatedById" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteImage" (
    "id" SERIAL NOT NULL,
    "noteId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_projectId_idx" ON "Note"("projectId");

-- CreateIndex
CREATE INDEX "Note_clientId_idx" ON "Note"("clientId");

-- CreateIndex
CREATE INDEX "Note_noteDate_idx" ON "Note"("noteDate");

-- CreateIndex
CREATE INDEX "NoteImage_noteId_idx" ON "NoteImage"("noteId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteImage" ADD CONSTRAINT "NoteImage_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill "notities" access for the three system roles, matching the
-- app's own recommendedLevel() defaults (src/lib/recommended-permissions.ts)
-- exactly — ADMIN gets verwijderen, PLANNER gets wijzigen, VIEWER gets
-- lezen — so notes aren't invisible to the seeded roles after this
-- deploys. Custom roles are deliberately left untouched (no row =
-- "geen"): per that same file's design note, a custom role has no
-- principled default and is always left for the PO to configure by hand.
INSERT INTO "RolePermission" ("roleId", "module", "access")
SELECT r."id", 'notities',
  CASE r."key" WHEN 'ADMIN' THEN 'verwijderen' WHEN 'PLANNER' THEN 'wijzigen' WHEN 'VIEWER' THEN 'lezen' END
FROM "Role" r
WHERE r."key" IN ('ADMIN', 'PLANNER', 'VIEWER')
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" existing
    WHERE existing."roleId" = r."id" AND existing."module" = 'notities'
  );
