import { useMutation, useQueryClient } from "@tanstack/react-query";
import { downscaleImage } from "@/lib/downscale-image";

export function useNoteImageMutations(noteId: number) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notes"] });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const scaled = await downscaleImage(file);
      const fd = new FormData();
      fd.append("file", scaled);
      const res = await fetch(`/api/notes/${noteId}/images`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload mislukt");
      return data;
    },
    onSuccess: invalidate,
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
