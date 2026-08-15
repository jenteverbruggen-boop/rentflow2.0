import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { effectivePersonPrice } from "@/lib/effective-price";
import { redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string }> };

// L2.2 — lets the booking picker show the resolved rate and its source
// (L1.2) before the user confirms, without duplicating
// effective-price.ts's cascade on the client. Named `dayPriceSnapshot`
// (not `amount`) so it goes through redact.ts's existing scalar
// denylist for free — a caller without Kosten/Facturen: lezen must not
// see a price preview any more than they'd see the booking's eventual
// dayPriceSnapshot.
export async function GET(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const periodId = parseInt(id);
    const { searchParams } = new URL(req.url);
    const personId = searchParams.get("personId");
    const functionId = searchParams.get("functionId");
    if (!personId) return badRequest("personId is verplicht");

    const period = await prisma.period.findUnique({ where: { id: periodId } });
    if (!period) return notFound();

    const price = await effectivePersonPrice(
      period.projectId,
      parseInt(personId),
      functionId ? parseInt(functionId) : null,
    );

    return NextResponse.json(
      redactMoney({ dayPriceSnapshot: price.amount, source: price.source }, access),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}
