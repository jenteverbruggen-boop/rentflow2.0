import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, notFound, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const material = await prisma.material.findUnique({
      where: { id: parseInt(id) },
      include: { stockItems: { orderBy: { unitNumber: "asc" } } },
    });
    if (!material) return notFound();
    return NextResponse.json({ ...material, totalStock: material.stockItems.length });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const { name, category, dayPrice, notes } = await req.json();
    if (!name) return badRequest("naam is verplicht");
    const material = await prisma.material.update({
      where: { id: parseInt(id) },
      data: { name, category, notes, dayPrice: Number(dayPrice) || 0 },
    });
    return NextResponse.json(material);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    await prisma.material.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
