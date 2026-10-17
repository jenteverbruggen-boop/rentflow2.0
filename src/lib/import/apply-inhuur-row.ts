import type { PrismaClient } from "@/generated/prisma/client";
import type { ParsedMaterialRow } from "@/lib/import/material-adapter";
import { toNumber } from "@/lib/serialize";

export const inhuurStockMessage = (name: string) =>
  `"${name}" heeft eigen units — verwijder die eerst voor je het als inhuur-item importeert`;

/** An inhuur row never gets own stock (E4): refuse when the material has
 * units already, instead of leaving both. */
export async function assertNoOwnStock(tx: PrismaClient, materialId: number, name: string): Promise<void> {
  if ((await tx.stockItem.count({ where: { materialId } })) > 0) {
    throw new Error(inhuurStockMessage(name));
  }
}

type Existing = { id: number; dayPrice: unknown; subhireOnly: boolean; subhireUnitCost: unknown };
type Data = {
  name: string; category: string | null; categoryId: number | null; code: string | null;
  listPrice: number | null; isBundle: boolean; archived: boolean; notes: string | null;
};

/**
 * Re-import of an existing inhuur item: a selling price entered in RentFlow is
 * never overwritten, the purchase price is only filled when empty, and the
 * margin price (meaningless without stock) is ignored. Only the descriptive
 * fields follow the file.
 */
export async function updateExistingInhuur(
  tx: PrismaClient,
  existing: Existing,
  data: Data,
  subhire: { subhireOnly: true; defaultSupplierId: number },
  row: ParsedMaterialRow,
): Promise<void> {
  const fillCost = existing.subhireUnitCost == null && row.subhireUnitCost != null;
  const unpriced = toNumber(existing.dayPrice) === 0;
  await tx.material.update({
    where: { id: existing.id },
    data: {
      name: data.name, category: data.category, categoryId: data.categoryId, code: data.code,
      listPrice: data.listPrice, isBundle: data.isBundle, archived: data.archived, notes: data.notes, ...subhire,
      ...(fillCost ? { subhireUnitCost: row.subhireUnitCost, subhireCostBasis: "per_huur" } : {}),
      // Without a selling price yet, bill per rental like every new inhuur item.
      ...(unpriced && !existing.subhireOnly ? { priceBasis: "per_huur" } : {}),
    },
  });
}
