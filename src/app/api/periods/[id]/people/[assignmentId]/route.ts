import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, serverError, notFound } from "@/lib/api-auth";
import { effectivePersonPrice } from "@/lib/effective-price";
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
    const { resnapshotPrice, discountPct, discountAmount, role } = body;
    const data: Record<string, unknown> = {};
    if (resnapshotPrice) {
      const current = await prisma.periodPerson.findUnique({
        where: { id: parseInt(assignmentId) },
        include: { period: true },
      });
      if (!current) return notFound();
      data.dayPriceSnapshot = await effectivePersonPrice(current.period.projectId, current.personId);
    }
    if (discountPct !== undefined) data.discountPct = discountPct != null ? toNumber(discountPct) : null;
    if (discountAmount !== undefined) data.discountAmount = discountAmount != null ? toNumber(discountAmount) : null;
    if (role !== undefined) data.role = role;
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
