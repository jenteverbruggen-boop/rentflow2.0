import { prisma } from "@/lib/prisma";

interface RangeArgs {
  from: Date;
  to: Date;
  excludePeriodId?: number;
}

export async function findAvailableStockItems(
  materialId: number,
  args: RangeArgs
): Promise<{ available: { id: number; unitNumber: number; identifier: string | null }[]; bookedElsewhere: number[] }> {
  const stockItems = await prisma.stockItem.findMany({
    where: { materialId },
    orderBy: { unitNumber: "asc" },
  });
  const overlapping = await prisma.periodStockItem.findMany({
    where: {
      stockItem: { materialId },
      ...(args.excludePeriodId != null ? { NOT: { periodId: args.excludePeriodId } } : {}),
      period: {
        AND: [
          { startDate: { lte: args.to } },
          { endDate: { gte: args.from } },
        ],
      },
    },
    select: { stockItemId: true },
  });
  const bookedIds = new Set(overlapping.map((o) => o.stockItemId));
  const available = stockItems
    .filter((s) => !bookedIds.has(s.id))
    .map((s) => ({ id: s.id, unitNumber: s.unitNumber, identifier: s.identifier }));
  return { available, bookedElsewhere: Array.from(bookedIds) };
}

export async function checkPersonAvailability(
  personId: number,
  args: RangeArgs & { sameProjectId?: number }
): Promise<{ blockingProject?: { id: number; name: string }; sameProjectWarning?: { projectId: number; projectName: string } }> {
  const conflict = await prisma.periodPerson.findFirst({
    where: {
      personId,
      ...(args.excludePeriodId != null ? { NOT: { periodId: args.excludePeriodId } } : {}),
      period: {
        AND: [
          { startDate: { lte: args.to } },
          { endDate: { gte: args.from } },
        ],
      },
    },
    include: { period: { include: { project: true } } },
  });
  if (!conflict) return {};
  const project = conflict.period.project;
  if (args.sameProjectId != null && project.id === args.sameProjectId) {
    return { sameProjectWarning: { projectId: project.id, projectName: project.name } };
  }
  return { blockingProject: { id: project.id, name: project.name } };
}

export async function checkStockItemSameProject(
  stockItemIds: number[],
  args: { from: Date; to: Date; excludePeriodId?: number; sameProjectId: number }
): Promise<{ warnings: string[] }> {
  if (stockItemIds.length === 0) return { warnings: [] };
  const conflicts = await prisma.periodStockItem.findMany({
    where: {
      stockItemId: { in: stockItemIds },
      ...(args.excludePeriodId != null ? { NOT: { periodId: args.excludePeriodId } } : {}),
      period: {
        projectId: args.sameProjectId,
        AND: [
          { startDate: { lte: args.to } },
          { endDate: { gte: args.from } },
        ],
      },
    },
    include: { stockItem: { include: { material: true } }, period: true },
  });
  return {
    warnings: conflicts.map(
      (c) => `${c.stockItem.material.name} #${c.stockItem.unitNumber} staat ook in periode "${c.period.name}"`
    ),
  };
}
