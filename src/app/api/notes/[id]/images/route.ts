import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { getNote } from "@/lib/notes";
import { storeNoteImage, countNoteImages, MAX_IMAGE_SIZE, MAX_IMAGES_PER_NOTE } from "@/lib/note-images";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  // allowOwnWrite — see POST /api/notes. Adding a photo is only allowed
  // to a note the caller themselves wrote, on a project they're booked
  // on (same rule as editing the note's text).
  const access = await requireModule("notities", "wijzigen", { allowOwnWrite: true }).catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const noteId = parseInt(id, 10);

    if (access.scope === "own") {
      const note = await getNote(noteId, access);
      if (!note) return notFound();
      if (note.createdById !== access.id) return forbidden();
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return badRequest("Geen bestand ontvangen");
    if (!file.type.startsWith("image/")) return badRequest("Alleen afbeeldingen zijn toegestaan");
    if (file.size > MAX_IMAGE_SIZE) return badRequest("Afbeelding is te groot (max. 5 MB)");

    const existing = await countNoteImages(noteId);
    if (existing >= MAX_IMAGES_PER_NOTE) {
      return badRequest(`Maximaal ${MAX_IMAGES_PER_NOTE} afbeeldingen per notitie`);
    }

    const buffer = new Uint8Array(await file.arrayBuffer() as ArrayBuffer);
    const imageId = await storeNoteImage(
      { noteId, filename: file.name, mimeType: file.type, sizeBytes: file.size },
      buffer,
    );

    return NextResponse.json({ id: imageId });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
