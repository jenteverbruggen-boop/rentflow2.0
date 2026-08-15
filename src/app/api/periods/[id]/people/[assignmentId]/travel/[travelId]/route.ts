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
import { toNumber } from "@/lib/serialize";

type Params = { params: Promise<{ travelId: string }> };

const schema = z.object({
  label: z.string().optional().nullable(),
  unitCost: z.coerce.number().min(0).optional(),
  quantity: z.coerce.number().int().min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { travelId } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const existing = await prisma.personTravelCost.findUnique({
      where: { id: parseInt(travelId) },
    });
    if (!existing) return notFound();
    const updated = await prisma.personTravelCost.update({
      where: { id: parseInt(travelId) },
      data: parsed.data,
    });
    return NextResponse.json({ ...updated, unitCost: toNumber(updated.unitCost) });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { travelId } = await params;
    await prisma.personTravelCost.delete({ where: { id: parseInt(travelId) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
