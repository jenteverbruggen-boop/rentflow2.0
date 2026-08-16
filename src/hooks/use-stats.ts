import { useQuery } from "@tanstack/react-query";

export interface RevenueMonthEntry {
  month: string;
  bookedPeople: number;
  bookedMaterials: number;
  bookedTravel: number;
  booked: number;
  invoiced: number;
}

export interface RevenueClientEntry {
  clientId: number;
  name: string;
  booked: number;
  invoiced: number;
}

export interface PersonUtilisationEntry {
  personId: number;
  name: string;
  bookedDays: number;
  bookedHours: number;
}

export interface TopMaterialEntry {
  materialId: number;
  name: string;
  code: string | null;
  revenue: number;
}

export interface PaybackEntry {
  materialId: number;
  name: string;
  code: string | null;
  earned: number;
  costBasis: number;
  paybackPct: number;
}

export interface StatsResponse {
  range: { from: string; to: string };
  revenueByMonth: RevenueMonthEntry[];
  revenueByClient: RevenueClientEntry[];
  personUtilisation: PersonUtilisationEntry[];
  topMaterials: TopMaterialEntry[];
  payback: { best: PaybackEntry[]; worst: PaybackEntry[] };
}

/** K2.2-K2.4 — the /cijfers page's single data source (K1's
 * aggregation endpoint). `payback` ignores `from`/`to` (K4 — it's
 * lifetime-to-date), every other field is scoped to the requested
 * range. */
export function useStats(from: string, to: string) {
  return useQuery({
    queryKey: ["stats", from, to],
    queryFn: async (): Promise<StatsResponse> => {
      const res = await fetch(`/api/stats?from=${from}&to=${to}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Ophalen mislukt");
      }
      return res.json();
    },
  });
}
