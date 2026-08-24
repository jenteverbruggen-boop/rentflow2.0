import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { lockMaterials, freeStockItemIds } from "@/lib/booking";
import { createOrIncrementShortage } from "@/lib/shortage-row";

// Split out of booking.ts (which was already at the 150-line limit) to
// keep the set/bundle booking flow — a materially different shape from
// the flat-material one — in its own file rather than inflating that one.

export interface ComponentSpec {
  childId: number;
  quantity: number;
  childName?: string;
  /** DDL-3 — the component's own day-price at the moment of booking,
   * snapshotted onto PeriodBundleBookingComponent so K4's payback
   * pro-rata split has a historical weight to divide by instead of
   * the live (and later possibly changed) Material.dayPrice. */
  dayPrice: number;
}

interface BookBundleArgs {
  periodId: number;
  materialId: number;
  quantity: number;
  from: Date;
  to: Date;
  dayPriceSnapshot: number;
  components: ComponentSpec[];
  /** Overboeken — see booking.ts's BookFlatArgs.allowOverbook; here it
   * applies per-component: a short component still gets the full
   * booking at the requested quantity, with a PeriodMaterialShortage
   * row recording the missing units instead of throwing UNAVAIL. */
  allowOverbook?: boolean;
  client?: PrismaClient;
}

interface BookBundleResult {
  bundleBooking: unknown;
  warnings: string[];
}

export async function bookBundleMaterial(args: BookBundleArgs): Promise<BookBundleResult> {
  const client = args.client ?? defaultPrisma;
  const allChildIds = args.components.map((c) => c.childId);

  const booking = await client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await lockMaterials(txClient, allChildIds);

    const shortfalls = new Map<number, number>();
    for (const comp of args.components) {
      const free = await freeStockItemIds(txClient, comp.childId, args.from, args.to);
      const needed = comp.quantity * args.quantity;
      const short = needed - free.length;
      if (short > 0) {
        if (!args.allowOverbook) {
          const err = new Error(
            `Onvoldoende voorraad voor component: ${comp.childId}`,
          ) as Error & { code: string; childId: number };
          err.code = "UNAVAIL";
          err.childId = comp.childId;
          throw err;
        }
        shortfalls.set(comp.childId, short);
      }
    }

    const bBooking = await txClient.periodBundleBooking.create({
      data: {
        periodId: args.periodId,
        materialId: args.materialId,
        quantity: args.quantity,
        dayPriceSnapshot: args.dayPriceSnapshot,
      },
    });

    // DDL-3 — one weight row per component per booking call (not per
    // unit), so K4's payback can later reconstruct each component's
    // pro-rata share of this specific bundle booking's revenue.
    await txClient.periodBundleBookingComponent.createMany({
      data: args.components.map((comp) => ({
        bundleBookingId: bBooking.id,
        materialId: comp.childId,
        quantity: comp.quantity,
        dayPriceAtBooking: comp.dayPrice,
      })),
    });

    const warnings: string[] = [];
    for (const comp of args.components) {
      const free = await freeStockItemIds(txClient, comp.childId, args.from, args.to);
      const needed = comp.quantity * args.quantity;
      const chosen = free.slice(0, Math.min(needed, free.length));
      await txClient.periodStockItem.createMany({
        data: chosen.map((stockItemId) => ({
          periodId: args.periodId,
          stockItemId,
          dayPriceSnapshot: 0,
          bundleBookingId: bBooking.id,
        })),
      });

      const short = shortfalls.get(comp.childId);
      if (short) {
        await createOrIncrementShortage(txClient, {
          periodId: args.periodId,
          materialId: comp.childId,
          quantity: short,
          bundleBookingId: bBooking.id,
          dayPriceSnapshot: 0,
        });
        warnings.push(
          `${short}× ${comp.childName ?? `materiaal #${comp.childId}`} overboekt — niet in voorraad`,
        );
      }
    }

    return { bBooking, warnings };
  });

  return { bundleBooking: booking.bBooking, warnings: booking.warnings };
}
