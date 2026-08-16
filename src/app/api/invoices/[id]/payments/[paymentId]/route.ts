import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { updatePayment, deletePayment, PaymentNotFoundError } from "@/lib/invoice-payments";
import { serializePayment } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string; paymentId: string }> };

const patchSchema = z.object({
  amount: z.number().positive().optional(),
  paidAt: z.string().optional(),
  method: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** J2b.6 — may flip the invoice back to `verzonden` in the same
 * transaction if correcting this payment leaves a balance again. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id, paymentId } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const payment = await updatePayment(parseInt(id), parseInt(paymentId), parsed.data);
    return NextResponse.json(serializePayment(payment));
  } catch (err) {
    if (err instanceof PaymentNotFoundError) return notFound();
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id, paymentId } = await params;
    await deletePayment(parseInt(id), parseInt(paymentId));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof PaymentNotFoundError) return notFound();
    return serverError((err as Error).message);
  }
}
