import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { projectInclude } from "@/lib/project-include";
import { serializeProject } from "@/lib/serialize-project";
import { planningProjectInclude, serializePlanningProject, type PlanningProject } from "@/lib/planning-include";
import { redactMoney } from "@/lib/redact";
import { scopeFilter, type ScopeAccess } from "@/lib/scope-filter";
import type { ResolvedAccess } from "@/lib/api-auth";

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * I2.1 — the lib half of GET /api/projects, split from the route so
 * both paths (unfiltered full tree vs. range-filtered lean planning
 * shape) are testable against a real DB (this codebase's established
 * pattern). `range` is optional — omitting it is the exact behaviour
 * every pre-I2 caller (dashboard, projects table, planning) already
 * depends on, byte-identical. Overloaded so a caller passing a real
 * range gets `PlanningProject[]` back, never the union.
 */
export async function fetchProjects(
  access: ResolvedAccess,
  range: DateRange,
  client?: PrismaClient,
): Promise<PlanningProject[]>;
export async function fetchProjects(
  access: ResolvedAccess,
  range: undefined,
  client?: PrismaClient,
): Promise<ReturnType<typeof serializeProject>[]>;
export async function fetchProjects(
  access: ResolvedAccess,
  range: DateRange | undefined,
  client: PrismaClient = defaultPrisma,
) {
  if (range) {
    const projects = await client.project.findMany({
      where: {
        ...(scopeFilter(access as ScopeAccess) ?? {}),
        startDate: { lt: range.to },
        endDate: { gt: range.from },
      },
      orderBy: { startDate: "asc" },
      include: planningProjectInclude,
    });
    return projects.map(serializePlanningProject);
  }

  const projects = await client.project.findMany({
    where: scopeFilter(access as ScopeAccess),
    orderBy: { startDate: "asc" },
    include: projectInclude,
  });
  return projects.map((p) => redactMoney(serializeProject(p), access));
}
