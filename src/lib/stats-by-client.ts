import { periodPeopleCost, periodMaterialsCost, periodTravelCost } from "@/lib/pricing";
import type { Period } from "@/types";

export interface PeriodWithClient {
  period: Period;
  clientId: number | null;
  clientName: string | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** K1.1 — booked revenue per client over the whole requested range
 * (no month pro-rata here — that's `revenueByMonth`'s own concern).
 * Periods on a project with no client are skipped; there's no client
 * bucket to attribute them to. */
export function aggregateBookedByClient(entries: PeriodWithClient[]): Map<number, { name: string; booked: number }> {
  const byClient = new Map<number, { name: string; booked: number }>();
  for (const { period, clientId, clientName } of entries) {
    if (clientId == null) continue;
    const cost = periodPeopleCost(period) + periodMaterialsCost(period) + periodTravelCost(period);
    const existing = byClient.get(clientId);
    if (existing) existing.booked = round(existing.booked + cost);
    else byClient.set(clientId, { name: clientName ?? "", booked: round(cost) });
  }
  return byClient;
}
