import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { projectInclude } from "@/lib/project-include";
import { serializeProject } from "@/lib/serialize-project";
import { fetchProjects } from "@/lib/fetch-projects";
import { brusselsWallClockToUtc } from "@/lib/brussels-time";
import { redactMoney } from "@/lib/redact";
import { parseDateRange } from "@/lib/parse-date-range";

/**
 * I2.1 — `from`/`to` are optional, with an unfiltered fallback: unlike
 * materials/available/route.ts (which *requires* a range and 400s
 * without one), three existing callers already fetch this endpoint
 * with no query string at all (dashboard, projects table, planning
 * pre-I2) and must keep working unchanged. Only when both are present
 * does this switch to the range-filtered, lean planning shape — a
 * materially different response shape from the full `Project` tree,
 * never returned to an unfiltered caller.
 */
export async function GET(req: NextRequest) {
  const access = await requireModule("projecten", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (fromParam || toParam) {
      const range = parseDateRange(fromParam, toParam);
      if (!range) return badRequest("from en to moeten een geldige periode vormen (to na from)");
      return NextResponse.json(await fetchProjects(access, range));
    }

    return NextResponse.json(await fetchProjects(access, undefined));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("projecten", "wijzigen").catch(() => null);
  if (!access) return forbidden();

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
    return NextResponse.json(redactMoney(serializeProject(project), access));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
