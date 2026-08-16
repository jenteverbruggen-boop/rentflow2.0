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
  };
}
