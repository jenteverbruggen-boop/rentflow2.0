import type { PrismaClient } from "@/generated/prisma/client";
import type { ShortageSubhire } from "@/lib/subhire-defaults";

interface ShortageRowArgs {
  periodId: number;
  materialId: number;
  quantity: number;
  bundleBookingId?: number | null;
  dayPriceSnapshot: number;
  setupCostSnapshot?: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  /** Created already hired in from this supplier (resolved, never open). */
  subhire?: ShortageSubhire | null;
}

/**
 * Overboeken — adds `quantity` to the matching `PeriodMaterialShortage`
 * row (same period/material/bundleBooking/price/discount) or creates one.
 * Must run inside the caller's transaction, after `lockMaterials` — the
 * `findFirst`-then-write is only race-free under that lock, same as the
 * rest of booking.ts. Kept in its own module (not booking.ts or
 * material-shortage-db.ts) so booking.ts can call it without a circular
 * import back to the db-facing shortage helpers.
 */
export async function createOrIncrementShortage(
  tx: PrismaClient,
  args: ShortageRowArgs,
): Promise<void> {
  const bundleBookingId = args.bundleBookingId ?? null;
  const discountPct = args.discountPct ?? null;
  const discountAmount = args.discountAmount ?? null;

  // A fixed supplier total belongs to exactly one booking: merging two such
  // rows would keep one total for twice the units.
  const existing = args.subhire?.costOverride != null ? null : await tx.periodMaterialShortage.findFirst({
    where: {
      periodId: args.periodId,
      materialId: args.materialId,
      bundleBookingId,
      dayPriceSnapshot: args.dayPriceSnapshot,
      discountPct,
      discountAmount,
      // Open units only fold into open rows, hired-in units only into a row
      // of the same supplier and price — never across, or they would silently
      // inherit the wrong supplier and cost.
      supplierId: args.subhire?.supplierId ?? null,
      ...(args.subhire
        ? {
            subhireCostBasis: args.subhire.basis,
            subhireUnitCost: args.subhire.unitCost,
            subhireCostOverride: args.subhire.costOverride,
          }
        : {}),
    },
  });

  if (existing) {
    await tx.periodMaterialShortage.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + args.quantity },
    });
  } else {
    await tx.periodMaterialShortage.create({
      data: {
        periodId: args.periodId,
        materialId: args.materialId,
        bundleBookingId,
        quantity: args.quantity,
        dayPriceSnapshot: args.dayPriceSnapshot,
        setupCostSnapshot: args.setupCostSnapshot ?? 0,
        discountPct,
        discountAmount,
        ...(args.subhire
          ? {
              supplierId: args.subhire.supplierId,
              subhireCostBasis: args.subhire.basis,
              subhireUnitCost: args.subhire.unitCost,
              subhireCostOverride: args.subhire.costOverride,
              subhiredAt: new Date(),
            }
          : {}),
      },
    });
  }
}
