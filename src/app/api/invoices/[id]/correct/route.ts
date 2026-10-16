import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, notFound, conflict, badRequest, serverError } from "@/lib/api-auth";
import { correctInvoice, CorrectInvoiceError } from "@/lib/correct-invoice";
import { CreditNoteError } from "@/lib/create-credit-note";
import { serializeInvoice } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

/** POST /api/invoices/:id/correct — credit the sent invoice in full and open a
 * replacement draft with the same lines (see lib/correct-invoice.ts). Returns
 * both drafts; the UI continues on the replacement. */
export async function POST(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const { creditNote, replacement } = await correctInvoice(parseInt(id));
    return NextResponse.json(
      { creditNote: serializeInvoice(creditNote), replacement: serializeInvoice(replacement) },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof CorrectInvoiceError) {
      if (err.code === "NOT_FOUND") return notFound();
      if (err.code === "NOT_APPLICABLE" || err.code === "NOT_SENT") return badRequest(err.message);
      return conflict(err.message);
    }
    if (err instanceof CreditNoteError) return conflict(err.message);
    return serverError((err as Error).message);
  }
}
