import { periodPeopleCost, periodMaterialsCost, periodTravelCost } from "@/lib/pricing";
import { addToSplit, bucketOf, emptySplit, roundSplit, type BucketedPeriod, type Split } from "@/lib/stats-status";

export interface PeriodWithClient {
  period: BucketedPeriod;
  clientId: number | null;
  clientName: string | null;
}

/** K1.1 — booked revenue per client over the whole requested range
 * (no month pro-rata here — that's `revenueByMonth`'s own concern), split
 * into agreed and still-to-confirm (D1). Periods on a project with no client
 * are skipped; there's no client bucket to attribute them to. */
export function aggregateBookedByClient(entries: PeriodWithClient[]): Map<number, { name: string; booked: Split }> {
  const byClient = new Map<number, { name: string; booked: Split }>();
  for (const { period, clientId, clientName } of entries) {
    if (clientId == null) continue;
    const cost = periodPeopleCost(period) + periodMaterialsCost(period) + periodTravelCost(period);
    const existing = byClient.get(clientId) ?? { name: clientName ?? "", booked: emptySplit() };
    addToSplit(existing.booked, bucketOf(period), cost);
    byClient.set(clientId, existing);
  }
  for (const entry of byClient.values()) entry.booked = roundSplit(entry.booked);
  return byClient;
}
