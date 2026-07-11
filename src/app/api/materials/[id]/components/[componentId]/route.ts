import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorized,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; componentId: string }> };

const patchSchema = z.object({ quantity: z.number().int().min(1) });

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { componentId } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const comp = await prisma.materialComponent.findUnique({
      where: { id: parseInt(componentId) },
    });
    if (!comp) return notFound();
    const updated = await prisma.materialComponent.update({
      where: { id: parseInt(componentId) },
      data: { quantity: parsed.data.quantity },
      include: { child: true },
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
    const { componentId } = await params;
    const comp = await prisma.materialComponent.findUnique({
      where: { id: parseInt(componentId) },
    });
    if (!comp) return notFound();
    await prisma.materialComponent.delete({
      where: { id: parseInt(componentId) },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
