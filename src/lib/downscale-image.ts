/**
 * Downscales an image file in the browser before upload so a phone photo
 * (often 4-8 MB) lands in the DB (NoteImage.data, a Bytes column) as a
 * few hundred KB JPEG instead. Runs entirely client-side via <canvas> —
 * no server-side image library, matching this repo's "DB Bytes, zero new
 * infra" pattern for file storage (see lib/documents.ts).
 *
 * Non-image files or anything the browser can't decode as an
 * <img> are passed through unchanged — the caller still validates
 * mime type server-side.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}
