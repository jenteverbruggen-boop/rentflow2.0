import type { NoteImage } from "@/types";

const VISIBLE = 4;

/** Compact, read-only photo strip for the note card — small thumbnails,
 * capped at four with a "+N" overlay on the last one. Uploading/removing
 * photos happens in the edit dialog (NoteImages), not here. */
export function NoteThumbnailStrip({ images }: { images: NoteImage[] }) {
  if (images.length === 0) return null;
  const shown = images.slice(0, VISIBLE);
  const extra = images.length - shown.length;

  return (
    <div className="flex gap-1.5">
      {shown.map((img, i) => {
        const isLast = i === shown.length - 1;
        return (
          <a
            key={img.id}
            href={`/api/note-images/${img.id}`}
            target="_blank"
            rel="noreferrer"
            className="relative shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/note-images/${img.id}`}
              alt={img.filename}
              className="h-9 w-9 rounded-md border border-border object-cover"
            />
            {isLast && extra > 0 && (
              <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 text-[10px] font-medium text-white">
                +{extra}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
