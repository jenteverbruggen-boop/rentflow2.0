import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  childId: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const components = await prisma.materialComponent.findMany({
      where: { parentId: parseInt(id) },
      include: { child: { include: { categoryRel: true } } },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(components);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const component = await prisma.materialComponent.create({
      data: { parentId: parseInt(id), childId: parsed.data.childId, quantity: parsed.data.quantity },
      include: { child: true },
    });
    return NextResponse.json(component);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
