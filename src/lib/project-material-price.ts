import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { lockMaterials } from "@/lib/booking";

/**
 * Reprices a material in every period of a project: the booked stock units and
 * the shortage rows (open and hired in). Set components (bundleBookingId set)
 * stay at their EUR 0 snapshot.
 */
async function repriceTx(tx: PrismaClient, projectId: number, materialId: number, price: number) {
  await tx.periodStockItem.updateMany({
    where: { period: { projectId }, bundleBookingId: null, stockItem: { materialId } },
    data: { dayPriceSnapshot: price },
  });
  await tx.periodMaterialShortage.updateMany({
    where: { period: { projectId }, bundleBookingId: null, materialId },
    data: { dayPriceSnapshot: price },
  });
}

export async function setProjectMaterialPrice(
  projectId: number, materialId: number, price: number, client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (raw) => {
    const tx = raw as unknown as PrismaClient;
    await lockMaterials(tx, [materialId]);
    const override = await tx.projectMaterialPrice.upsert({
      where: { projectId_materialId: { projectId, materialId } },
      create: { projectId, materialId, dayPrice: price },
      update: { dayPrice: price },
      include: { material: true },
    });
    await repriceTx(tx, projectId, materialId, price);
    return override;
  });
}

/** Removes the override and falls back to the catalogue price. */
export async function clearProjectMaterialPrice(
  projectId: number, materialId: number, client: PrismaClient = defaultPrisma,
) {
  await client.$transaction(async (raw) => {
    const tx = raw as unknown as PrismaClient;
    await lockMaterials(tx, [materialId]);
    await tx.projectMaterialPrice.deleteMany({ where: { projectId, materialId } });
    const material = await tx.material.findUnique({ where: { id: materialId } });
    if (material) await repriceTx(tx, projectId, materialId, Number(material.dayPrice));
  });
}
