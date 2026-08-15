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

type Params = { params: Promise<{ id: string; assignmentId: string }> };

const schema = z.object({
  label: z.string().optional().nullable(),
  unitCost: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).default(1),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { assignmentId } = await params;
    const travel = await prisma.personTravelCost.findMany({
      where: { periodPersonId: parseInt(assignmentId) },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(
      travel.map((t) => ({ ...t, unitCost: toNumber(t.unitCost) })),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { assignmentId } = await params;
    const periodPersonId = parseInt(assignmentId);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const assignment = await prisma.periodPerson.findUnique({
      where: { id: periodPersonId },
    });
    if (!assignment) return notFound();

    const created = await prisma.personTravelCost.create({
      data: {
        periodPersonId,
        label: parsed.data.label ?? null,
        unitCost: parsed.data.unitCost,
        quantity: parsed.data.quantity,
      },
    });
    return NextResponse.json({ ...created, unitCost: toNumber(created.unitCost) });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
