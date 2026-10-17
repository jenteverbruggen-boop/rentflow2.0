import { useQuery } from "@tanstack/react-query";
import type { Split } from "@/lib/stats-status";

export interface RevenueMonthEntry {
  month: string;
  /** Booked figures per bucket: agreed (bevestigd/actief/afgerond) and
   * still to confirm (concept). Cancelled projects are left out. */
  bookedPeople: Split;
  bookedMaterials: Split;
  bookedTravel: Split;
  booked: Split;
  invoiced: number;
}

export interface RevenueClientEntry {
  clientId: number;
  name: string;
  booked: Split;
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
  /** Ranked on `agreed`. */
  revenue: Split;
}

export interface PaybackEntry {
  materialId: number;
  name: string;
  code: string | null;
  earned: number;
  costBasis: number;
  paybackPct: number;
}

export interface SubhireStatsEntry {
  revenue: Split;
  cost: Split;
  margin: Split;
  rows: number;
  unpricedRows: number;
  componentCost: Split;
}

export interface StatsResponse {
  range: { from: string; to: string };
  revenueByMonth: RevenueMonthEntry[];
  revenueByClient: RevenueClientEntry[];
  personUtilisation: PersonUtilisationEntry[];
  topMaterials: TopMaterialEntry[];
  subhire: SubhireStatsEntry;
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
