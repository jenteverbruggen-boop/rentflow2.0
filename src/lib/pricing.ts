import { differenceInCalendarDays } from "date-fns";
import type { Period, PeriodPerson, PeriodStockItem } from "@/types";
import { toNumber } from "@/lib/serialize";

export function periodDays(
  period: Pick<Period, "startDate" | "endDate">,
): number {
  const days =
    differenceInCalendarDays(
      new Date(period.endDate),
      new Date(period.startDate),
    ) + 1;
  return Math.max(1, days);
}

export function lineCost(
  snapshot: number,
  days: number,
  discount: { discountPct?: number | null; discountAmount?: number | null },
): number {
  // Belt-and-braces: coerce even though Y1.3 also fixes this at the API
  // boundary — a raw Decimal string reaching this far must not silently
  // string-concatenate into a wrong total.
  const snapshotNum = toNumber(snapshot);
  const gross = snapshotNum * days;
  let net = gross;
  if (discount.discountPct != null) {
    net = gross * (1 - toNumber(discount.discountPct) / 100);
  } else if (discount.discountAmount != null) {
    net = gross - toNumber(discount.discountAmount);
  }
  return Math.max(0, Math.round(net * 100) / 100);
}

export function materialLineCost(line: PeriodStockItem, days: number): number {
  const rental = lineCost(line.dayPriceSnapshot, days, line);
  const setup = toNumber(line.setupCostSnapshot);
  return Math.round((rental + setup) * 100) / 100;
}

export function personLineCost(line: PeriodPerson, days: number): number {
  return lineCost(line.dayPriceSnapshot, days, line);
}

export function periodPeopleCost(period: Period): number {
  const days = periodDays(period);
  return (
    Math.round(
      period.people.reduce((acc, l) => acc + personLineCost(l, days), 0) * 100,
    ) / 100
  );
}

export function periodTravelCost(period: Period): number {
  const total = period.people.reduce(
    (acc, p) =>
      acc +
      (p.travelCosts ?? []).reduce(
        (s, t) => s + toNumber(t.unitCost) * t.quantity,
        0,
      ),
    0,
  );
  return Math.round(total * 100) / 100;
}

export function periodMaterialsCost(period: Period): number {
  const days = periodDays(period);
  const flat = period.materials
    .filter((l) => !l.bundleBookingId)
    .reduce((acc, l) => acc + materialLineCost(l, days), 0);
  const bundles = (period.bundleBookings ?? []).reduce(
    (acc, b) => acc + b.dayPriceSnapshot * days * b.quantity,
    0,
  );
  return Math.round((flat + bundles) * 100) / 100;
}

/**
 * people + materials only — excludes travel (Q22). Distinct from `total`,
 * which stays travel-inclusive per Q22; kept as its own function so J1's
 * itemised travel lines and the six display sites can all show the same
 * subtotal without recomputing it inline (J1.1).
 */
export function periodSubtotal(period: Period): number {
  return (
    Math.round((periodPeopleCost(period) + periodMaterialsCost(period)) * 100) /
    100
  );
}

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

// Travel stays inside the total per Q22 — the accountant's VAT-treatment
// review (outstanding, does not block this item) is a one-line change here
// and at the single BTW application site (cost-summary.tsx), not a hunt.
export function periodTotal(period: Period): number {
  return (
    Math.round((periodSubtotal(period) + periodTravelCost(period)) * 100) / 100
  );
}

export function projectTotal(periods: Period[]): number {
  return (
    Math.round(periods.reduce((acc, p) => acc + periodTotal(p), 0) * 100) / 100
  );
}

// Split into money-format.ts to keep this file under the 150-line limit
// (Y1.2) — re-exported so existing import sites are unaffected.
export { BTW_RATE, btwAmount, withBtw, formatEUR } from "@/lib/money-format";
