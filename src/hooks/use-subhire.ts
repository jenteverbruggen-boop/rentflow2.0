import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SubhireCostBasis } from "@/types";

export interface SubhireValues {
  supplierId: number;
  quantity?: number;
  basis?: SubhireCostBasis;
  unitCost?: number | null;
  costOverride?: number | null;
}

/** Hire an overbooked row in (POST), change a hire (PATCH) or undo it
 * (DELETE) — all on `/api/periods/:periodId/shortages/:id/subhire`. */
export function useSubhire(projectId: number) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["project", String(projectId)] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["available"] });
  };
  const call = async (periodId: number, shortageId: number, method: string, body?: unknown) => {
    const res = await fetch(`/api/periods/${periodId}/shortages/${shortageId}/subhire`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Mislukt");
    return data;
  };

  const hire = useMutation({
    mutationFn: (a: { periodId: number; shortageId: number; values: SubhireValues }) => call(a.periodId, a.shortageId, "POST", a.values),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (a: { periodId: number; shortageId: number; values: Partial<Omit<SubhireValues, "quantity">> }) =>
      call(a.periodId, a.shortageId, "PATCH", a.values),
    onSuccess: refresh,
  });
  const undo = useMutation({
    mutationFn: (a: { periodId: number; shortageId: number }) => call(a.periodId, a.shortageId, "DELETE"),
    onSuccess: refresh,
  });
  return { hire, update, undo };
}
