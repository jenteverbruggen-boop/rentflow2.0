import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-auth";
import { projectInclude } from "@/lib/project-include";
import { serializeProject } from "@/lib/serialize-project";
import { redactMoney } from "@/lib/redact";
import { scopeFilter } from "@/lib/scope-filter";
import { canOverbook } from "@/lib/material-shortage";
import { fillShortages, assertNoShortages } from "@/lib/material-shortage-db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("projecten", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    // Ownership folded into the same where as the id lookup — "not
    // booked on it" and "doesn't exist" both resolve to null through
    // one code path, so a scope: own caller gets 404, never 403, and
    // there is no separate branch to forget (design doc §7).
    const project = await prisma.project.findUnique({
      where: { ...(scopeFilter(access) ?? {}), id: parseInt(id) },
      include: projectInclude,
    });
    if (!project) return notFound();
    return NextResponse.json(redactMoney(serializeProject(project), access));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("projecten", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
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

    const projectId = parseInt(id);
    const existing = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    if (!existing) return notFound();

    // Overboeken (K-series) — leaving concept/geannuleerd is the gate:
    // first try to resolve any open shortages against stock that has
    // since freed up or grown, then refuse the whole update (status
    // unwritten) if anything is still overbooked.
    const resultStatus = status ?? existing.status;
    if (!canOverbook(resultStatus)) {
      await fillShortages(projectId);
      try {
        await assertNoShortages(projectId);
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string; shortages?: unknown };
        if (err.code === "OVERBOOK") {
          return NextResponse.json(
            { error: err.message, shortages: err.shortages },
            { status: 409 },
          );
        }
        throw e;
      }
    }

    const project = await prisma.project.update({
      where: { id: projectId },
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
      },
    });
    return NextResponse.json(project);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("projecten", "verwijderen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    await prisma.project.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
