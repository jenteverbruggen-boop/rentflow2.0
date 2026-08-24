import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { lockMaterials, freeStockItemIds } from "@/lib/booking";

export interface ProjectShortage {
  id: number;
  periodId: number;
  periodName: string;
  materialId: number;
  materialName: string;
  quantity: number;
}

export interface OverbookError extends Error {
  code: "OVERBOOK";
  shortages: ProjectShortage[];
}

/** Every open PeriodMaterialShortage row across a project's periods,
 * flattened for display (project-materials-tab.tsx's Alert, status-change
 * error dialogs). */
export async function listProjectShortages(
  projectId: number,
  client: PrismaClient = defaultPrisma,
): Promise<ProjectShortage[]> {
  const rows = await client.periodMaterialShortage.findMany({
    where: { period: { projectId } },
    include: { period: true, material: true },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    periodId: r.periodId,
    periodName: r.period.name,
    materialId: r.materialId,
    materialName: r.material.name,
    quantity: r.quantity,
  }));
}

/**
 * Tries to resolve every shortage row of a project against stock that has
 * since freed up or grown — one row at a time, each inside its own
 * `lockMaterials` transaction (mirrors booking.ts's own lock scope). A row
 * that fills completely is deleted; a partial fill decrements `quantity`
 * and stays open. Copies the shortage row's own price/discount/
 * bundleBookingId onto the new PeriodStockItem rows — for a component
 * shortage that is already `dayPriceSnapshot: 0` (bookBundleMaterial's
 * convention), so no special-casing is needed here.
 */
export async function fillShortages(
  projectId: number,
  client: PrismaClient = defaultPrisma,
): Promise<{ filled: number; remaining: ProjectShortage[] }> {
  const rows = await client.periodMaterialShortage.findMany({
    where: { period: { projectId } },
    include: { period: true },
  });

  let filled = 0;
  for (const row of rows) {
    filled += await client.$transaction(async (tx) => {
      const txClient = tx as unknown as PrismaClient;
      await lockMaterials(txClient, [row.materialId]);
      const free = await freeStockItemIds(
        txClient,
        row.materialId,
        row.period.startDate,
        row.period.endDate,
      );
      const fillCount = Math.min(row.quantity, free.length);
      if (fillCount === 0) return 0;

      const chosen = free.slice(0, fillCount);
      await txClient.periodStockItem.createMany({
        data: chosen.map((stockItemId) => ({
          periodId: row.periodId,
          stockItemId,
          dayPriceSnapshot: row.dayPriceSnapshot,
          setupCostSnapshot: row.setupCostSnapshot,
          discountPct: row.discountPct,
          discountAmount: row.discountAmount,
          bundleBookingId: row.bundleBookingId,
        })),
      });

      const remainingQty = row.quantity - fillCount;
      if (remainingQty <= 0) {
        await txClient.periodMaterialShortage.delete({ where: { id: row.id } });
      } else {
        await txClient.periodMaterialShortage.update({
          where: { id: row.id },
          data: { quantity: remainingQty },
        });
      }
      return fillCount;
    });
  }

  const remaining = await listProjectShortages(projectId, client);
  return { filled, remaining };
}

/** Gate for leaving concept/geannuleerd (PUT /api/projects/[id]) and for
 * invoicing (create-draft-invoice.ts) — both must refuse while any
 * overbooked material is still open. */
export async function assertNoShortages(
  projectId: number,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  const shortages = await listProjectShortages(projectId, client);
  if (shortages.length > 0) {
    const err = new Error(
      "Project heeft nog overboekt materiaal dat niet in voorraad is",
    ) as OverbookError;
    err.code = "OVERBOOK";
    err.shortages = shortages;
    throw err;
  }
}
