import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requireRole,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { projectInclude } from "@/lib/project-include";
import { serializeProject } from "@/lib/serialize-project";
import { brusselsWallClockToUtc } from "@/lib/brussels-time";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const projects = await prisma.project.findMany({
      orderBy: { startDate: "asc" },
      include: projectInclude,
    });
    return NextResponse.json(projects.map(serializeProject));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "PLANNER").catch(() => null);
  if (!auth) return forbidden();

  try {
    const {
      name,
      client,
      clientId,
      location,
      locationId,
      startDate,
      endDate,
      status,
      notes,
    } = await req.json();
    if (!name || !startDate || !endDate)
      return badRequest("naam, startdatum en einddatum zijn verplicht");

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
            {
              // The auto-created period defaults to a single day (the
              // project's own start date), 08:00-17:00 Brussels time — not
              // the full project span, which is what actually books a
              // person solid for the whole project (H4). project.startDate
              // is a bare yyyy-MM-dd date stored as UTC midnight, so 08:00/
              // 17:00 must be computed against Europe/Brussels explicitly
              // rather than added as raw UTC hours.
              name: "Hoofdperiode",
              startDate: brusselsWallClockToUtc(new Date(startDate), 8, 0),
              endDate: brusselsWallClockToUtc(new Date(startDate), 17, 0),
            },
          ],
        },
      },
      include: projectInclude,
    });
    return NextResponse.json(serializeProject(project));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
