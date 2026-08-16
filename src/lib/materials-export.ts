import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { moneyVisible } from "@/lib/redact";
import type { ResolvedAccess } from "@/lib/api-auth";
import type { ExportColumn } from "@/lib/export/xlsx-writer";

/**
 * P2.2 — column contract from `.plans/data-import-export-design.md` §1.2,
 * matched so a materials export re-imports cleanly through M1's pipeline.
 * Money columns (`dayPrice`/`setupCost`/`costPrice`/`listPrice`/
 * `revenueBefore`/`bundlePriceOverride`) are entirely absent from the
 * schema — not blanked — for a caller without `Kosten/Facturen: lezen`,
 * so the file is honest about what it contains.
 */
export function materialsExportColumns(access: ResolvedAccess): ExportColumn[] {
  const base: ExportColumn[] = [
    { key: "id", header: "id", type: "number" },
    { key: "code", header: "code", type: "string" },
    { key: "name", header: "name", type: "string" },
    { key: "category", header: "category", type: "string" },
    { key: "isBundle", header: "isBundle", type: "boolean" },
    { key: "archived", header: "archived", type: "boolean" },
    { key: "notes", header: "notes", type: "string" },
    { key: "stockCount", header: "stockCount", type: "number" },
  ];
  if (!moneyVisible(access)) return base;
  return [
    ...base,
    { key: "dayPrice", header: "dayPrice", type: "number" },
    { key: "setupCost", header: "setupCost", type: "number" },
    { key: "costPrice", header: "costPrice", type: "number" },
    { key: "listPrice", header: "listPrice", type: "number" },
    { key: "revenueBefore", header: "revenueBefore", type: "number" },
    { key: "bundlePriceOverride", header: "bundlePriceOverride", type: "number" },
  ];
}

/** Mirrors `/api/materials`' own default filter (M1.3) — archived
 * materials excluded unless the caller passes `includeArchived`, the
 * same on-screen toggle the materials page itself exposes. */
export async function fetchMaterialsExportRows(
  includeArchived: boolean,
  client: PrismaClient = defaultPrisma,
): Promise<Record<string, unknown>[]> {
  const materials = await client.material.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: { name: "asc" },
    include: { categoryRel: true, _count: { select: { stockItems: true } } },
  });

  return materials.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    category: m.categoryRel?.name ?? null,
    isBundle: m.isBundle,
    archived: m.archived,
    notes: m.notes,
    stockCount: m._count.stockItems,
    dayPrice: toNumber(m.dayPrice),
    setupCost: toNumberOrNull(m.setupCost),
    costPrice: toNumberOrNull(m.costPrice),
    listPrice: toNumberOrNull(m.listPrice),
    revenueBefore: toNumberOrNull(m.revenueBefore),
    bundlePriceOverride: toNumberOrNull(m.bundlePriceOverride),
  }));
}
