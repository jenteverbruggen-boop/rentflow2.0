import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportEntity, ImportMode, ImportPreview, ImportApplyResult } from "@/lib/import/pipeline-client-types";

async function readJsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data as { error?: string } | null)?.error ?? "Mislukt") as Error & {
      blockers?: unknown;
    };
    if (data && "blockers" in (data as object)) err.blockers = (data as { blockers: unknown }).blockers;
    throw err;
  }
  return data as T;
}

/** P3.4 — one hook for all four entities, both modes, mirroring
 * use-material-import.ts's own preview/apply pairing. */
export function useEntityImport(entity: ImportEntity) {
  const queryClient = useQueryClient();

  const preview = useMutation({
    mutationFn: async ({ file, mode }: { file: File; mode: ImportMode }): Promise<ImportPreview> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      const res = await fetch(`/api/import/${entity}/preview`, { method: "POST", body: formData });
      return readJsonOrThrow<ImportPreview>(res);
    },
  });

  const apply = useMutation({
    mutationFn: async ({
      file,
      mode,
      typedConfirmation,
    }: {
      file: File;
      mode: ImportMode;
      typedConfirmation?: string;
    }): Promise<ImportApplyResult> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      if (typedConfirmation) formData.append("typedConfirmation", typedConfirmation);
      const res = await fetch(`/api/import/${entity}/apply`, { method: "POST", body: formData });
      return readJsonOrThrow<ImportApplyResult>(res);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [entity] }),
  });

  return { preview, apply };
}
