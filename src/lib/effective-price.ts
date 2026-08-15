import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";

export type MaterialPriceSource = "project" | "material" | "none";
export type PersonPriceSource =
  | "project"
  | "client"
  | "person-function"
  | "function"
  | "person"
  | "none";

export interface ResolvedPrice<Source extends string> {
  amount: number;
  source: Source;
}

export interface ResolvedPersonPrice extends ResolvedPrice<PersonPriceSource> {
  /** The unit the returned amount is actually denominated in. A level
   * with no hourly equivalent (project override, person.dayPrice) always
   * echoes "dag" regardless of the unit requested — Q19's fallback must
   * be visible to the caller, not silently returned as if it were an
   * hourly figure. */
  unit: "dag" | "uur";
}

/**
 * Material price resolution — unchanged 2-level order (no function
 * concept exists for materials): project override → Material.dayPrice
 * → 0. Returns `{amount, source}` (added in L1.2) so callers can show
 * *why* a figure is what it is, same reasoning as the person resolver.
 */
export async function effectiveMaterialPrice(
  projectId: number,
  materialId: number,
): Promise<ResolvedPrice<MaterialPriceSource>> {
  const override = await prisma.projectMaterialPrice.findUnique({
    where: { projectId_materialId: { projectId, materialId } },
  });
  if (override) return { amount: toNumber(override.dayPrice), source: "project" };
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (material) return { amount: toNumber(material.dayPrice), source: "material" };
  return { amount: 0, source: "none" };
}

/**
 * Person price resolution — the five-level order decided in Q30/Q32b:
 *
 *   ProjectPersonPrice override
 *     → ClientFunctionRate (L3 — populated once its CRUD ships; the
 *       slot is live from this commit, per the phase-2 brief's own
 *       pseudocode)
 *     → PersonFunction rate (per-person override)
 *     → Function default
 *     → Person.dayPrice
 *     → 0
 *
 * `functionId`/`unit` are optional and default to `null`/`"dag"` so the
 * four existing callers (none of which pick a function or a billing
 * unit yet — that's L2/H5) keep getting exactly today's 2-level
 * behavior: with no functionId, levels 2–4 can never match (they all
 * require one), so resolution falls straight from the project override
 * to Person.dayPrice, unchanged.
 */
export async function effectivePersonPrice(
  projectId: number,
  personId: number,
  functionId: number | null = null,
  unit: "dag" | "uur" = "dag",
): Promise<ResolvedPersonPrice> {
  const override = await prisma.projectPersonPrice.findUnique({
    where: { projectId_personId: { projectId, personId } },
  });
  if (override) {
    return { amount: toNumber(override.dayPrice), source: "project", unit: "dag" };
  }

  if (functionId != null) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });
    if (project?.clientId != null) {
      const cfr = await prisma.clientFunctionRate.findUnique({
        where: { clientId_functionId: { clientId: project.clientId, functionId } },
      });
      const rate = unit === "uur" ? cfr?.hourRate : cfr?.dayRate;
      if (rate != null) return { amount: toNumber(rate), source: "client", unit };
    }

    const pf = await prisma.personFunction.findUnique({
      where: { personId_functionId: { personId, functionId } },
    });
    const pfRate = unit === "uur" ? pf?.hourRate : pf?.dayRate;
    if (pfRate != null) return { amount: toNumber(pfRate), source: "person-function", unit };

    const fn = await prisma.function.findUnique({ where: { id: functionId } });
    const fnRate = unit === "uur" ? fn?.hourRate : fn?.dayRate;
    if (fnRate != null) return { amount: toNumber(fnRate), source: "function", unit };
  }

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (person && toNumber(person.dayPrice) > 0) {
    // Person.dayPrice has no hourly counterpart (Q19) — echo "dag" so an
    // "uur" caller falling this far can tell it did not get an hourly
    // number.
    return { amount: toNumber(person.dayPrice), source: "person", unit: "dag" };
  }

  return { amount: 0, source: "none", unit: "dag" };
}
