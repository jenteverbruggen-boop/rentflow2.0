import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { createQuote } from "@/lib/create-quote";
import { serializeInvoice, invoiceInclude } from "@/lib/serialize-invoice";
import { quoteErrorResponse } from "@/lib/quote-route";

const createSchema = z.object({ projectId: z.number().int() });

/** Quotes are money documents: module Kosten/Facturen, never for a scoped
 * (freelancer) caller — the same rule as every invoice route. */
export async function GET(req: NextRequest) {
  const access = await requireModule("kosten_facturen", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    const quotes = await prisma.invoice.findMany({
      where: {
        kind: "offerte",
        ...(status ? { status } : {}),
        ...(projectId ? { projectId: parseInt(projectId) } : {}),
      },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(quotes.map(serializeInvoice));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("projectId is verplicht");
    return NextResponse.json(serializeInvoice(await createQuote(parsed.data.projectId)), { status: 201 });
  } catch (err) {
    return quoteErrorResponse(err);
  }
}
