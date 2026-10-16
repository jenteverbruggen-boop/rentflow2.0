import { prisma } from "@/lib/prisma";

type Tx = Pick<typeof prisma, "noteAssignee">;

/** Ids from `personIds` that are not an existing person. */
export async function findMissingPersonIds(personIds: number[]): Promise<number[]> {
  if (personIds.length === 0) return [];
  const found = await prisma.person.findMany({ where: { id: { in: personIds } }, select: { id: true } });
  const known = new Set(found.map((p) => p.id));
  return personIds.filter((id) => !known.has(id));
}

/**
 * Make a note's assignees exactly `personIds`. It diffs instead of
 * delete-and-recreate so an assignee who stays keeps their `doneAt` when
 * someone edits the note.
 */
export async function syncAssignees(tx: Tx, noteId: number, personIds: number[]): Promise<void> {
  const wanted = new Set(personIds);
  const current = await tx.noteAssignee.findMany({ where: { noteId }, select: { personId: true } });
  const have = new Set(current.map((a) => a.personId));
  const toRemove = [...have].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !have.has(id));
  if (toRemove.length > 0) await tx.noteAssignee.deleteMany({ where: { noteId, personId: { in: toRemove } } });
  if (toAdd.length > 0) {
    await tx.noteAssignee.createMany({ data: toAdd.map((personId) => ({ noteId, personId })) });
  }
}

/** An assignee ticks their own part off (or on again). Returns false when the
 * person isn't assigned to the note. */
export async function setAssigneeDone(noteId: number, personId: number, done: boolean): Promise<boolean> {
  const result = await prisma.noteAssignee.updateMany({
    where: { noteId, personId },
    data: { doneAt: done ? new Date() : null },
  });
  return result.count > 0;
}

/** Everyone who can be picked as an assignee: id and name only. */
export function listAssignablePeople() {
  return prisma.person.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
