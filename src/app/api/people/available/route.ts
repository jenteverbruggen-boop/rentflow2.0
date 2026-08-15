import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { checkPersonAvailability } from "@/lib/availability";
import { toNumber } from "@/lib/serialize";
import { parseDateRange } from "@/lib/parse-date-range";
import { redactMoney } from "@/lib/redact";

export async function GET(req: NextRequest) {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const excludePeriodId = searchParams.get("excludePeriodId");
    const sameProjectId = searchParams.get("sameProjectId");
    const projectId = searchParams.get("projectId") ?? sameProjectId;
    const range = parseDateRange(from, to);
    if (!range) return badRequest("from en to zijn verplicht en moeten een geldige periode vormen (to na from)");

    const people = await prisma.person.findMany({ orderBy: { name: "asc" } });

    const overrides = projectId
      ? await prisma.projectPersonPrice.findMany({ where: { projectId: parseInt(projectId) } })
      : [];
    const overrideMap = new Map(overrides.map((o) => [o.personId, toNumber(o.dayPrice)]));

    const results = await Promise.all(
      people.map(async (p) => {
        const check = await checkPersonAvailability(p.id, {
          from: range.from,
          to: range.to,
          excludePeriodId: excludePeriodId ? parseInt(excludePeriodId) : undefined,
          sameProjectId: sameProjectId ? parseInt(sameProjectId) : undefined,
        });
        const basePrice = toNumber(p.dayPrice);
        const effectivePrice = overrideMap.get(p.id) ?? basePrice;
        return redactMoney(
          {
            person: { ...p, dayPrice: effectivePrice, basePrice, hasOverride: overrideMap.has(p.id) },
            isAvailable: !check.blockingProject,
            blockingProject: check.blockingProject,
            sameProjectWarning: check.sameProjectWarning,
          },
          access,
        );
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
