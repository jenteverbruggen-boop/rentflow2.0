import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import { addManualLine, InvoiceNotFoundError } from "@/lib/invoice-lines-crud";
import { DraftNotMutableError } from "@/lib/invoices";
import { serializeInvoiceLine } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

const lineSchema = z.object({
  description: z.string().min(1, "Omschrijving is verplicht"),
  quantity: z.number(),
  unit: z.enum(["dag", "uur", "stuk"]),
  unitPrice: z.number(),
  vatRate: z.number().optional(),
  section: z.string().nullable().optional(),
});

/** J2b.4 — POST /api/invoices/:id/lines (design doc §7): a manual line,
 * concept only. Returns the whole invoice (not just the new line) so
 * the caller sees the recomputed totals in the same response. */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const parsed = lineSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const line = await addManualLine(parseInt(id), parsed.data);
    return NextResponse.json(serializeInvoiceLine(line), { status: 201 });
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return notFound();
    if (err instanceof DraftNotMutableError) return conflict(err.message);
    return serverError((err as Error).message);
  }
}
