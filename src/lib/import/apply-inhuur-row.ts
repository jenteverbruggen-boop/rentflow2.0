import type { PrismaClient } from "@/generated/prisma/client";
import type { ParsedMaterialRow } from "@/lib/import/material-adapter";
import { toNumber } from "@/lib/serialize";

/** An inhuur row on a material that has (or, when new, brings) own units is a
 * normal material: only its default supplier and an empty purchase price follow
 * the file. Preview and apply share this decision. */
export function hasOwnUnits(row: ParsedMaterialRow, existingStockCount: number | null): boolean {
  return !!row.subhireSupplierName && (existingStockCount == null ? row.stockItems.length > 0 : existingStockCount > 0);
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

/**
 * Re-import of an existing material that has own units but now sits in an
 * "Inhuur <leverancier>" folder: it stays a normal material (not inhuur-only).
 * The supplier becomes the default supplier, the purchase price is only filled
 * when empty, dayPrice, costPrice and priceBasis are never touched.
 */
export async function updateExistingOwnedInhuur(
  tx: PrismaClient,
  existing: Pick<Existing, "id" | "subhireUnitCost">,
  data: Data,
  defaultSupplierId: number,
  row: ParsedMaterialRow,
): Promise<void> {
  const fillCost = existing.subhireUnitCost == null && row.subhireUnitCost != null;
  await tx.material.update({
    where: { id: existing.id },
    data: {
      name: data.name, category: data.category, categoryId: data.categoryId, code: data.code,
      listPrice: data.listPrice, isBundle: data.isBundle, archived: data.archived, notes: data.notes,
      defaultSupplierId,
      ...(fillCost ? { subhireUnitCost: row.subhireUnitCost, subhireCostBasis: "per_huur" } : {}),
    },
  });
}
