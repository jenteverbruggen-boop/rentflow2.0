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

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("projecten", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id: parseInt(id) },
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

    const project = await prisma.project.update({
      where: { id: parseInt(id) },
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
