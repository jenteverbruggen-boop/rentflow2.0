import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { scopeFilter, type ScopeAccess } from "@/lib/scope-filter";
import type { ExportColumn } from "@/lib/export/xlsx-writer";

/**
 * P2.3 — export only, never an import target (design doc §1.6): a
 * project's real content is a graph (periods, bookings, price
 * snapshots), so flattening it into one spreadsheet row and re-inflating
 * it on import risks silently wrong bookings. This is a report/backup
 * format, not a paired round-trip contract like materials/people/
 * clients/locations. No money column here — a project carries no price
 * of its own; costs live on its bookings (see bookings-export.ts).
 */
export const PROJECTS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "id", header: "id", type: "number" },
  { key: "name", header: "name", type: "string" },
  { key: "client", header: "client", type: "string" },
  { key: "location", header: "location", type: "string" },
  { key: "startDate", header: "startDate", type: "date" },
  { key: "endDate", header: "endDate", type: "date" },
  { key: "status", header: "status", type: "string" },
  { key: "notes", header: "notes", type: "string" },
];

/** Bucket (a) reasoning (own-data-scoping-design.md): same
 * `scopeFilter()` a `scope: own` caller gets on `GET /api/projects`
 * itself — every period of an owned project, not a blanket deny. */
export async function fetchProjectsExportRows(
  access: ScopeAccess,
  client: PrismaClient = defaultPrisma,
): Promise<Record<string, unknown>[]> {
  const projects = await client.project.findMany({
    where: scopeFilter(access),
    orderBy: { startDate: "desc" },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client,
    location: p.location,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    notes: p.notes,
  }));
}
