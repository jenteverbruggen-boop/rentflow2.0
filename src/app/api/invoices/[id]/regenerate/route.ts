import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, notFound, conflict, badRequest, serverError } from "@/lib/api-auth";
import { regenerateInvoice, InvoiceNotFoundError } from "@/lib/regenerate-invoice";
import { DraftNotMutableError } from "@/lib/invoices";
import { serializeInvoice } from "@/lib/serialize-invoice";

type Params = { params: Promise<{ id: string }> };

/** J2b.4 — POST /api/invoices/:id/regenerate: re-runs the line
 * generator against the live project, discarding every current line
 * (manual lines included — the UI must confirm before calling this,
 * design doc §12 open risk 3). Concept only. */
export async function POST(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const invoice = await regenerateInvoice(parseInt(id));
    return NextResponse.json(serializeInvoice(invoice));
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return notFound();
    if (err instanceof DraftNotMutableError) return conflict(err.message);
    if (err instanceof Error && err.message.includes("gekoppeld project")) return badRequest(err.message);
    return serverError((err as Error).message);
  }
}
