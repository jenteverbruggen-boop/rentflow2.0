import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { resolveSubhireSupplier } from "@/lib/import/subhire-supplier";
import { assertNoOwnStock, updateExistingInhuur } from "@/lib/import/apply-inhuur-row";
import { resolveCategoryId } from "@/lib/import/category-resolve";
import type { ParsedMaterialRow, MaterialParseError } from "@/lib/import/material-adapter";
import { nextCode } from "@/lib/material-code";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

export interface ApplyMaterialImportResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: MaterialParseError[];
}

/**
 * M1.4 — one row's worth of writes. Never touches PeriodMaterial /
 * PeriodBundleBooking snapshots — those are historical billing records,
 * frozen at booking time (H5, L1.2), and an import only ever changes
 * the live Material row plus (for brand-new materials only) its stock
 * items. Re-importing an already-imported row lands on "unchanged" or
 * "updated", never duplicates a material or its stock.
 */
/** Exported for P3.1's `EntityAdapter<ParsedMaterialRow>` wrapper
 * (`adapters/material.ts`) — the same function `applyMaterialImport`
 * below still calls for its own (unchanged) M1 call path. */
export async function applyMaterialRow(
  tx: PrismaClient,
  row: ParsedMaterialRow,
  categoryCache: Map<string, number>,
  usedCodes: Set<string>,
): Promise<"created" | "updated" | "unchanged"> {
  const categoryId = await resolveCategoryId(tx, categoryCache, row.categoryName, row.categoryPrefix);

  let code = row.code;
  if (!code && categoryId != null) {
    const category = await tx.category.findUnique({ where: { id: categoryId } });
    if (category) {
      code = nextCode(category.prefix, [...usedCodes]);
    }
  }
  if (code) usedCodes.add(code);

  const existing = code ? await tx.material.findUnique({ where: { code } }) : null;

  // "Inhuur <leverancier>" folder → hired-in item from that supplier
  // (created on first sight). Rows without one leave these columns alone.
  const subhire = row.subhireSupplierName ? await resolveSubhireSupplier(tx, row.subhireSupplierName) : null;

  if (subhire && existing) await assertNoOwnStock(tx, existing.id, row.name);

  const data = {
    name: row.name,
    category: row.categoryName,
    categoryId,
    code,
    dayPrice: row.dayPrice,
    costPrice: row.costPrice,
    listPrice: row.listPrice,
    isBundle: row.isBundle,
    archived: row.archived,
    notes: row.notes,
    ...(subhire ?? {}),
    // Inhuur: the price from the file is the supplier's, billed per rental.
    ...(subhire
      ? { subhireUnitCost: row.subhireUnitCost ?? null, subhireCostBasis: "per_huur", priceBasis: "per_huur" }
      : {}),
  };

  if (existing) {
    // Postgres types the prices `Decimal`, SQLite `Float`: coerce both sides
    // through toNumber()/toNumberOrNull() (Y1.5 Decimal-drift guard).
    // Inhuur rows (E2) never overwrite prices set in RentFlow: see apply-inhuur-row.ts.
    const fillCost = subhire != null && existing.subhireUnitCost == null && row.subhireUnitCost != null;
    const priceChanged =
      !subhire && (toNumber(existing.dayPrice) !== data.dayPrice || toNumberOrNull(existing.costPrice) !== data.costPrice);
    const changed =
      existing.name !== data.name ||
      priceChanged ||
      fillCost ||
      toNumberOrNull(existing.listPrice) !== data.listPrice ||
      existing.isBundle !== data.isBundle ||
      existing.archived !== data.archived ||
      existing.notes !== data.notes ||
      (subhire != null && (!existing.subhireOnly || existing.defaultSupplierId !== subhire.defaultSupplierId));
    if (!changed) return "unchanged";
    if (subhire) {
      await updateExistingInhuur(tx, existing, data, subhire, row);
      return "updated";
    }
    await tx.material.update({ where: { id: existing.id }, data });
    return "updated";
  }

  const created = await tx.material.create({ data });
  if (!row.isBundle && row.stockItems.length > 0) {
    await tx.stockItem.createMany({
      data: row.stockItems.map((s, i) => ({
        materialId: created.id,
        unitNumber: i + 1,
        identifier: s.identifier,
        notes: s.notes,
      })),
    });
  }
  return "created";
}

/**
 * M1.4 — applies every successfully-parsed row in one transaction. A
 * bad individual row never aborts the whole file (Q37) — rows that
 * failed to parse already arrived pre-filtered into `parseErrors` by
 * the adapter, so everything reaching this function is applied; a
 * write-time failure on one row (e.g. a duplicate code race) is
 * reported alongside them rather than rolling back the rest.
 */
export async function applyMaterialImport(
  materials: ParsedMaterialRow[],
  parseErrors: MaterialParseError[],
  client: PrismaClient = defaultPrisma,
): Promise<ApplyMaterialImportResult> {
  const errors = [...parseErrors];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  await client.$transaction(async (tx) => {
    const categoryCache = new Map<string, number>();
    const usedCodes = new Set(
      (await tx.material.findMany({ where: { code: { not: null } }, select: { code: true } }))
        .map((m) => m.code as string),
    );

    for (const row of materials) {
      try {
        const outcome = await applyMaterialRow(tx as unknown as PrismaClient, row, categoryCache, usedCodes);
        if (outcome === "created") created++;
        else if (outcome === "updated") updated++;
        else unchanged++;
      } catch (e) {
        errors.push({ line: row.line, reason: (e as Error).message });
      }
    }
  });

  return { created, updated, unchanged, errors };
}
