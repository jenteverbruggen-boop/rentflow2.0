import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Args {
  periodId: number;
  projectId: number;
  onWarnings: (warnings: string[]) => void;
  onError: (error: string) => void;
}

/** The add/remove-unit/remove-bundle mutations for MaterialSplitEditor,
 * extracted so the component itself stays ≤150 lines (Y3.6) — pure move,
 * no behaviour change. */
export function useMaterialSplitMutations({
  periodId,
  projectId,
  onWarnings,
  onError,
}: Args) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", String(projectId)] });
    queryClient.invalidateQueries({ queryKey: ["available"] });
  };

  const add = useMutation({
    mutationFn: async (args: { materialId: number; quantity: number }) => {
      const res = await fetch(`/api/periods/${periodId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Toevoegen mislukt");
      return data as { warnings: string[] };
    },
    onSuccess: (data) => {
      onWarnings(data.warnings ?? []);
      onError("");
      invalidate();
    },
    onError: (err) => onError((err as Error).message),
  });

  const removeOne = useMutation({
    mutationFn: (assignmentId: number) =>
      fetch(`/api/periods/${periodId}/materials/${assignmentId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });

  const removeBundle = useMutation({
    mutationFn: (bundleBookingId: number) =>
      fetch(`/api/periods/${periodId}/bundles/${bundleBookingId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });

  return { add, removeOne, removeBundle };
}
