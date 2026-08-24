/**
 * Project-level cost aggregation, split out of pricing.ts to keep that
 * file under the 150-line limit — pure move, no behaviour change.
 * Re-exported from pricing.ts so existing import sites are unaffected.
 */
import type { Period } from "@/types";
import {
  periodPeopleCost,
  periodMaterialsCost,
  periodTravelCost,
  periodTotal,
} from "@/lib/pricing";

export function projectCostSummary(periods: Period[]): {
  people: number;
  materials: number;
  subtotal: number;
  travel: number;
  total: number;
} {
  const people =
    Math.round(periods.reduce((acc, p) => acc + periodPeopleCost(p), 0) * 100) /
    100;
  const materials =
    Math.round(
      periods.reduce((acc, p) => acc + periodMaterialsCost(p), 0) * 100,
    ) / 100;
  const travel =
    Math.round(periods.reduce((acc, p) => acc + periodTravelCost(p), 0) * 100) /
    100;
  const subtotal = Math.round((people + materials) * 100) / 100;
  return {
    people,
    materials,
    subtotal,
    travel,
    total: Math.round((subtotal + travel) * 100) / 100,
  };
}

export function projectTotal(periods: Period[]): number {
  return (
    Math.round(periods.reduce((acc, p) => acc + periodTotal(p), 0) * 100) / 100
  );
}
