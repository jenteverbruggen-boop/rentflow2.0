import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, notFound, serverError } from "@/lib/api-auth";
import { fillShortages } from "@/lib/material-shortage-db";

type Params = { params: Promise<{ id: string }> };

/** Overboeken — the "Toewijzen" button on the Materialen tab: resolves
 * every open PeriodMaterialShortage on this period's project against
 * stock that has since freed up or grown. */
export async function POST(_req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    const period = await prisma.period.findUnique({ where: { id: parseInt(id) } });
    if (!period) return notFound();

    const result = await fillShortages(period.projectId);
    return NextResponse.json(result);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
