import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, notFound, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; componentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { componentId } = await params;
    const comp = await prisma.materialComponent.findUnique({ where: { id: parseInt(componentId) } });
    if (!comp) return notFound();
    await prisma.materialComponent.delete({ where: { id: parseInt(componentId) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
