import type { Prisma } from "@/generated/prisma/client";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import type { projectInclude } from "@/lib/project-include";

type ProjectWithIncludes = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;

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
          dayPrice: toNumber(b.material.dayPrice),
          setupCost: toNumberOrNull(b.material.setupCost),
          bundlePriceOverride: toNumberOrNull(b.material.bundlePriceOverride),
          components: b.material.components.map((c) => ({
            ...c,
            child: { ...c.child, dayPrice: toNumber(c.child.dayPrice) },
          })),
        },
      })),
    })),
    materialPrices: project.materialPrices.map((mp) => ({
      ...mp,
      dayPrice: toNumber(mp.dayPrice),
      material: {
        ...mp.material,
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
