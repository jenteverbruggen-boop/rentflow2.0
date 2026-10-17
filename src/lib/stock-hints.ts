import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { freeStockItemIds } from "@/lib/booking";
import type { StockHint, StockHolder } from "@/types";

const MAX_HOLDERS = 3;

/**
 * Per open shortage of a project: how many own units are free right now for
 * its period, and which other projects hold the rest. Per hired-in row: how
 * many own units are free (so it could be switched to own stock). Read-only,
 * one free-stock lookup per (material, period).
 */
export async function computeStockHints(projectId: number, client: PrismaClient = defaultPrisma): Promise<StockHint[]> {
  const rows = await client.periodMaterialShortage.findMany({
    where: { period: { projectId } },
    include: { period: { include: { project: { select: { status: true } } } } },
    orderBy: { id: "asc" },
  });
  const freeCache = new Map<string, number>();
  const holderCache = new Map<string, Promise<{ holders: StockHolder[]; more: number }>>();

  const freeFor = async (materialId: number, from: Date, to: Date) => {
    const key = `${materialId}|${from.getTime()}|${to.getTime()}`;
    if (!freeCache.has(key)) freeCache.set(key, (await freeStockItemIds(client, materialId, from, to)).length);
    return freeCache.get(key) as number;
  };
  const holdersFor = (materialId: number, from: Date, to: Date) => {
    const key = `${materialId}|${from.getTime()}|${to.getTime()}`;
    if (!holderCache.has(key)) holderCache.set(key, loadHolders(client, projectId, materialId, from, to));
    return holderCache.get(key) as Promise<{ holders: StockHolder[]; more: number }>;
  };

  const hints: StockHint[] = [];
  for (const r of rows) {
    const { startDate, endDate } = r.period;
    const free = await freeFor(r.materialId, startDate, endDate);
    if (r.supplierId != null) {
      // A cancelled project can't take own stock back, so offer none.
      const cancelled = r.period.project.status === "geannuleerd";
      hints.push({ shortageId: r.id, kind: "hired", ownFreeNow: cancelled ? 0 : free });
    } else {
      const { holders, more } = await holdersFor(r.materialId, startDate, endDate);
      hints.push({ shortageId: r.id, kind: "open", freeNow: free, holders, more });
    }
  }
  return hints;
}

async function loadHolders(client: PrismaClient, projectId: number, materialId: number, from: Date, to: Date) {
  const items = await client.periodStockItem.findMany({
    where: {
      stockItem: { materialId },
      period: { projectId: { not: projectId }, AND: [{ startDate: { lt: to } }, { endDate: { gt: from } }] },
    },
    select: { stockItemId: true, period: { select: { project: { select: { id: true, name: true, status: true } } } } },
  });
  // Distinct units per project: one unit booked in two periods counts once.
  const byProject = new Map<number, StockHolder>();
  const seen = new Set<string>();
  for (const i of items) {
    const p = i.period.project;
    const key = `${p.id}|${i.stockItemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const h = byProject.get(p.id);
    if (h) h.units += 1;
    else byProject.set(p.id, { projectId: p.id, name: p.name, status: p.status, units: 1 });
  }
  const all = [...byProject.values()].sort((a, b) => b.units - a.units || (a.name ?? "").localeCompare(b.name ?? ""));
  return { holders: all.slice(0, MAX_HOLDERS), more: Math.max(0, all.length - MAX_HOLDERS) };
}
