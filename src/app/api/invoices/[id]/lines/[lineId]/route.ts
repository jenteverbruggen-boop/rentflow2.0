import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import {
  updateInvoiceLine,
  deleteInvoiceLine,
  InvoiceNotFoundError,
  InvoiceLineNotFoundError,
} from "@/lib/invoice-lines-crud";
import { DraftNotMutableError } from "@/lib/invoices";
import { serializeInvoiceLine } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string; lineId: string }> };

const patchSchema = z.object({
  description: z.string().min(1).optional(),
  quantity: z.number().optional(),
  unit: z.enum(["dag", "uur", "stuk"]).optional(),
  unitPrice: z.number().optional(),
  vatRate: z.number().optional(),
  section: z.string().nullable().optional(),
});

function mapError(err: unknown) {
  if (err instanceof InvoiceNotFoundError || err instanceof InvoiceLineNotFoundError) return notFound();
  if (err instanceof DraftNotMutableError) return conflict(err.message);
  return serverError((err as Error).message);
}

/** J2b.4 — PATCH /api/invoices/:id/lines/:lineId: partial edit, concept
 * only. Returns the whole invoice so the recomputed totals are visible
 * in the same response. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id, lineId } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const line = await updateInvoiceLine(parseInt(id), parseInt(lineId), parsed.data);
    return NextResponse.json(serializeInvoiceLine(line));
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id, lineId } = await params;
    await deleteInvoiceLine(parseInt(id), parseInt(lineId));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return mapError(err);
  }
}
