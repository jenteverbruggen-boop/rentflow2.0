import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import { serializeInvoice, invoiceInclude } from "@/lib/serialize-invoice";
import { assertDraftMutable, DraftNotMutableError } from "@/lib/invoices";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  notes: z.string().nullable().optional(),
  footer: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: invoiceInclude,
    });
    if (!invoice) return notFound();
    return NextResponse.json(serializeInvoice(invoice));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

/** J2b.4 — notes/footer/dueDate are the only fields a draft invoice's
 * own metadata exposes for direct editing; every generated line/total
 * comes from the project via regenerate, never a manual PATCH here. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const invoiceId = parseInt(id);
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return notFound();
    assertDraftMutable(invoice);

    const { notes, footer, dueDate } = parsed.data;
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { notes, footer, dueDate: dueDate === undefined ? undefined : dueDate ? new Date(dueDate) : null },
      include: invoiceInclude,
    });
    return NextResponse.json(serializeInvoice(updated));
  } catch (err) {
    if (err instanceof DraftNotMutableError) return conflict(err.message);
    return serverError((err as Error).message);
  }
}

/** "Sent invoices are never deleted, only credited" (design doc §7) —
 * the same freeze guard applies, even though a delete touches no line
 * or total. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const invoiceId = parseInt(id);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return notFound();
    assertDraftMutable(invoice);

    await prisma.invoice.delete({ where: { id: invoiceId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof DraftNotMutableError) return conflict(err.message);
    return serverError((err as Error).message);
  }
}
