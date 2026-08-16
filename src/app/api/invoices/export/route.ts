import { NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { buildXlsxBuffer } from "@/lib/export/xlsx-writer";
import { INVOICES_EXPORT_COLUMNS, fetchInvoicesExportRows } from "@/lib/invoices-export";

/**
 * P2.3 — export only, no import in any mode (design doc §1.6). Denied
 * entirely (`403`) for `scope: own`, identical to every other
 * `Kosten/Facturen` route (J2b/K1) — virtually every column here is
 * money-shaped, so a per-column redaction (like materials/people/
 * bookings) would still leak client names, amounts and payment status;
 * the whole route is gated, not individual columns.
 */
export async function GET() {
  const access = await requireModule("kosten_facturen", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const rows = await fetchInvoicesExportRows();
    const buffer = await buildXlsxBuffer("Facturen", INVOICES_EXPORT_COLUMNS, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="facturen.xlsx"',
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
