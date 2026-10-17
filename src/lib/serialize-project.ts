import type { Prisma } from "@/generated/prisma/client";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import type { projectInclude } from "@/lib/project-include";

type ProjectWithIncludes = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;

/** Decimal money columns of a Material that the spreads below would otherwise
 * pass through raw (a string on Postgres). */
function materialExtraMoney(m: { costPrice: unknown; listPrice: unknown; revenueBefore: unknown; subhireUnitCost: unknown }) {
  return {
    costPrice: toNumberOrNull(m.costPrice),
    listPrice: toNumberOrNull(m.listPrice),
    revenueBefore: toNumberOrNull(m.revenueBefore),
    subhireUnitCost: toNumberOrNull(m.subhireUnitCost),
  };
}

/**
 * Explicit shape-aware mapper for the `projectInclude` tree returned by
 * `/api/projects`, `/api/projects/[id]`. Prefer this over a recursive
 * deep-walk: this is a hot path and the tree shape is fixed and known.
 *
 * Converts every Decimal-typed money field to a plain number so the wire
 * payload matches the `number` types declared in `src/types/index.ts`.
 */
export function serializeProject(project: ProjectWithIncludes) {
  return {
    ...project,
    periods: project.periods.map((period) => ({
      ...period,
      materials: period.materials.map((m) => ({
        ...m,
        dayPriceSnapshot: toNumber(m.dayPriceSnapshot),
        setupCostSnapshot: toNumberOrNull(m.setupCostSnapshot),
        discountPct: toNumberOrNull(m.discountPct),
        discountAmount: toNumberOrNull(m.discountAmount),
        stockItem: {
          ...m.stockItem,
          material: {
            ...m.stockItem.material,
            ...materialExtraMoney(m.stockItem.material),
            dayPrice: toNumber(m.stockItem.material.dayPrice),
            setupCost: toNumberOrNull(m.stockItem.material.setupCost),
            bundlePriceOverride: toNumberOrNull(
              m.stockItem.material.bundlePriceOverride,
            ),
          },
        },
      })),
      people: period.people.map((p) => ({
        ...p,
        dayPriceSnapshot: toNumber(p.dayPriceSnapshot),
        rateSnapshot: toNumberOrNull(p.rateSnapshot),
        discountPct: toNumberOrNull(p.discountPct),
        discountAmount: toNumberOrNull(p.discountAmount),
        travelCosts: p.travelCosts.map((t) => ({
          ...t,
          unitCost: toNumber(t.unitCost),
        })),
        person: { ...p.person, dayPrice: toNumber(p.person.dayPrice) },
        function: p.function
          ? {
              ...p.function,
              dayRate: toNumberOrNull(p.function.dayRate),
              hourRate: toNumberOrNull(p.function.hourRate),
            }
          : null,
      })),
      bundleBookings: period.bundleBookings.map((b) => ({
        ...b,
        dayPriceSnapshot: toNumber(b.dayPriceSnapshot),
        material: {
          ...b.material,
          ...materialExtraMoney(b.material),
          dayPrice: toNumber(b.material.dayPrice),
          setupCost: toNumberOrNull(b.material.setupCost),
          bundlePriceOverride: toNumberOrNull(b.material.bundlePriceOverride),
          components: b.material.components.map((c) => ({
            ...c,
            child: { ...c.child, ...materialExtraMoney(c.child), dayPrice: toNumber(c.child.dayPrice) },
          })),
        },
      })),
      shortages: period.shortages.map((s) => ({
        ...s,
        dayPriceSnapshot: toNumber(s.dayPriceSnapshot),
        setupCostSnapshot: toNumber(s.setupCostSnapshot),
        discountPct: toNumberOrNull(s.discountPct),
        discountAmount: toNumberOrNull(s.discountAmount),
        subhireUnitCost: toNumberOrNull(s.subhireUnitCost),
        subhireCostOverride: toNumberOrNull(s.subhireCostOverride),
        material: {
          ...s.material,
          ...materialExtraMoney(s.material),
          dayPrice: toNumber(s.material.dayPrice),
          setupCost: toNumberOrNull(s.material.setupCost),
          bundlePriceOverride: toNumberOrNull(s.material.bundlePriceOverride),
          subhireUnitCost: toNumberOrNull(s.material.subhireUnitCost),
        },
      })),
    })),
    materialPrices: project.materialPrices.map((mp) => ({
      ...mp,
      dayPrice: toNumber(mp.dayPrice),
      material: {
        ...mp.material,
        ...materialExtraMoney(mp.material),
        dayPrice: toNumber(mp.material.dayPrice),
        setupCost: toNumberOrNull(mp.material.setupCost),
        bundlePriceOverride: toNumberOrNull(mp.material.bundlePriceOverride),
      },
    })),
    personPrices: project.personPrices.map((pp) => ({
      ...pp,
      dayPrice: toNumber(pp.dayPrice),
      person: { ...pp.person, dayPrice: toNumber(pp.person.dayPrice) },
    })),
  };
}
