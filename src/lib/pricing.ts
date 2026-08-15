import { differenceInCalendarDays } from "date-fns";
import type { Period, PeriodPerson, PeriodStockItem, Project } from "@/types";
import { toNumber } from "@/lib/serialize";

type PriceCarrier = Pick<Project, "materialPrices" | "personPrices">;

export function effectiveMaterialPriceFromProject(
  project: PriceCarrier,
  materialId: number,
  fallback: number,
): number {
  const override = project.materialPrices.find(
    (p) => p.materialId === materialId,
  );
  return override ? override.dayPrice : fallback;
}

export function effectivePersonPriceFromProject(
  project: PriceCarrier,
  personId: number,
  fallback: number,
): number {
  const override = project.personPrices.find((p) => p.personId === personId);
  return override ? override.dayPrice : fallback;
}

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

export function projectCostSummary(periods: Period[]): {
  people: number;
  materials: number;
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
  return {
    people,
    materials,
    travel,
    total: Math.round((people + materials + travel) * 100) / 100,
  };
}

export function periodTotal(period: Period): number {
  const days = periodDays(period);
  const flat = period.materials
    .filter((l) => !l.bundleBookingId)
    .reduce((acc, l) => acc + materialLineCost(l, days), 0);
  const bundles = (period.bundleBookings ?? []).reduce(
    (acc, b) => acc + b.dayPriceSnapshot * days * b.quantity,
    0,
  );
  const pers = period.people.reduce(
    (acc, l) => acc + personLineCost(l, days),
    0,
  );
  const travel = periodTravelCost(period);
  return Math.round((flat + bundles + pers + travel) * 100) / 100;
}

export function projectTotal(periods: Period[]): number {
  return (
    Math.round(periods.reduce((acc, p) => acc + periodTotal(p), 0) * 100) / 100
  );
}

// Split into money-format.ts to keep this file under the 150-line limit
// (Y1.2) — re-exported so existing import sites are unaffected.
export { BTW_RATE, btwAmount, withBtw, formatEUR } from "@/lib/money-format";
