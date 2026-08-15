import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { periodRangeSchema, periodOverlapsProject } from "@/lib/period-validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("projecten", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    const parsed = periodRangeSchema.safeParse(await req.json());
    if (!parsed.success)
      return badRequest(parsed.error.issues[0]?.message ?? "ongeldige periode");
    const { name, startDate, endDate } = parsed.data;

    const current = await prisma.period.findUnique({
      where: { id: parseInt(id) },
      include: { project: true },
    });
    if (!current) return notFound();
    if (!periodOverlapsProject({ startDate, endDate }, current.project))
      return badRequest("periode valt volledig buiten de projectperiode");

    const period = await prisma.period.update({
      where: { id: parseInt(id) },
      data: { name, startDate, endDate },
    });
    return NextResponse.json(period);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("projecten", "verwijderen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    await prisma.period.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
