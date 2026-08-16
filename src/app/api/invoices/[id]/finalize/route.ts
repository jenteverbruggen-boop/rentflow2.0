import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, notFound, conflict, serverError } from "@/lib/api-auth";
import { finalizeInvoice, FinalizeInvoiceError } from "@/lib/finalize-invoice";
import { serializeInvoice } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

/** J2b.3 — POST /api/invoices/:id/finalize (design doc §7): `{}` body,
 * 409 if already non-concept. Never callable at draft-creation time. */
export async function POST(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const invoice = await finalizeInvoice(parseInt(id));
    return NextResponse.json(serializeInvoice(invoice));
  } catch (err) {
    if (err instanceof FinalizeInvoiceError) {
      return err.code === "NOT_FOUND" ? notFound() : conflict(err.message);
    }
    return serverError((err as Error).message);
  }
}
