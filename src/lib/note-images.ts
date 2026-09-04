import { prisma } from "@/lib/prisma";
import type { NoteImage } from "@/types";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_NOTE = 10;

interface StoreArgs {
  noteId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export async function storeNoteImage(args: StoreArgs, buffer: Uint8Array<ArrayBuffer>): Promise<number> {
  const image = await prisma.noteImage.create({
    data: { ...args, data: buffer },
    select: { id: true },
  });
  return image.id;
}

export async function countNoteImages(noteId: number): Promise<number> {
  return prisma.noteImage.count({ where: { noteId } });
}

export async function getNoteImage(id: number): Promise<{ meta: NoteImage; data: Uint8Array } | null> {
  const image = await prisma.noteImage.findUnique({ where: { id } });
  if (!image) return null;
  const meta: NoteImage = {
    id: image.id,
    noteId: image.noteId,
    filename: image.filename,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    createdAt: image.createdAt.toISOString(),
  };
  return { meta, data: new Uint8Array(image.data) };
}

export async function deleteNoteImage(id: number): Promise<void> {
  await prisma.noteImage.delete({ where: { id } });
}
