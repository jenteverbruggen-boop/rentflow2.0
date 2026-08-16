import { NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { buildXlsxBuffer } from "@/lib/export/xlsx-writer";
import { CLIENTS_EXPORT_COLUMNS, fetchClientsExportRows } from "@/lib/clients-export";

export async function GET() {
  const access = await requireModule("klanten", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const rows = await fetchClientsExportRows();
    const buffer = await buildXlsxBuffer("Klanten", CLIENTS_EXPORT_COLUMNS, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="klanten.xlsx"',
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
