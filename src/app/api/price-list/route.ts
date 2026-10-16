import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { loadPriceList } from "@/lib/price-list-load";
import { parsePriceListQuery, priceListDenial } from "@/lib/price-list-query";

/** GET /api/price-list?categories=&sets=&crew=&hideZero=&client=&vat= — the
 * customer-facing price list (C6): rental day prices per category, sets at
 * their set price, optionally crew rates (with a client's rate card). Money
 * data, so gated like every other price (`priceListDenial`). */
export async function GET(req: NextRequest) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const opts = parsePriceListQuery(new URL(req.url).searchParams);
    if (priceListDenial(access, opts)) return forbidden();
    return NextResponse.json(await loadPriceList(opts));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
