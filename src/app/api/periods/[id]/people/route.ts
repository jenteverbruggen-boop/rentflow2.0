import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, conflict, notFound, serverError } from "@/lib/api-auth";
import { checkPersonAvailability } from "@/lib/availability";
import { effectivePersonPrice } from "@/lib/effective-price";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const periodId = parseInt(id);
    const { personId, role, discountPct, discountAmount } = await req.json();
    if (!personId) return badRequest("personId is verplicht");

    const period = await prisma.period.findUnique({ where: { id: periodId } });
    if (!period) return notFound();
    const person = await prisma.person.findUnique({ where: { id: parseInt(personId) } });
    if (!person) return notFound();

    const existing = await prisma.periodPerson.findUnique({
      where: { periodId_personId: { periodId, personId: parseInt(personId) } },
    });
    if (existing) {
      return conflict(`${person.name} staat al toegewezen aan deze periode`);
    }

    const check = await checkPersonAvailability(parseInt(personId), {
      from: period.startDate,
      to: period.endDate,
      excludePeriodId: periodId,
      sameProjectId: period.projectId,
    });
    if (check.blockingProject) {
      return conflict(
        `${person.name} staat al ingepland op project "${check.blockingProject.name}" tijdens deze periode`
      );
    }
    const warnings: string[] = [];
    if (check.sameProjectWarning) {
      warnings.push(`${person.name} staat ook in een andere periode van dit project`);
    }

    const assignment = await prisma.periodPerson.create({
      data: {
        periodId,
        personId: parseInt(personId),
        role: role ?? null,
        dayPriceSnapshot: await effectivePersonPrice(period.projectId, parseInt(personId)),
        discountPct: discountPct != null ? Number(discountPct) : null,
        discountAmount: discountAmount != null ? Number(discountAmount) : null,
      },
      include: { person: true },
    });
    return NextResponse.json({ assignment, warnings });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
