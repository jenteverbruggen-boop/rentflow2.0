import { prisma as defaultPrisma } from "@/lib/prisma";

/**
 * Extracted out of availability.ts (H2.1 — no headroom left there under
 * the 150-line limit) — unrelated to person/material availability
 * windows, this is a same-project informational warning for stock item
 * bookings, mirroring checkPersonAvailability's sameProjectWarning.
 */
export async function checkStockItemSameProject(
  stockItemIds: number[],
  args: {
    from: Date;
    to: Date;
    excludePeriodId?: number;
    sameProjectId: number;
  },
): Promise<{ warnings: string[] }> {
  if (stockItemIds.length === 0) return { warnings: [] };
  const conflicts = await defaultPrisma.periodStockItem.findMany({
    where: {
      stockItemId: { in: stockItemIds },
      ...(args.excludePeriodId != null
        ? { NOT: { periodId: args.excludePeriodId } }
        : {}),
      period: {
        projectId: args.sameProjectId,
        AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }],
      },
    },
    include: { stockItem: { include: { material: true } }, period: true },
  });
  return {
    warnings: conflicts.map(
      (c) =>
        `${c.stockItem.material.name} #${c.stockItem.unitNumber} staat ook in periode "${c.period.name}"`,
    ),
  };
}
