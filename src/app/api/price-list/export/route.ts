import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { buildXlsxBuffer } from "@/lib/export/xlsx-writer";
import { loadPriceList } from "@/lib/price-list-load";
import { priceListColumns, priceListRows } from "@/lib/price-list-export";
import { parsePriceListQuery, priceListDenial } from "@/lib/price-list-query";

/** GET /api/price-list/export — the same price list as a spreadsheet. */
export async function GET(req: NextRequest) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const opts = parsePriceListQuery(new URL(req.url).searchParams);
    if (priceListDenial(access, opts)) return forbidden();
    const list = await loadPriceList(opts);
    const buffer = await buildXlsxBuffer("Prijslijst", priceListColumns(list.vat), priceListRows(list));
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="prijslijst.xlsx"',
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
