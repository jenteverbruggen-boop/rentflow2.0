import { prisma } from "@/lib/prisma";
import type { ScopeAccess } from "@/lib/scope-filter";
import { buildNoteWhere, noteVisibility, type NoteFilter } from "@/lib/note-where";
import { syncAssignees } from "@/lib/note-assignees";
import type { Note } from "@/types";

const SELECT = {
  id: true,
  title: true,
  body: true,
  noteDate: true,
  projectId: true,
  clientId: true,
  createdById: true,
  createdByName: true,
  updatedById: true,
  updatedByName: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
  images: {
    select: { id: true, noteId: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
  assignees: {
    select: { personId: true, doneAt: true, person: { select: { name: true } } },
    orderBy: { person: { name: "asc" as const } },
  },
} as const;

type NoteRow = Awaited<ReturnType<typeof prisma.note.findFirstOrThrow<{ select: typeof SELECT }>>>;

function serialize(row: NoteRow): Note {
  return {
    ...row,
    noteDate: row.noteDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    images: row.images.map((img) => ({ ...img, createdAt: img.createdAt.toISOString() })),
    assignees: row.assignees.map((a) => ({
      personId: a.personId,
      personName: a.person.name,
      doneAt: a.doneAt?.toISOString() ?? null,
    })),
  };
}

export type { NoteFilter } from "@/lib/note-where";

export async function listNotes(filter: NoteFilter, access: ScopeAccess): Promise<Note[]> {
  const rows = await prisma.note.findMany({
    where: buildNoteWhere(filter, access),
    select: SELECT,
    orderBy: { noteDate: "desc" },
  });
  return rows.map(serialize);
}

export async function getNote(id: number, access: ScopeAccess): Promise<Note | null> {
  // Visibility is folded into the same where as the id lookup (same
  // reasoning as projects/[id]/route.ts): "not mine" and "doesn't exist"
  // both resolve to null through one code path, so a scope: own caller gets
  // 404, never a separate 403 branch to forget. The note-image routes go
  // through here too, so assigned notes' photos follow the same rule.
  const visibility = noteVisibility(access);
  const row = await prisma.note.findFirst({
    where: visibility ? { AND: [{ id }, visibility] } : { id },
    select: SELECT,
  });
  return row ? serialize(row) : null;
}

interface CreateArgs {
  title: string;
  body: string;
  noteDate: Date;
  projectId: number | null;
  clientId: number | null;
  createdById: number;
  createdByName: string;
  assigneeIds?: number[];
}

export async function createNote(args: CreateArgs): Promise<Note> {
  const row = await prisma.note.create({
    data: {
      title: args.title,
      body: args.body,
      noteDate: args.noteDate,
      projectId: args.projectId,
      clientId: args.clientId,
      createdById: args.createdById,
      createdByName: args.createdByName,
      assignees: { create: (args.assigneeIds ?? []).map((personId) => ({ personId })) },
    },
    select: SELECT,
  });
  return serialize(row);
}

interface UpdateArgs {
  title?: string;
  body?: string;
  noteDate?: Date;
  projectId?: number | null;
  clientId?: number | null;
  updatedById: number;
  updatedByName: string;
  /** `undefined` leaves the assignees alone, `[]` clears them. */
  assigneeIds?: number[];
}

export async function updateNote(id: number, args: UpdateArgs): Promise<Note> {
  const { updatedById, updatedByName, assigneeIds, ...rest } = args;
  const row = await prisma.$transaction(async (tx) => {
    if (assigneeIds !== undefined) await syncAssignees(tx, id, assigneeIds);
    return tx.note.update({
      where: { id },
      data: { ...rest, updatedById, updatedByName },
      select: SELECT,
    });
  });
  return serialize(row);
}

export async function deleteNote(id: number): Promise<void> {
  await prisma.note.delete({ where: { id } });
}
