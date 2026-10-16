import type { Prisma } from "@/generated/prisma/client";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

export const statsPeriodInclude = {
  materials: {
    include: { stockItem: { include: { material: true } } },
  },
  people: {
    include: { person: true, travelCosts: true },
  },
  bundleBookings: true,
  // Overbooked and hired-in units are billed like owned ones, so booked
  // revenue, the top-materials ranking and the inhuur figures all need them.
  // (Payback groups only `materials`, so owned-unit payback is unaffected.)
  shortages: { include: { material: true } },
} satisfies Prisma.PeriodInclude;

type StatsPeriod = Prisma.PeriodGetPayload<{ include: typeof statsPeriodInclude }>;

/** K1.1 — converts every Decimal-typed field on a period tree to a
 * plain number (Money rule), matching the shape `@/types`'s `Period`
 * declares so pricing.ts/grouping.ts's functions can be called on it
 * directly, same convention as serialize-project.ts's period mapping. */
export function serializeStatsPeriod(period: StatsPeriod) {
  return {
    ...period,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
    materials: period.materials.map((m) => ({
      ...m,
      dayPriceSnapshot: toNumber(m.dayPriceSnapshot),
      setupCostSnapshot: toNumberOrNull(m.setupCostSnapshot) ?? null,
      discountPct: toNumberOrNull(m.discountPct) ?? null,
      discountAmount: toNumberOrNull(m.discountAmount) ?? null,
      stockItem: {
        ...m.stockItem,
        material: {
          ...m.stockItem.material,
          dayPrice: toNumber(m.stockItem.material.dayPrice),
          setupCost: toNumberOrNull(m.stockItem.material.setupCost) ?? null,
          bundlePriceOverride: toNumberOrNull(m.stockItem.material.bundlePriceOverride) ?? null,
        },
      },
    })),
    people: period.people.map((p) => ({
      ...p,
      startAt: p.startAt ? p.startAt.toISOString() : null,
      endAt: p.endAt ? p.endAt.toISOString() : null,
      dayPriceSnapshot: toNumber(p.dayPriceSnapshot),
      rateSnapshot: toNumberOrNull(p.rateSnapshot) ?? null,
      discountPct: toNumberOrNull(p.discountPct) ?? null,
      discountAmount: toNumberOrNull(p.discountAmount) ?? null,
      travelCosts: p.travelCosts.map((t) => ({ ...t, unitCost: toNumber(t.unitCost) })),
      person: { ...p.person, dayPrice: toNumber(p.person.dayPrice) },
    })),
    bundleBookings: period.bundleBookings.map((b) => ({
      ...b,
      dayPriceSnapshot: toNumber(b.dayPriceSnapshot),
    })),
    shortages: period.shortages.map((s) => ({
      ...s,
      dayPriceSnapshot: toNumber(s.dayPriceSnapshot),
      setupCostSnapshot: toNumber(s.setupCostSnapshot),
      discountPct: toNumberOrNull(s.discountPct) ?? null,
      discountAmount: toNumberOrNull(s.discountAmount) ?? null,
      subhireUnitCost: toNumberOrNull(s.subhireUnitCost) ?? null,
      subhireCostOverride: toNumberOrNull(s.subhireCostOverride) ?? null,
      material: {
        ...s.material,
        dayPrice: toNumber(s.material.dayPrice),
        setupCost: toNumberOrNull(s.material.setupCost) ?? null,
        bundlePriceOverride: toNumberOrNull(s.material.bundlePriceOverride) ?? null,
        subhireUnitCost: toNumberOrNull(s.material.subhireUnitCost) ?? null,
      },
    })),
  };
}
