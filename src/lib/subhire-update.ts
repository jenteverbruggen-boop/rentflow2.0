import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { SubhireError, assertUsableSupplier, loadRow, type SubhireArgs } from "@/lib/subhire";
import type { SubhireCostBasis } from "@/types";

/**
 * Change a hired-in row's supplier or cost. A price only ever belongs to one
 * supplier, so changing the supplier resets it (unless explicit prices come
 * with the change): the material's default when the new supplier is its
 * default supplier, otherwise unknown. The fixed total is always cleared.
 * The supplier is only validated when it actually changes, so a hire with a
 * since-archived supplier can still get a price-only edit.
 */
export async function updateSubhire(
  periodId: number,
  shortageId: number,
  patch: Partial<Omit<SubhireArgs, "quantity">>,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const row = await loadRow(txClient, shortageId, periodId);
    if (row.supplierId == null) throw new SubhireError("NOT_SUBHIRED", "Dit is niet ingehuurd");
    const changed = patch.supplierId !== undefined && patch.supplierId !== row.supplierId;
    if (changed) await assertUsableSupplier(txClient, patch.supplierId as number);

    let basis = patch.basis;
    let unitCost = patch.unitCost;
    if (changed && patch.basis === undefined && patch.unitCost === undefined) {
      if (patch.supplierId === row.material.defaultSupplierId) {
        basis = row.material.subhireCostBasis as SubhireCostBasis;
        unitCost = row.material.subhireUnitCost as never;
      } else {
        unitCost = null;
      }
    }
    return txClient.periodMaterialShortage.update({
      where: { id: row.id },
      data: {
        supplierId: patch.supplierId,
        subhireCostBasis: basis,
        subhireUnitCost: unitCost,
        subhireCostOverride: changed ? (patch.costOverride ?? null) : patch.costOverride,
      },
    });
  });
}
