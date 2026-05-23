import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, conflict, serverError } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { projectId, personId, role, startDate, endDate } = await req.json();
    if (!projectId || !personId || !startDate || !endDate)
      return badRequest("projectId, personId, startDate en endDate zijn verplicht");

    const existing = await prisma.projectPerson.findFirst({
      where: {
        personId: parseInt(personId),
        NOT: { projectId: parseInt(projectId) },
        project: {
          AND: [
            { startDate: { lte: new Date(endDate) } },
            { endDate: { gte: new Date(startDate) } },
          ],
        },
      },
      include: { project: true },
    });

    if (existing) {
      return conflict(
        `Deze persoon staat al ingepland op project "${existing.project.name}" tijdens deze periode`
      );
    }

    const booking = await prisma.projectPerson.create({
      data: {
        projectId: parseInt(projectId),
        personId: parseInt(personId),
        role,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      include: { person: true },
    });
    return NextResponse.json(booking);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
