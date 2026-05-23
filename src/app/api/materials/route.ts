import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(materials);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { name, category, totalStock, notes } = await req.json();
    if (!name) return badRequest("naam is verplicht");
    const material = await prisma.material.create({
      data: { name, category, totalStock: parseInt(totalStock) || 1, notes },
    });
    return NextResponse.json(material);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
