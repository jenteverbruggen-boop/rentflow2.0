import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { moneyVisible } from "@/lib/redact";
import type { ResolvedAccess } from "@/lib/api-auth";
import { scopeFilter } from "@/lib/scope-filter";
import type { ExportColumn } from "@/lib/export/xlsx-writer";

/**
 * P2.3 — export only, never an import target (design doc §1.6, same
 * reasoning as projects-export.ts): these are snapshot-priced children
 * of a period, and importing them out of context needs the parent
 * project+period to already exist and match — project-import in
 * disguise. One flattened row per booking, `kind` distinguishing
 * person/material/bundle bookings sharing the same sheet.
 */
export function bookingsExportColumns(access: ResolvedAccess): ExportColumn[] {
  const base: ExportColumn[] = [
    { key: "projectId", header: "projectId", type: "number" },
    { key: "projectName", header: "projectName", type: "string" },
    { key: "periodId", header: "periodId", type: "number" },
    { key: "periodName", header: "periodName", type: "string" },
    { key: "kind", header: "kind", type: "string" },
    { key: "entityName", header: "entityName", type: "string" },
    { key: "quantity", header: "quantity", type: "number" },
  ];
  if (!moneyVisible(access)) return base;
  return [
    ...base,
    { key: "unitPrice", header: "unitPrice", type: "number" },
    { key: "discountPct", header: "discountPct", type: "number" },
    { key: "discountAmount", header: "discountAmount", type: "number" },
  ];
}

export async function fetchBookingsExportRows(
  access: ResolvedAccess,
  client: PrismaClient = defaultPrisma,
): Promise<Record<string, unknown>[]> {
  const periods = await client.period.findMany({
    where: { project: scopeFilter(access) },
    select: {
      id: true,
      name: true,
      project: { select: { id: true, name: true } },
      people: { include: { person: { select: { name: true } } } },
      materials: { include: { stockItem: { include: { material: { select: { name: true } } } } } },
      bundleBookings: { include: { material: { select: { name: true } } } },
    },
    orderBy: { startDate: "desc" },
  });

  const rows: Record<string, unknown>[] = [];
  for (const period of periods) {
    const ctx = { projectId: period.project.id, projectName: period.project.name, periodId: period.id, periodName: period.name };
    for (const pp of period.people) {
      rows.push({
        ...ctx,
        kind: "person",
        entityName: pp.person.name,
        quantity: 1,
        unitPrice: toNumber(pp.dayPriceSnapshot),
        discountPct: toNumberOrNull(pp.discountPct),
        discountAmount: toNumberOrNull(pp.discountAmount),
      });
    }
    // K4's own established filter (grouping.ts) — a bundled component
    // line is snapshotted at €0 and already represented by its own
    // "bundle" row below; counting it again here would double-count.
    for (const m of period.materials.filter((m) => !m.bundleBookingId)) {
      rows.push({
        ...ctx,
        kind: "material",
        entityName: m.stockItem.material.name,
        quantity: 1,
        unitPrice: toNumber(m.dayPriceSnapshot),
        discountPct: toNumberOrNull(m.discountPct),
        discountAmount: toNumberOrNull(m.discountAmount),
      });
    }
    for (const b of period.bundleBookings) {
      rows.push({
        ...ctx,
        kind: "bundle",
        entityName: b.material.name,
        quantity: b.quantity,
        unitPrice: toNumber(b.dayPriceSnapshot),
        discountPct: null,
        discountAmount: null,
      });
    }
  }
  return rows;
}
