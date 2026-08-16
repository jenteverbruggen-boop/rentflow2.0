import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { recordPayment, InvoiceNotFoundError, PaymentRejectedError } from "@/lib/invoice-payments";
import { serializePayment } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

const paymentSchema = z.object({
  amount: z.number().positive(),
  paidAt: z.string(),
  method: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** J2b.6 — POST /api/invoices/:id/payments (design doc §7): `400` if
 * the invoice is `concept` or `kind: "creditnota"`. May flip the
 * invoice to `betaald` in the same transaction (§6.2). */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const parsed = paymentSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const payment = await recordPayment(parseInt(id), parsed.data);
    return NextResponse.json(serializePayment(payment), { status: 201 });
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return notFound();
    if (err instanceof PaymentRejectedError) return badRequest(err.message);
    return serverError((err as Error).message);
  }
}
