import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const { name, startDate, endDate } = await req.json();
    if (!name || !startDate || !endDate)
      return badRequest("naam, startdatum en einddatum zijn verplicht");
    const period = await prisma.period.update({
      where: { id: parseInt(id) },
      data: { name, startDate: new Date(startDate), endDate: new Date(endDate) },
    });
    return NextResponse.json(period);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    await prisma.period.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
