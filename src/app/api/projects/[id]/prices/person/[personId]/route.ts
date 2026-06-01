import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id, personId } = await params;
    const projectId = parseInt(id);
    const persId = parseInt(personId);
    const { dayPrice } = await req.json();
    if (dayPrice == null || Number(dayPrice) < 0) return badRequest("dayPrice >= 0 is verplicht");

    const price = Number(dayPrice);
    const override = await prisma.projectPersonPrice.upsert({
      where: { projectId_personId: { projectId, personId: persId } },
      create: { projectId, personId: persId, dayPrice: price },
      update: { dayPrice: price },
      include: { person: true },
    });
    await prisma.periodPerson.updateMany({
      where: { period: { projectId }, personId: persId },
      data: { dayPriceSnapshot: price },
    });
    return NextResponse.json(override);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id, personId } = await params;
    const projectId = parseInt(id);
    const persId = parseInt(personId);
    await prisma.projectPersonPrice.deleteMany({
      where: { projectId, personId: persId },
    });
    const person = await prisma.person.findUnique({ where: { id: persId } });
    if (person) {
      await prisma.periodPerson.updateMany({
        where: { period: { projectId }, personId: persId },
        data: { dayPriceSnapshot: Number(person.dayPrice) },
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
