import { prisma } from "@/lib/prisma";
import { scopeFilter, type ScopeAccess } from "@/lib/scope-filter";
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
} as const;

type NoteRow = Awaited<ReturnType<typeof prisma.note.findFirstOrThrow<{ select: typeof SELECT }>>>;

function serialize(row: NoteRow): Note {
  return {
    ...row,
    noteDate: row.noteDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    images: row.images.map((img) => ({ ...img, createdAt: img.createdAt.toISOString() })),
  };
}

export interface NoteFilter {
  projectId?: number;
  clientId?: number;
  unassigned?: boolean;
  q?: string;
}

export async function listNotes(filter: NoteFilter, access: ScopeAccess): Promise<Note[]> {
  const where: Record<string, unknown> = {};
  if (access.scope === "own") {
    // A scoped caller only ever sees notes on a project they're booked
    // on — never client-linked or unassigned notes, neither of which
    // has a per-project ownership concept scopeFilter can check, so the
    // only safe answer is to exclude them (own-data-scoping-design.md's
    // bucket-(c) reasoning, extended here). `projectId` may still
    // narrow further, but only within that same scope — an id outside
    // it combines with `project` below to just match nothing, never
    // leaking company-wide notes.
    where.project = scopeFilter(access);
    if (filter.projectId != null) where.projectId = filter.projectId;
  } else if (filter.unassigned) {
    where.projectId = null;
    where.clientId = null;
  } else if (filter.projectId != null) {
    where.projectId = filter.projectId;
  } else if (filter.clientId != null) {
    where.clientId = filter.clientId;
  }
  if (filter.q) {
    // No `mode: "insensitive"` — that's Postgres/Mongo-only in Prisma and
    // throws against the SQLite dev schema. Plain `contains` is already
    // case-insensitive on SQLite for ASCII; Postgres stays case-sensitive
    // here, matching every other search filter in this codebase (none
    // uses `mode` either).
    where.OR = [
      { title: { contains: filter.q } },
      { body: { contains: filter.q } },
    ];
  }
  const rows = await prisma.note.findMany({
    where,
    select: SELECT,
    orderBy: { noteDate: "desc" },
  });
  return rows.map(serialize);
}

export async function getNote(id: number, access: ScopeAccess): Promise<Note | null> {
  const where: Record<string, unknown> = { id };
  // Ownership folded into the same where as the id lookup, same
  // reasoning as projects/[id]/route.ts: "not on one of my projects"
  // and "doesn't exist" both resolve to null through one code path, so
  // a scope: own caller gets 404, never a separate 403 branch to forget.
  if (access.scope === "own") where.project = scopeFilter(access);
  const row = await prisma.note.findFirst({ where, select: SELECT });
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
}

export async function updateNote(id: number, args: UpdateArgs): Promise<Note> {
  const { updatedById, updatedByName, ...rest } = args;
  const row = await prisma.note.update({
    where: { id },
    data: { ...rest, updatedById, updatedByName },
    select: SELECT,
  });
  return serialize(row);
}

export async function deleteNote(id: number): Promise<void> {
  await prisma.note.delete({ where: { id } });
}
