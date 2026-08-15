import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportPreview } from "@/lib/import/material-preview";
import type { ApplyMaterialImportResult } from "@/lib/import/apply-material-import";

async function throwOnError(res: Response): Promise<void> {
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Mislukt");
  }
}

/**
 * M1.5 — one hook, two mutations, mirroring preview/apply's own
 * pairing (M1.2/M1.4): `preview` never writes so it never invalidates
 * the materials list; only `apply`'s success does.
 */
export function useMaterialImport() {
  const queryClient = useQueryClient();

  const preview = useMutation({
    mutationFn: async (file: File): Promise<ImportPreview> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/materials/import/preview", { method: "POST", body: formData });
      await throwOnError(res);
      return res.json();
    },
  });

  const apply = useMutation({
    mutationFn: async (file: File): Promise<ApplyMaterialImportResult> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/materials/import", { method: "POST", body: formData });
      await throwOnError(res);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["materials"] }),
  });

  return { preview, apply };
}
