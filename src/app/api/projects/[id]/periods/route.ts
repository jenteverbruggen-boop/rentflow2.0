import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const { name, startDate, endDate } = await req.json();
    if (!name || !startDate || !endDate)
      return badRequest("naam, startdatum en einddatum zijn verplicht");
    const period = await prisma.period.create({
      data: {
        projectId: parseInt(id),
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      include: {
        materials: { include: { stockItem: { include: { material: true } } } },
        people: { include: { person: true } },
      },
    });
    return NextResponse.json(period);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
