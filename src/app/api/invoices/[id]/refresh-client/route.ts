import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, notFound, conflict, badRequest, serverError } from "@/lib/api-auth";
import { refreshInvoiceClient, RefreshClientError } from "@/lib/refresh-invoice-client";
import { DraftNotMutableError } from "@/lib/invoices";
import { serializeInvoice } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

/** POST /api/invoices/:id/refresh-client — re-copy the project's current
 * client details onto a concept invoice. */
export async function POST(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    return NextResponse.json(serializeInvoice(await refreshInvoiceClient(parseInt(id))));
  } catch (err) {
    if (err instanceof DraftNotMutableError) return conflict(err.message);
    if (err instanceof RefreshClientError) return err.code === "NOT_FOUND" ? notFound() : badRequest(err.message);
    return serverError((err as Error).message);
  }
}
