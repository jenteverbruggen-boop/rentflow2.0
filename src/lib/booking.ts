import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { createOrIncrementShortage } from "@/lib/shortage-row";

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
  /** Only used to name the material in the overboeken warning text. */
  materialName?: string;
  quantity: number;
  from: Date;
  to: Date;
  dayPriceSnapshot: number;
  setupCostSnapshot: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  /** Overboeken — when the requested quantity exceeds what's free, book
   * every free unit and record the rest as a PeriodMaterialShortage
   * instead of throwing UNAVAIL. Only the caller (the route, after
   * checking the project's status) may set this. */
  allowOverbook?: boolean;
  client?: PrismaClient;
}

interface BookFlatResult {
  assignments: unknown[];
  warnings: string[];
}

export async function bookFlatMaterial(args: BookFlatArgs): Promise<BookFlatResult> {
  const client = args.client ?? defaultPrisma;
  const result = await client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await lockMaterials(txClient, [args.materialId]);
    const free = await freeStockItemIds(txClient, args.materialId, args.from, args.to);
    const shortfall = args.quantity - free.length;
    if (shortfall > 0 && !args.allowOverbook) {
      const err = new Error(
        `Niet genoeg vrij. Gevraagd: ${args.quantity}, beschikbaar: ${free.length}`,
      ) as Error & { code: string };
      err.code = "UNAVAIL";
      throw err;
    }
    const chosen = free.slice(0, Math.min(args.quantity, free.length));
    const created = await Promise.all(
      chosen.map((stockItemId) =>
        txClient.periodStockItem.create({
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

    const warnings: string[] = [];
    if (shortfall > 0) {
      await createOrIncrementShortage(txClient, {
        periodId: args.periodId,
        materialId: args.materialId,
        quantity: shortfall,
        dayPriceSnapshot: args.dayPriceSnapshot,
        setupCostSnapshot: args.setupCostSnapshot,
        discountPct: args.discountPct,
        discountAmount: args.discountAmount,
      });
      warnings.push(
        `${shortfall}× ${args.materialName ?? `materiaal #${args.materialId}`} overboekt — niet in voorraad`,
      );
    }

    return { assignments: created, warnings };
  });
  return result;
}
