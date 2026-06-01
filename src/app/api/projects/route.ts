import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";
import { projectInclude } from "@/lib/project-include";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const projects = await prisma.project.findMany({
      orderBy: { startDate: "asc" },
      include: projectInclude,
    });
    return NextResponse.json(projects);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { name, client, location, startDate, endDate, status, notes } = await req.json();
    if (!name || !startDate || !endDate) return badRequest("naam, startdatum en einddatum zijn verplicht");

    const project = await prisma.project.create({
      data: {
        name,
        client,
        location,
        status,
        notes,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        periods: {
          create: [
            { name: "Hoofdperiode", startDate: new Date(startDate), endDate: new Date(endDate) },
          ],
        },
      },
      include: projectInclude,
    });
    return NextResponse.json(project);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
