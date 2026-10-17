import { periodDays } from "@/lib/pricing";
import { hiredRowRevenue } from "@/lib/subhire-revenue";
import { subhireTotal } from "@/lib/subhire-cost";
import type { Period } from "@/types";

export interface SubhireStats {
  /** What hired-in units were billed to clients. */
  revenue: number;
  /** What suppliers charge for them (rows without a price count as 0 and are
   * reported in `unpricedRows`, so the margin reads as an upper bound then). */
  cost: number;
  margin: number;
  rows: number;
  unpricedRows: number;
  /** Of `cost`: what suppliers charge for hired-in *components of a set*. Their
   * revenue is the component's pro-rata share of the set line, so they count
   * in the margin like every other hired row. */
  componentCost: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * The inhuur view of a set of periods: revenue from units hired in, their
 * purchase cost and the margin between them. Kept apart from the overall
 * revenue figures on purpose — hiring in is the one place RentFlow knows a
 * cost, and mixing it into "omzet" would skew the totals the PO compares
 * (units you own earn their keep over years, hired units cost per job).
 */
export function computeSubhireStats(periods: Period[]): SubhireStats {
  let revenue = 0;
  let cost = 0;
  let rows = 0;
  let unpricedRows = 0;
  let componentCost = 0;
  for (const period of periods) {
    const days = periodDays(period);
    for (const row of (period.shortages ?? []).filter((s) => s.supplierId != null)) {
      const total = subhireTotal(row, days);
      if (row.bundleBookingId != null) componentCost += total ?? 0;
      rows += 1;
      revenue += hiredRowRevenue(period, row, days);
      if (total == null) unpricedRows += 1;
      else cost += total;
    }
  }
  return { revenue: round(revenue), cost: round(cost), margin: round(revenue - cost), rows, unpricedRows, componentCost: round(componentCost) };
}
