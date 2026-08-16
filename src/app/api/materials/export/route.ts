import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { buildXlsxBuffer } from "@/lib/export/xlsx-writer";
import { materialsExportColumns, fetchMaterialsExportRows } from "@/lib/materials-export";

/**
 * P2.2 — GET /api/materials/export?includeArchived. Mirrors the
 * materials page's own default filter (M1.3): archived materials
 * excluded unless the caller explicitly asks for them, same as the
 * on-screen toggle. Money columns are entirely absent from the file for
 * a caller without `Kosten/Facturen: lezen` (design doc §9.3) — never
 * blanked, so the file is honest about what it contains.
 */
export async function GET(req: NextRequest) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own — same standalone-catalogue denial as GET /api/materials
  // itself (own-data-scoping-design.md §5): Material carries no
  // project/period FK, so there is no "my own materials" reading for an
  // export to filter down to.
  if (access.scope === "own") return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";
    const columns = materialsExportColumns(access);
    const rows = await fetchMaterialsExportRows(includeArchived);
    const buffer = await buildXlsxBuffer("Materialen", columns, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="materialen.xlsx"',
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
