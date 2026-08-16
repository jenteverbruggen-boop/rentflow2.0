import type { EntityAdapter, BlockingReference } from "@/lib/import/pipeline-types";
import { parseMaterialRows, type ParsedMaterialRow } from "@/lib/import/material-adapter";
import { diffMaterialRow, type ExistingMaterial } from "@/lib/import/material-preview";
import { applyMaterialRow } from "@/lib/import/apply-material-import";
import { toNumberOrNull } from "@/lib/serialize";

/**
 * P3.1 — thin `EntityAdapter<ParsedMaterialRow>` wrapper composing M1's
 * own (unchanged) parse/diff/apply functions, per the design doc's
 * sequencing note (§4.2): M1 shipped before this doc existed, so P3
 * adopts its shape rather than rewriting it. `applyMaterialImport`
 * (M1.4's own update-only entry point) is untouched and still used by
 * its own call site; this adapter is a second, parallel caller of the
 * same underlying functions, not a fork of their logic.
 */
export const materialAdapter: EntityAdapter<ParsedMaterialRow> = {
  entity: "materials",
  acceptedFormats: ["rentflow", "rentman-equipment"],
  requiredHeaders: ["name", "code", "dayPrice"],
  matchKeyLabel: "code",

  parseRows(rows, format) {
    if (format === "unknown") return { parsed: [], errors: [] };
    const { materials, errors } = parseMaterialRows(rows, format);
    return { parsed: materials, errors };
  },

  matchKey(row) {
    return row.code;
  },

  summarize(row) {
    return `${row.name}${row.code ? ` (${row.code})` : ""}`;
  },

  diffAgainstExisting(row, existing) {
    if (!existing) return { classification: "new" };
    const changes = diffMaterialRow(row, existing as unknown as ExistingMaterial);
    return { classification: changes.length > 0 ? "updated" : "unchanged", changes: changes.length > 0 ? changes : undefined };
  },

  async applyRow(tx, row, ctx) {
    return applyMaterialRow(
      tx,
      row,
      ctx.categoryCache as Map<string, number>,
      ctx.usedCodes as Set<string>,
    );
  },

  async makeApplyContext(tx) {
    const usedCodes = new Set(
      (await tx.material.findMany({ where: { code: { not: null } }, select: { code: true } })).map(
        (m) => m.code as string,
      ),
    );
    return { categoryCache: new Map<string, number>(), usedCodes };
  },

  async fetchExisting(client, keys) {
    const materials = await client.material.findMany({ where: { code: { in: keys as string[] } } });
    const map = new Map<string | number, ParsedMaterialRow>();
    for (const m of materials) {
      const existing: ExistingMaterial = {
        code: m.code!,
        name: m.name,
        dayPrice: toNumberOrNull(m.dayPrice) ?? 0,
        costPrice: toNumberOrNull(m.costPrice) ?? null,
        listPrice: toNumberOrNull(m.listPrice) ?? null,
        isBundle: m.isBundle,
        archived: m.archived,
        notes: m.notes,
      };
      // The pipeline only ever calls diffAgainstExisting with this map's
      // values — ExistingMaterial's shape is exactly what that needs,
      // even though the adapter's own T is ParsedMaterialRow.
      map.set(m.code!, existing as unknown as ParsedMaterialRow);
    }
    return map;
  },

  async fetchAllForReplace(client) {
    const materials = await client.material.findMany({ select: { id: true, name: true, code: true } });
    return materials.map((m) => ({ id: m.id, label: `${m.name}${m.code ? ` (${m.code})` : ""}` }));
  },

  async referentialChecks(client, ids) {
    const map = new Map<number, BlockingReference[]>();
    if (ids.length === 0) return map;

    const stockBookings = await client.periodStockItem.groupBy({
      by: ["stockItemId"],
      where: { stockItem: { materialId: { in: ids } } },
      _count: true,
    });
    const stockItems = await client.stockItem.findMany({
      where: { id: { in: stockBookings.map((s) => s.stockItemId) } },
      select: { id: true, materialId: true },
    });
    const stockItemToMaterial = new Map(stockItems.map((s) => [s.id, s.materialId]));
    const bookingCountByMaterial = new Map<number, number>();
    for (const s of stockBookings) {
      const materialId = stockItemToMaterial.get(s.stockItemId);
      if (materialId == null) continue;
      bookingCountByMaterial.set(materialId, (bookingCountByMaterial.get(materialId) ?? 0) + (s._count as number));
    }

    const bundleBookings = await client.periodBundleBooking.groupBy({
      by: ["materialId"],
      where: { materialId: { in: ids } },
      _count: true,
    });
    const priceOverrides = await client.projectMaterialPrice.groupBy({
      by: ["materialId"],
      where: { materialId: { in: ids } },
      _count: true,
    });
    const components = await client.materialComponent.findMany({
      where: { OR: [{ parentId: { in: ids } }, { childId: { in: ids } }] },
      select: { parentId: true, childId: true },
    });
    const componentCountByMaterial = new Map<number, number>();
    for (const c of components) {
      componentCountByMaterial.set(c.parentId, (componentCountByMaterial.get(c.parentId) ?? 0) + 1);
      if (c.childId !== c.parentId) {
        componentCountByMaterial.set(c.childId, (componentCountByMaterial.get(c.childId) ?? 0) + 1);
      }
    }

    for (const id of ids) {
      const blocks: BlockingReference[] = [];
      const bookingCount = bookingCountByMaterial.get(id) ?? 0;
      if (bookingCount > 0) blocks.push({ relation: "PeriodStockItem (bookingen)", count: bookingCount });
      const bundleCount = bundleBookings.find((b) => b.materialId === id)?._count as number | undefined;
      if (bundleCount) blocks.push({ relation: "PeriodBundleBooking (setboekingen)", count: bundleCount });
      const priceCount = priceOverrides.find((p) => p.materialId === id)?._count as number | undefined;
      if (priceCount) blocks.push({ relation: "ProjectMaterialPrice (projectprijzen)", count: priceCount });
      const componentCount = componentCountByMaterial.get(id) ?? 0;
      if (componentCount > 0) blocks.push({ relation: "MaterialComponent (setsamenstelling)", count: componentCount });
      if (blocks.length > 0) map.set(id, blocks);
    }
    return map;
  },

  async truncate(tx) {
    await tx.material.deleteMany();
  },
};
