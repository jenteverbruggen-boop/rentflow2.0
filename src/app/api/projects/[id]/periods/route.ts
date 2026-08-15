import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { periodRangeSchema, periodOverlapsProject } from "@/lib/period-validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("projecten", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const parsed = periodRangeSchema.safeParse(await req.json());
    if (!parsed.success)
      return badRequest(parsed.error.issues[0]?.message ?? "ongeldige periode");
    const { name, startDate, endDate } = parsed.data;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return notFound();
    if (!periodOverlapsProject({ startDate, endDate }, project))
      return badRequest("periode valt volledig buiten de projectperiode");

    const period = await prisma.period.create({
      data: {
        projectId,
        name,
        startDate,
        endDate,
      },
      include: {
        materials: { include: { stockItem: { include: { material: true } } } },
        people: { include: { person: true } },
      },
    });
    return NextResponse.json(period);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
