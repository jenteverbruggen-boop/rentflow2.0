import { NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { buildXlsxBuffer } from "@/lib/export/xlsx-writer";
import { PROJECTS_EXPORT_COLUMNS, fetchProjectsExportRows } from "@/lib/projects-export";

/**
 * P2.3 — export only (design doc §1.6, no import counterpart exists or
 * ever will for this route). `scope: own` gets `scopeFilter()`'s own
 * project-level filter, same as `GET /api/projects` itself — bucket
 * (a), not a blanket deny.
 */
export async function GET() {
  const access = await requireModule("projecten", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const rows = await fetchProjectsExportRows(access);
    const buffer = await buildXlsxBuffer("Projecten", PROJECTS_EXPORT_COLUMNS, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="projecten.xlsx"',
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
