import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, serverError, notFound } from "@/lib/api-auth";
import { effectivePersonPrice } from "@/lib/effective-price";

type Params = { params: Promise<{ id: string; assignmentId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { assignmentId } = await params;
    const { resnapshotPrice, discountPct, discountAmount, role } = await req.json();
    const data: Record<string, unknown> = {};
    if (resnapshotPrice) {
      const current = await prisma.periodPerson.findUnique({
        where: { id: parseInt(assignmentId) },
        include: { period: true },
      });
      if (!current) return notFound();
      data.dayPriceSnapshot = await effectivePersonPrice(current.period.projectId, current.personId);
    }
    if (discountPct !== undefined) data.discountPct = discountPct != null ? Number(discountPct) : null;
    if (discountAmount !== undefined) data.discountAmount = discountAmount != null ? Number(discountAmount) : null;
    if (role !== undefined) data.role = role;
    const updated = await prisma.periodPerson.update({
      where: { id: parseInt(assignmentId) },
      data,
      include: { person: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { assignmentId } = await params;
    await prisma.periodPerson.delete({ where: { id: parseInt(assignmentId) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
