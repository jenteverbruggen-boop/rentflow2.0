import { prisma as defaultPrisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { effectiveWindow } from "@/lib/assignment-window";

interface RangeArgs {
  from: Date;
  to: Date;
  excludePeriodId?: number;
}

export async function findAvailableStockItems(
  materialId: number,
  args: RangeArgs,
): Promise<{
  available: { id: number; unitNumber: number; identifier: string | null }[];
  bookedElsewhere: number[];
}> {
  const stockItems = await defaultPrisma.stockItem.findMany({
    where: { materialId },
    orderBy: { unitNumber: "asc" },
  });
  const overlapping = await defaultPrisma.periodStockItem.findMany({
    where: {
      stockItem: { materialId },
      ...(args.excludePeriodId != null
        ? { NOT: { periodId: args.excludePeriodId } }
        : {}),
      period: {
        AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }],
      },
    },
    select: { stockItemId: true },
  });
  const bookedIds = new Set(overlapping.map((o) => o.stockItemId));
  const available = stockItems
    .filter((s) => !bookedIds.has(s.id))
    .map((s) => ({
      id: s.id,
      unitNumber: s.unitNumber,
      identifier: s.identifier,
    }));
  return { available, bookedElsewhere: Array.from(bookedIds) };
}

export async function bundleAvailableCount(
  bundleMaterialId: number,
  args: RangeArgs,
  client: PrismaClient = defaultPrisma,
): Promise<number> {
  const components = await client.materialComponent.findMany({
    where: { parentId: bundleMaterialId },
    include: { child: { include: { stockItems: { select: { id: true } } } } },
  });
  if (components.length === 0) return 0;

  let min = Infinity;
  for (const comp of components) {
    const allIds = comp.child.stockItems.map((s) => s.id);
    const booked = await client.periodStockItem.findMany({
      where: {
        stockItemId: { in: allIds },
        ...(args.excludePeriodId != null
          ? { NOT: { periodId: args.excludePeriodId } }
          : {}),
        period: {
          AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }],
        },
      },
      select: { stockItemId: true },
    });
    const bookedSet = new Set(booked.map((b) => b.stockItemId));
    const availCount = allIds.filter((id) => !bookedSet.has(id)).length;
    const setsFromThis = Math.floor(availCount / comp.quantity);
    if (setsFromThis < min) min = setsFromThis;
  }
  return min === Infinity ? 0 : min;
}

export async function checkPersonAvailability(
  personId: number,
  args: RangeArgs & { sameProjectId?: number },
  client: PrismaClient = defaultPrisma,
): Promise<{
  blockingProject?: { id: number; name: string; from: Date; to: Date };
  sameProjectWarning?: { projectId: number; projectName: string };
}> {
  // `client` accepts a `tx` handle (H1.2/bundleAvailableCount pattern).
  // Coarse period-level pre-filter, then the precise effectiveWindow()
  // comparison in JS — a window is always inside its own period.
  const candidates = await client.periodPerson.findMany({
    where: {
      personId,
      ...(args.excludePeriodId != null
        ? { NOT: { periodId: args.excludePeriodId } }
        : {}),
      period: {
        AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }],
      },
    },
    include: { period: { include: { project: true } } },
  });
  const conflict = candidates.find((c) => {
    const w = effectiveWindow(c);
    return w.from < args.to && w.to > args.from;
  });
  if (!conflict) return {};
  const project = conflict.period.project;
  if (args.sameProjectId != null && project.id === args.sameProjectId) {
    return {
      sameProjectWarning: { projectId: project.id, projectName: project.name },
    };
  }
  // H2.1 — names the window too, not just the project, so the confirm
  // dialog can say when the conflict is.
  const conflictWindow = effectiveWindow(conflict);
  return {
    blockingProject: {
      id: project.id,
      name: project.name,
      from: conflictWindow.from,
      to: conflictWindow.to,
    },
  };
}
