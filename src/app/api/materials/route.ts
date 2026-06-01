import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const materials = await prisma.material.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { stockItems: true } } },
    });
    return NextResponse.json(
      materials.map((m) => ({ ...m, totalStock: m._count.stockItems }))
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { name, category, dayPrice, notes, initialStock } = await req.json();
    if (!name) return badRequest("naam is verplicht");
    const material = await prisma.material.create({
      data: { name, category, notes, dayPrice: Number(dayPrice) || 0 },
    });
    const stock = Math.max(0, parseInt(initialStock) || 0);
    if (stock > 0) {
      await prisma.stockItem.createMany({
        data: Array.from({ length: stock }, (_, i) => ({ materialId: material.id, unitNumber: i + 1 })),
      });
    }
    return NextResponse.json({ ...material, totalStock: stock });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
