import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-auth";
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
  const auth = await requireRole("ADMIN", "PLANNER").catch(() => null);
  if (!auth) return forbidden();

  try {
    const { name, client, clientId, location, locationId, startDate, endDate, status, notes } = await req.json();
    if (!name || !startDate || !endDate) return badRequest("naam, startdatum en einddatum zijn verplicht");

    const project = await prisma.project.create({
      data: {
        name,
        client,
        clientId: clientId ?? null,
        location,
        locationId: locationId ?? null,
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
