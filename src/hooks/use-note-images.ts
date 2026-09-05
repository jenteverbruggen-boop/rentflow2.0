import { useMutation, useQueryClient } from "@tanstack/react-query";
import { downscaleImage } from "@/lib/downscale-image";

async function uploadOne(noteId: number, file: File): Promise<void> {
  const scaled = await downscaleImage(file);
  const fd = new FormData();
  fd.append("file", scaled);
  const res = await fetch(`/api/notes/${noteId}/images`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload mislukt");
}

export function useNoteImageMutations(noteId: number) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notes"] });

  const upload = useMutation({
    // Sequential, not Promise.all — each request re-checks the note's
    // current image count server-side, so uploading in parallel could
    // let a batch race past the per-note cap. One file failing (wrong
    // type, too large, cap reached partway through) doesn't stop the
    // rest; every per-file error is collected and reported together.
    mutationFn: async (files: File[]) => {
      const errors: string[] = [];
      for (const file of files) {
        try {
          await uploadOne(noteId, file);
        } catch (err) {
          errors.push(`${file.name}: ${(err as Error).message}`);
        }
      }
      if (errors.length > 0) throw new Error(errors.join("\n"));
    },
    // onSettled, not onSuccess — a partial failure still leaves some
    // files uploaded, and those should show up immediately rather than
    // waiting for the next unrelated invalidation.
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (imageId: number) =>
      fetch(`/api/note-images/${imageId}`, { method: "DELETE" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Verwijderen mislukt");
        return data;
      }),
    onSuccess: invalidate,
  });

  return { upload, remove };
}
