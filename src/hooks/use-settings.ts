import { useQuery } from "@tanstack/react-query";

/**
 * B1 — company/payment settings shown on every print document
 * (invoice/pakbon/callsheet/kosten). Reads the print-safe
 * `/api/settings/company` subset, which any signed-in user may fetch; the
 * full settings form keeps its own query against `/api/settings`. All
 * values are plain strings (the setting store is a flat key/value table),
 * so there is no Decimal/money conversion concern here.
 */
export type Settings = Record<string, string>;

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/company");
      if (!res.ok) throw new Error("Bedrijfsgegevens ophalen mislukt");
      return res.json();
    },
  });
}
