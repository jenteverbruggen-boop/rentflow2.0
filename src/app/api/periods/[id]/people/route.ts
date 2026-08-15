import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, conflict, notFound, serverError } from "@/lib/api-auth";
import { effectivePersonPrice } from "@/lib/effective-price";
import { bookPersonAssignment, type BlockedError } from "@/lib/person-booking";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    const periodId = parseInt(id);
    const { personId, role, functionId, discountPct, discountAmount, allowOverlap, billingUnit } = await req.json();
    if (!personId) return badRequest("personId is verplicht");

    const period = await prisma.period.findUnique({ where: { id: periodId } });
    if (!period) return notFound();
    const person = await prisma.person.findUnique({ where: { id: parseInt(personId) } });
    if (!person) return notFound();

    const resolvedFunctionId = functionId != null ? parseInt(functionId) : null;
    // H5.2 — resolved against the *requested* unit; effectivePersonPrice
    // itself decides whether that unit's rate actually exists (Q19
    // falls back to a day figure and echoes `unit: "dag"` in the
    // result when it does, which is what gets persisted below either
    // way).
    const resolvedUnit = billingUnit === "uur" ? "uur" : "dag";
    const price = await effectivePersonPrice(
      period.projectId,
      parseInt(personId),
      resolvedFunctionId,
      resolvedUnit,
    );

    // H1.2 — check-then-create now runs inside one transaction, with the
    // availability re-check re-run against the same tx; a racing double
    // insert surfaces as P2002, caught below, not a raw 500.
    let result;
    try {
      result = await bookPersonAssignment({
        periodId,
        personId: parseInt(personId),
        personName: person.name,
        role: role ?? null,
        functionId: resolvedFunctionId,
        billingUnit: price.unit,
        dayPriceSnapshot: price.amount,
        rateSnapshot: price.unit === "uur" ? price.amount : null,
        discountPct: discountPct != null ? toNumber(discountPct) : null,
        discountAmount: discountAmount != null ? toNumber(discountAmount) : null,
        from: period.startDate,
        to: period.endDate,
        excludePeriodId: periodId,
        sameProjectId: period.projectId,
        allowOverlap: allowOverlap === true,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "BLOCKED") {
        // H2.1 — the client must see the exact conflicting project and
        // window to render a meaningful confirm dialog, so this one case
        // returns a structured 409 instead of conflict()'s plain message.
        const blocked = err as BlockedError;
        return NextResponse.json(
          { error: blocked.message, blockingProject: blocked.blockingProject },
          { status: 409 },
        );
      }
      if (err.code === "DUPLICATE") return conflict(err.message ?? "Conflict");
      if (err.code === "P2002") return conflict("Conflict bij gelijktijdige boeking — probeer opnieuw");
      throw e;
    }

    const { assignment, warnings } = result;
    return NextResponse.json(
      redactMoney(
        {
          assignment: {
            ...assignment,
            dayPriceSnapshot: toNumber(assignment.dayPriceSnapshot),
            discountPct: toNumberOrNull(assignment.discountPct),
            discountAmount: toNumberOrNull(assignment.discountAmount),
            person: { ...assignment.person, dayPrice: toNumber(assignment.person.dayPrice) },
            function: assignment.function
              ? {
                  ...assignment.function,
                  dayRate: toNumberOrNull(assignment.function.dayRate),
                  hourRate: toNumberOrNull(assignment.function.hourRate),
                }
              : null,
          },
          warnings,
        },
        access,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}
