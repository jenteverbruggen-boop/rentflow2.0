import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError, notFound } from "@/lib/api-auth";
import { effectivePersonPrice } from "@/lib/effective-price";
import { applyAssignmentWindowUpdate } from "@/lib/assignment-days-write";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { findRejectedField, redactMoney } from "@/lib/redact";

const KOSTEN_FIELDS = ["discountPct", "discountAmount"] as const;

type Params = { params: Promise<{ id: string; assignmentId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { assignmentId } = await params;
    const body = await req.json();
    if (findRejectedField(body, access, KOSTEN_FIELDS)) return forbidden();
    const { resnapshotPrice, discountPct, discountAmount, startAt, endAt, days } = body;
    const data: Record<string, unknown> = {};

    // H1.3 — a custom hours window needs the period's own dates to
    // validate against; resnapshotPrice already needed the period for
    // its project id, so both branches share one fetch. H6's day set
    // validates against the same period.
    const needsPeriod =
      resnapshotPrice || startAt !== undefined || endAt !== undefined || days !== undefined;
    const current = needsPeriod
      ? await prisma.periodPerson.findUnique({
          where: { id: parseInt(assignmentId) },
          include: { period: true },
        })
      : null;
    if (needsPeriod && !current) return notFound();

    if (resnapshotPrice) {
      const price = await effectivePersonPrice(
        current!.period.projectId,
        current!.personId,
        current!.functionId,
      );
      data.dayPriceSnapshot = price.amount;
    }

    // `current` is non-null whenever a window/day update was asked for —
    // `needsPeriod && !current` already 404'd above.
    if (current) {
      const windowError = await applyAssignmentWindowUpdate(
        parseInt(assignmentId),
        { startAt, endAt, days },
        current.period,
        data,
      );
      if (windowError) return badRequest(windowError);
    }

    for (const [field, value] of Object.entries({ discountPct, discountAmount })) {
      if (value !== undefined) data[field] = value != null ? toNumber(value) : null;
    }
    const updated = await prisma.periodPerson.update({
      where: { id: parseInt(assignmentId) },
      data,
      include: { person: true },
    });
    return NextResponse.json(
      redactMoney(
        {
          ...updated,
          dayPriceSnapshot: toNumber(updated.dayPriceSnapshot),
          discountPct: toNumberOrNull(updated.discountPct),
          discountAmount: toNumberOrNull(updated.discountAmount),
          person: { ...updated.person, dayPrice: toNumber(updated.person.dayPrice) },
        },
        access,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "verwijderen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { assignmentId } = await params;
    await prisma.periodPerson.delete({ where: { id: parseInt(assignmentId) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
