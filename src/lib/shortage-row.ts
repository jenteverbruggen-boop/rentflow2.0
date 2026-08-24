import type { PrismaClient } from "@/generated/prisma/client";

interface ShortageRowArgs {
  periodId: number;
  materialId: number;
  quantity: number;
  bundleBookingId?: number | null;
  dayPriceSnapshot: number;
  setupCostSnapshot?: number;
  discountPct?: number | null;
  discountAmount?: number | null;
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

  const existing = await tx.periodMaterialShortage.findFirst({
    where: {
      periodId: args.periodId,
      materialId: args.materialId,
      bundleBookingId,
      dayPriceSnapshot: args.dayPriceSnapshot,
      discountPct,
      discountAmount,
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
      },
    });
  }
}
