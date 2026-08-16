import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { createDraftInvoice, CreateDraftInvoiceError } from "@/lib/create-draft-invoice";
import { serializeInvoice, invoiceInclude } from "@/lib/serialize-invoice";

const createSchema = z
  .object({
    projectId: z.number().int(),
    invoiceRole: z.enum(["deposit", "final", "standalone"]),
    depositType: z.enum(["fixed", "percentage"]).optional(),
    depositValue: z.number().optional(),
  })
  .refine((v) => v.invoiceRole !== "deposit" || (v.depositType && v.depositValue != null), {
    message: "depositType en depositValue zijn verplicht voor een voorschotfactuur",
  });

/**
 * J2b.2 — module Kosten/Facturen throughout (design doc §7); `scope:
 * own` denied outright regardless of the matrix
 * (own-data-scoping-design.md:188 — every invoice route is treated the
 * same as the money-shaped stats page, not partially redacted).
 */
export async function POST(req: NextRequest) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const invoice = await createDraftInvoice(parsed.data);
    return NextResponse.json(serializeInvoice(invoice), { status: 201 });
  } catch (err) {
    if (err instanceof CreateDraftInvoiceError) {
      return err.code === "NOT_FOUND" ? notFound() : badRequest(err.message);
    }
    return serverError((err as Error).message);
  }
}

export async function GET(req: NextRequest) {
  const access = await requireModule("kosten_facturen", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");
    const projectId = searchParams.get("projectId");
    const kind = searchParams.get("kind");

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(clientId ? { clientId: parseInt(clientId) } : {}),
        ...(projectId ? { projectId: parseInt(projectId) } : {}),
        ...(kind ? { kind } : {}),
      },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices.map(serializeInvoice));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
