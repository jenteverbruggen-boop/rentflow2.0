import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { lockMaterials } from "@/lib/booking";
import { SubhireError } from "@/lib/subhire";

/**
 * Removes (part of) a hired-in row: decrement, or delete when nothing is left
 * (or `"all"`). Allowed in every project status — removing never creates an
 * open shortage. Runs under the material lock like every booking write.
 * Returns the supplier so the caller can say "vergeet af te bellen".
 */
export async function removeHiredUnits(
  periodId: number,
  shortageId: number,
  count: number | "all",
  client: PrismaClient = defaultPrisma,
): Promise<{ supplierName: string; removed: number }> {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const peek = await txClient.periodMaterialShortage.findUnique({ where: { id: shortageId } });
    if (!peek || peek.periodId !== periodId) throw new SubhireError("NOT_FOUND", "Inhuur niet gevonden");
    await lockMaterials(txClient, [peek.materialId]);
    const row = await txClient.periodMaterialShortage.findUnique({
      where: { id: shortageId },
      include: { supplier: true },
    });
    if (!row || row.periodId !== periodId) throw new SubhireError("NOT_FOUND", "Inhuur niet gevonden");
    if (row.supplierId == null) throw new SubhireError("NOT_SUBHIRED", "Dit is niet ingehuurd");
    const removed = count === "all" ? row.quantity : Math.min(count, row.quantity);
    if (removed < 1) throw new SubhireError("BAD_QUANTITY", "Aantal moet minstens 1 zijn");
    if (removed >= row.quantity) {
      await txClient.periodMaterialShortage.delete({ where: { id: row.id } });
    } else {
      await txClient.periodMaterialShortage.update({ where: { id: row.id }, data: { quantity: row.quantity - removed } });
    }
    return { supplierName: row.supplier?.name ?? "de leverancier", removed };
  });
}
