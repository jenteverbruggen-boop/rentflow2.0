import { NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { buildXlsxBuffer } from "@/lib/export/xlsx-writer";
import { LOCATIONS_EXPORT_COLUMNS, fetchLocationsExportRows } from "@/lib/locations-export";

export async function GET() {
  const access = await requireModule("locaties", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const rows = await fetchLocationsExportRows();
    const buffer = await buildXlsxBuffer("Locaties", LOCATIONS_EXPORT_COLUMNS, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="locaties.xlsx"',
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
