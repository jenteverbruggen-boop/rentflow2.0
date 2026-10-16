import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { scopeFilter } from "@/lib/scope-filter";
import { listNotes, createNote } from "@/lib/notes";
import { findMissingPersonIds } from "@/lib/note-assignees";

const createSchema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  body: z.string().min(1, "Inhoud is verplicht"),
  noteDate: z.string().optional(),
  projectId: z.number().int().positive().optional().nullable(),
  clientId: z.number().int().positive().optional().nullable(),
  assigneeIds: z.array(z.number().int().positive()).max(50).optional(),
});

export async function GET(req: NextRequest) {
  const access = await requireModule("notities", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const params = req.nextUrl.searchParams;
    const projectIdRaw = params.get("projectId");
    const clientIdRaw = params.get("clientId");
    const assigneeIdRaw = params.get("assigneeId");
    // A scope: own caller has no client-linked or unassigned notes to
    // see at all (lib/notes.ts's listNotes ignores these for them
    // anyway) — dropping them here too just avoids a pointless query.
    const notes = await listNotes({
      projectId: projectIdRaw ? parseInt(projectIdRaw, 10) : undefined,
      clientId: access.scope === "own" ? undefined : (clientIdRaw ? parseInt(clientIdRaw, 10) : undefined),
      unassigned: access.scope === "own" ? false : params.get("unassigned") === "1",
      q: params.get("q") ?? undefined,
      assignedToMe: params.get("assignedToMe") === "1",
      open: params.get("open") === "1",
      assigneeId: assigneeIdRaw ? parseInt(assigneeIdRaw, 10) : undefined,
    }, access);
    return NextResponse.json(notes);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  // allowOwnWrite (src/lib/api-auth.ts) — a scope: own caller may create
  // a note, but only against a project they're actually booked on;
  // enforced below, right after parsing, before anything is written.
  const access = await requireModule("notities", "wijzigen", { allowOwnWrite: true }).catch(() => null);
  if (!access) return forbidden();
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { projectId, clientId, noteDate, assigneeIds: rawAssigneeIds, ...rest } = parsed.data;
    if (projectId != null && clientId != null) {
      return badRequest("Een notitie kan niet aan zowel een project als een klant gekoppeld zijn");
    }

    if (access.scope === "own") {
      if (clientId != null) return forbidden();
      if (projectId == null) return badRequest("Kies een project waarop je geboekt staat");
      const owns = await prisma.project.findFirst({ where: { id: projectId, ...scopeFilter(access) } });
      if (!owns) return forbidden();
    }

    // Handing a note to colleagues is a manager's call: a scope: own caller
    // can't list persons, so their assigneeIds are dropped, not honoured.
    const assigneeIds = access.scope === "own" ? [] : [...new Set(rawAssigneeIds ?? [])];
    if ((await findMissingPersonIds(assigneeIds)).length > 0) return badRequest("Onbekende persoon geselecteerd");

    const user = await prisma.user.findUnique({ where: { id: access.id }, select: { name: true } });
    const note = await createNote({
      ...rest,
      assigneeIds,
      noteDate: noteDate ? new Date(noteDate) : new Date(),
      projectId: projectId ?? null,
      clientId: clientId ?? null,
      createdById: access.id,
      createdByName: user?.name ?? "Onbekend",
    });
    return NextResponse.json(note);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
