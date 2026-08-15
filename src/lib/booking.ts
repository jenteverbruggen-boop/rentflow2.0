import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export async function freeStockItemIds(
  client: PrismaClient,
  materialId: number,
  from: Date,
  to: Date,
  excludePeriodId?: number,
): Promise<number[]> {
  const all = await client.stockItem.findMany({
    where: { materialId },
    orderBy: { unitNumber: "asc" },
    select: { id: true },
  });
  const booked = await client.periodStockItem.findMany({
    where: {
      stockItem: { materialId },
      ...(excludePeriodId != null ? { NOT: { periodId: excludePeriodId } } : {}),
      period: {
        AND: [{ startDate: { lt: to } }, { endDate: { gt: from } }],
      },
    },
    select: { stockItemId: true },
  });
  const bookedIds = new Set(booked.map((b) => b.stockItemId));
  return all.filter((s) => !bookedIds.has(s.id)).map((s) => s.id);
}

export async function lockMaterials(
  tx: PrismaClient,
  materialIds: number[],
): Promise<void> {
  if ((process.env.DATABASE_URL ?? "").startsWith("file:")) return;
  const sorted = [...new Set(materialIds)].sort((a, b) => a - b);
  for (const id of sorted) {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(1234567, ${id})`);
  }
}

interface BookFlatArgs {
  periodId: number;
  materialId: number;
  quantity: number;
  from: Date;
  to: Date;
  dayPriceSnapshot: number;
  setupCostSnapshot: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  client?: PrismaClient;
}

interface BookFlatResult {
  assignments: unknown[];
  warnings: string[];
}

export async function bookFlatMaterial(args: BookFlatArgs): Promise<BookFlatResult> {
  const client = args.client ?? defaultPrisma;
  const result = await client.$transaction(async (tx) => {
    await lockMaterials(tx as unknown as PrismaClient, [args.materialId]);
    const free = await freeStockItemIds(tx as unknown as PrismaClient, args.materialId, args.from, args.to);
    if (free.length < args.quantity) {
      const err = new Error(
        `Niet genoeg vrij. Gevraagd: ${args.quantity}, beschikbaar: ${free.length}`,
      ) as Error & { code: string };
      err.code = "UNAVAIL";
      throw err;
    }
    const chosen = free.slice(0, args.quantity);
    const created = await Promise.all(
      chosen.map((stockItemId) =>
        (tx as unknown as PrismaClient).periodStockItem.create({
          data: {
            periodId: args.periodId,
            stockItemId,
            dayPriceSnapshot: args.dayPriceSnapshot,
            setupCostSnapshot: args.setupCostSnapshot,
            discountPct: args.discountPct ?? null,
            discountAmount: args.discountAmount ?? null,
          },
          include: {
            stockItem: { include: { material: { include: { categoryRel: true } } } },
          },
        }),
      ),
    );
    return created;
  });
  return { assignments: result, warnings: [] };
}

interface ComponentSpec {
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

    for (const comp of args.components) {
      const free = await freeStockItemIds(txClient, comp.childId, args.from, args.to);
      const needed = comp.quantity * args.quantity;
      if (free.length < needed) {
        const err = new Error(
          `Onvoldoende voorraad voor component: ${comp.childId}`,
        ) as Error & { code: string; childId: number };
        err.code = "UNAVAIL";
        err.childId = comp.childId;
        throw err;
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

    for (const comp of args.components) {
      const free = await freeStockItemIds(txClient, comp.childId, args.from, args.to);
      const chosen = free.slice(0, comp.quantity * args.quantity);
      await txClient.periodStockItem.createMany({
        data: chosen.map((stockItemId) => ({
          periodId: args.periodId,
          stockItemId,
          dayPriceSnapshot: 0,
          bundleBookingId: bBooking.id,
        })),
      });
    }

    return bBooking;
  });

  return { bundleBooking: booking, warnings: [] };
}
