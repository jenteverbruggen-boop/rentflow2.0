import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
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
  const access = await requireModule("kosten_facturen", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own is denied here even though this is a `lezen` request that
  // N5.1's read-only override would otherwise let through: this route
  // returns nothing but money (label/unitCost/quantity), so there is no
  // partial-keep the way redactMoney() gives every other endpoint — it
  // never calls redactMoney()/moneyVisible() at all, it *is* the raw
  // source those functions redact elsewhere. Found while writing N5.4's
  // enumeration test against own-data-scoping-design.md §5's Kosten
  // table (line 899): a scope: own role with Kosten/Facturen: lezen
  // granted (a plausible misconfiguration, not even the wide-open
  // default) would otherwise see full travel costs, since requireModule
  // only overrides write levels, not lezen.
  if (access.scope === "own") return forbidden();
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
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
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
