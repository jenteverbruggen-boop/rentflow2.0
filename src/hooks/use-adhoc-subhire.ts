import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PriceBasis, SubhireCostBasis } from "@/types";

export interface AdhocValues {
  name: string;
  supplierId: number;
  quantity: number;
  dayPrice?: number;
  priceBasis?: PriceBasis;
  unitCost?: number | null;
  costBasis?: SubhireCostBasis;
}

/** Thrown on a 409 name clash; carries the existing item's id. */
export class NameTakenError extends Error {
  materialId: number;
  constructor(message: string, materialId: number) {
    super(message);
    this.materialId = materialId;
  }
}

/** Create an inhuur-only item and hire it in for a period in one call. */
export function useAdhocSubhire(periodId: number, projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: AdhocValues) => {
      const res = await fetch(`/api/periods/${periodId}/adhoc-subhire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; materialId?: number; warnings?: string[] } | null;
      if (res.status === 409 && data?.materialId != null) throw new NameTakenError(data.error ?? "Naam bestaat al", data.materialId);
      if (!res.ok) throw new Error(data?.error ?? "Aanmaken mislukt");
      return data as { materialId: number; warnings: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", String(projectId)] });
      queryClient.invalidateQueries({ queryKey: ["available"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}
