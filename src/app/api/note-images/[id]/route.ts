import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, notFound, serverError } from "@/lib/api-auth";
import { getNote } from "@/lib/notes";
import { getNoteImage, deleteNoteImage } from "@/lib/note-images";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("notities", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const image = await getNoteImage(parseInt(id, 10));
    if (!image) return notFound();
    // A scope: own caller may only fetch a photo whose note is on one of
    // their own projects — getNote already applies that scoping and
    // returns null for anything outside it, so "not visible" and
    // "doesn't exist" both come back as the same 404.
    if (access.scope === "own") {
      const note = await getNote(image.meta.noteId, access);
      if (!note) return notFound();
    }
    return new NextResponse(image.data.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": image.meta.mimeType,
        "Content-Disposition": `inline; filename="${image.meta.filename}"`,
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  // "wijzigen", not "verwijderen" — removing a photo from a note is
  // editing the note's content, not deleting the note record itself.
  // allowOwnWrite — see POST /api/notes; a scope: own caller may only
  // remove a photo from a note they themselves wrote.
  const access = await requireModule("notities", "wijzigen", { allowOwnWrite: true }).catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const imageId = parseInt(id, 10);
    if (access.scope === "own") {
      const image = await getNoteImage(imageId);
      if (!image) return notFound();
      const note = await getNote(image.meta.noteId, access);
      if (!note || note.createdById !== access.id) return forbidden();
    }
    await deleteNoteImage(imageId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
