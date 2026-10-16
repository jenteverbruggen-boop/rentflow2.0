import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound } from "@/lib/api-auth";
import { sendQuote, reopenQuote, rejectQuote } from "@/lib/quote-lifecycle";
import { acceptQuote } from "@/lib/accept-quote";
import { convertQuote } from "@/lib/convert-quote";
import { serializeInvoice } from "@/lib/serialize-invoice";
import { quoteErrorResponse } from "@/lib/quote-route";

type Params = { params: Promise<{ id: string; action: string }> };

const convertSchema = z
  .object({
    mode: z.enum(["full", "deposit", "final"]),
    depositType: z.enum(["fixed", "percentage"]).optional(),
    depositValue: z.number().positive().optional(),
  })
  .refine((v) => v.mode !== "deposit" || (v.depositType && v.depositValue != null), {
    message: "depositType en depositValue zijn verplicht voor een voorschot",
  });

/**
 * POST /api/quotes/:id/send | reopen | reject | accept | convert
 *
 * `accept` is one server-side step (quote → aanvaard and the concept project
 * → bevestigd together, never two client calls that can half-fail), so it
 * needs write access to both quotes/invoices and projects. `convert` takes
 * `{ mode: "full" | "deposit" | "final", depositType?, depositValue? }` and
 * answers with the new invoice draft.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id, action } = await params;
    const quoteId = parseInt(id);

    switch (action) {
      case "send":
        return NextResponse.json(serializeInvoice(await sendQuote(quoteId)));
      case "reopen":
        return NextResponse.json(serializeInvoice(await reopenQuote(quoteId)));
      case "reject":
        return NextResponse.json(serializeInvoice(await rejectQuote(quoteId)));
      case "accept": {
        // The project moves to bevestigd, which is a project write.
        const projects = await requireModule("projecten", "wijzigen").catch(() => null);
        if (!projects) return forbidden();
        return NextResponse.json(serializeInvoice(await acceptQuote(quoteId)));
      }
      case "convert": {
        const parsed = convertSchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
        const invoice = await convertQuote(quoteId, parsed.data);
        return NextResponse.json(serializeInvoice(invoice), { status: 201 });
      }
      default:
        return notFound();
    }
  } catch (err) {
    return quoteErrorResponse(err);
  }
}

