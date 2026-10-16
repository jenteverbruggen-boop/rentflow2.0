-- CreateTable
CREATE TABLE "NoteAssignee" (
    "noteId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "NoteAssignee_pkey" PRIMARY KEY ("noteId","personId")
);

-- CreateIndex
CREATE INDEX "NoteAssignee_personId_idx" ON "NoteAssignee"("personId");

-- AddForeignKey
ALTER TABLE "NoteAssignee" ADD CONSTRAINT "NoteAssignee_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAssignee" ADD CONSTRAINT "NoteAssignee_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

