import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, notFound, serverError } from "@/lib/api-auth";
import { serializeInvoice, invoiceInclude } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

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
