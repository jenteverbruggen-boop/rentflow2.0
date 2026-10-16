import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import { addManualLine, InvoiceNotFoundError } from "@/lib/invoice-lines-crud";
import { DraftNotMutableError } from "@/lib/invoices";
import { serializeInvoiceLine } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

const lineSchema = z
  .object({
    kind: z.enum(["manual", "text"]).default("manual"),
    description: z.string().trim().min(1, "Omschrijving is verplicht").max(2000, "Maximaal 2000 tekens"),
    quantity: z.number().positive("Aantal moet groter zijn dan 0").optional(),
    unit: z.enum(["dag", "uur", "stuk"]).optional(),
    unitPrice: z.number().finite().optional(),
    vatRate: z.number().min(0).max(100).optional(),
    section: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "manual" && (v.quantity === undefined || v.unit === undefined || v.unitPrice === undefined)) {
      ctx.addIssue({ code: "custom", message: "Aantal, eenheid en prijs zijn verplicht" });
    }
  });

/** J2b.4 — POST /api/invoices/:id/lines (design doc §7): a priced manual
 * line or a free-text paragraph, concept only. Returns the new line; the
 * hook invalidates the invoice query to pick up the recomputed totals. */
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
