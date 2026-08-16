import { NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { buildXlsxBuffer } from "@/lib/export/xlsx-writer";
import { peopleExportColumns, fetchPeopleExportRows } from "@/lib/people-export";

export async function GET() {
  const access = await requireModule("personen", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own — same standalone-catalogue denial as GET /api/people
  // (own-data-scoping-design.md §5): a person has no ownership concept
  // of "their own" fellow people.
  if (access.scope === "own") return forbidden();

  try {
    const columns = peopleExportColumns(access);
    const rows = await fetchPeopleExportRows();
    const buffer = await buildXlsxBuffer("Personen", columns, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="personen.xlsx"',
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
