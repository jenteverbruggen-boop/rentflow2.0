import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { createCreditNote, CreditNoteError } from "@/lib/create-credit-note";
import { serializeInvoice } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  lines: z.array(z.object({ lineId: z.number().int(), quantity: z.number().positive().optional() })).optional(),
});

/** J2b.5 — POST /api/invoices/:id/credit-note (design doc §7): omit
 * `lines` for a full mirror credit note, provide it for a partial one.
 * Creates a new draft `Invoice` (`kind: "creditnota"`) — reuses the
 * existing finalize endpoint (J2b.3) for the `credit` series. */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const creditNote = await createCreditNote(parseInt(id), parsed.data.lines);
    return NextResponse.json(serializeInvoice(creditNote), { status: 201 });
  } catch (err) {
    if (err instanceof CreditNoteError) {
      if (err.code === "NOT_FOUND" || err.code === "LINE_NOT_FOUND") return notFound();
      if (err.code === "NOT_SENT" || err.code === "ALREADY_CREDIT_NOTE" || err.code === "INVALID_QUANTITY") {
        return badRequest(err.message);
      }
    }
    return serverError((err as Error).message);
  }
}
