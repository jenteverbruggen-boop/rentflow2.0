import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { getNote, updateNote, deleteNote } from "@/lib/notes";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  noteDate: z.string().optional(),
  projectId: z.number().int().positive().optional().nullable(),
  clientId: z.number().int().positive().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("notities", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const note = await getNote(parseInt(id, 10), access);
    if (!note) return notFound();
    return NextResponse.json(note);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  // allowOwnWrite — see POST /api/notes. A scope: own caller may only
  // edit a note they themselves wrote, on a project they're still
  // booked on; both checked below before any write.
  const access = await requireModule("notities", "wijzigen", { allowOwnWrite: true }).catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const noteId = parseInt(id, 10);
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { projectId: rawProjectId, clientId: rawClientId, noteDate, ...rest } = parsed.data;
    let projectId = rawProjectId;
    let clientId = rawClientId;
    if (projectId != null && clientId != null) {
      return badRequest("Een notitie kan niet aan zowel een project als een klant gekoppeld zijn");
    }

    if (access.scope === "own") {
      const existing = await getNote(noteId, access);
      if (!existing) return notFound();
      // Same project, different author — a scope: own caller may fix
      // their own note, never a co-worker's, even one on a project
      // they're both booked on.
      if (existing.createdById !== access.id) return forbidden();
      // Moving a note off their own project, or onto a client, isn't
      // something a scope: own caller can validate — drop both rather
      // than honour a value they have no visibility to check, mirroring
      // the redacted-money-field "ignore, don't reject" convention.
      projectId = undefined;
      clientId = undefined;
    }

    const user = await prisma.user.findUnique({ where: { id: access.id }, select: { name: true } });
    const note = await updateNote(noteId, {
      ...rest,
      ...(noteDate !== undefined ? { noteDate: new Date(noteDate) } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(clientId !== undefined ? { clientId } : {}),
      updatedById: access.id,
      updatedByName: user?.name ?? "Onbekend",
    });
    return NextResponse.json(note);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  // No allowOwnWrite here — deleting a note stays denied for scope: own
  // entirely, same as every other module. Only create/edit are carved
  // out.
  const access = await requireModule("notities", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    await deleteNote(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
