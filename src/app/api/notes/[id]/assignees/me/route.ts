import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { getNote } from "@/lib/notes";
import { setAssigneeDone } from "@/lib/note-assignees";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ done: z.boolean() });

/** PATCH /api/notes/:id/assignees/me { done } — the caller ticks off (or
 * reopens) their own part of a note they are assigned to. It only touches
 * the caller's own assignee row — a status of their own, not an edit of the
 * note — so `notities: lezen` is enough, for scoped users too. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("notities", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.personId == null) return forbidden();
  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("done moet true of false zijn");

    const noteId = parseInt(id, 10);
    if (!(await getNote(noteId, access))) return notFound();
    if (!(await setAssigneeDone(noteId, access.personId, parsed.data.done))) return forbidden();
    return NextResponse.json(await getNote(noteId, access));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
