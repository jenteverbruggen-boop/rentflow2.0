import { periodDays } from "@/lib/pricing";
import { hiredRowRevenue } from "@/lib/subhire-revenue";
import { subhireTotal } from "@/lib/subhire-cost";
import { addToSplit, bucketOf, emptySplit, roundSplit, type BucketedPeriod, type Split } from "@/lib/stats-status";

export interface SubhireStats {
  /** What hired-in units were billed to clients (agreed / still to confirm). */
  revenue: Split;
  /** What suppliers charge for them (rows without a price count as 0 and are
   * reported in `unpricedRows`, so the margin reads as an upper bound then). */
  cost: Split;
  margin: Split;
  rows: number;
  unpricedRows: number;
  /** Of `cost`: what suppliers charge for hired-in *components of a set*. Their
   * revenue is the component's pro-rata share of the set line, so they count
   * in the margin like every other hired row. */
  componentCost: Split;
}

/**
 * The inhuur view of a set of periods: revenue from units hired in, their
 * purchase cost and the margin between them, each split into agreed and
 * still-to-confirm by project status (D1). Kept apart from the overall
 * revenue figures on purpose — hiring in is the one place RentFlow knows a
 * cost, and mixing it into "omzet" would skew the totals the PO compares
 * (units you own earn their keep over years, hired units cost per job).
 */
export function computeSubhireStats(periods: BucketedPeriod[]): SubhireStats {
  const revenue = emptySplit();
  const cost = emptySplit();
  const componentCost = emptySplit();
  let rows = 0;
  let unpricedRows = 0;
  for (const period of periods) {
    const days = periodDays(period);
    const bucket = bucketOf(period);
    for (const row of (period.shortages ?? []).filter((s) => s.supplierId != null)) {
      const total = subhireTotal(row, days);
      if (row.bundleBookingId != null) addToSplit(componentCost, bucket, total ?? 0);
      rows += 1;
      addToSplit(revenue, bucket, hiredRowRevenue(period, row, days));
      if (total == null) unpricedRows += 1;
      else addToSplit(cost, bucket, total);
    }
  }
  const margin = { agreed: revenue.agreed - cost.agreed, pending: revenue.pending - cost.pending };
  return {
    revenue: roundSplit(revenue), cost: roundSplit(cost), margin: roundSplit(margin),
    rows, unpricedRows, componentCost: roundSplit(componentCost),
  };
}
