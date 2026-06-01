import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";
import { checkPersonAvailability } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const excludePeriodId = searchParams.get("excludePeriodId");
    const sameProjectId = searchParams.get("sameProjectId");
    const projectId = searchParams.get("projectId") ?? sameProjectId;
    if (!from || !to) return badRequest("from en to zijn verplicht");

    const people = await prisma.person.findMany({ orderBy: { name: "asc" } });

    const overrides = projectId
      ? await prisma.projectPersonPrice.findMany({ where: { projectId: parseInt(projectId) } })
      : [];
    const overrideMap = new Map(overrides.map((o) => [o.personId, Number(o.dayPrice)]));

    const results = await Promise.all(
      people.map(async (p) => {
        const check = await checkPersonAvailability(p.id, {
          from: new Date(from),
          to: new Date(to),
          excludePeriodId: excludePeriodId ? parseInt(excludePeriodId) : undefined,
          sameProjectId: sameProjectId ? parseInt(sameProjectId) : undefined,
        });
        const basePrice = Number(p.dayPrice);
        const effectivePrice = overrideMap.get(p.id) ?? basePrice;
        return {
          person: { ...p, dayPrice: effectivePrice, basePrice, hasOverride: overrideMap.has(p.id) },
          isAvailable: !check.blockingProject,
          blockingProject: check.blockingProject,
          sameProjectWarning: check.sameProjectWarning,
        };
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
