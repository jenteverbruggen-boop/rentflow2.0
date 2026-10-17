import { useQuery } from "@tanstack/react-query";
import type { StockHint } from "@/types";

/** Free-now / who-holds-it hints for a project's shortage rows. The key sits
 * under "available" so every place that refreshes availability refreshes
 * this too. */
export function useStockHints(projectId: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["available", "stock-hints", projectId] as const,
    queryFn: async (): Promise<Map<number, StockHint>> => {
      const res = await fetch(`/api/projects/${projectId}/stock-hints`);
      if (!res.ok) throw new Error("Ophalen mislukt");
      const hints = (await res.json()) as StockHint[];
      return new Map(hints.map((h) => [h.shortageId, h]));
    },
  });
}
