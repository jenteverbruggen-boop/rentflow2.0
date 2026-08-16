import { NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { buildXlsxBuffer } from "@/lib/export/xlsx-writer";
import { bookingsExportColumns, fetchBookingsExportRows } from "@/lib/bookings-export";

/**
 * P2.3 — export only (design doc §1.6): these are snapshot-priced
 * children of a period, exactly the same reasoning as projects-export.ts.
 * `scope: own` gets the project-level `scopeFilter()`, same bucket (a)
 * as `GET /api/projects` and this route's own project export sibling.
 */
export async function GET() {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const columns = bookingsExportColumns(access);
    const rows = await fetchBookingsExportRows(access);
    const buffer = await buildXlsxBuffer("Boekingen", columns, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="boekingen.xlsx"',
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
