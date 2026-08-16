import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { checkPersonAvailability } from "@/lib/availability";

/**
 * H1.2 — mirrors booking.ts's lockMaterials() with its own advisory-lock
 * key namespace (1234568, materials use 1234567) so a person-booking
 * transaction never collides with a material-booking one. No-ops on
 * SQLite (dev) — the advisory-lock re-check is a Postgres-only
 * guarantee, same as the materials path.
 */
export async function lockPeople(tx: PrismaClient, personIds: number[]): Promise<void> {
  if ((process.env.DATABASE_URL ?? "").startsWith("file:")) return;
  const sorted = [...new Set(personIds)].sort((a, b) => a - b);
  for (const id of sorted) {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(1234568, ${id})`);
  }
}

interface BookPersonArgs {
  periodId: number;
  personId: number;
  personName: string;
  functionId: number | null;
  dayPriceSnapshot: number;
  /** H5.2 — the unit actually resolved by effectivePersonPrice (never
   * trust the client's requested unit directly; Q19 can fall it back
   * to "dag"), and the rate charged at that unit, snapshotted for
   * billing. `rateSnapshot` stays null on a "dag" booking — day billing
   * reads dayPriceSnapshot directly (H5.1). */
  billingUnit: "dag" | "uur";
  rateSnapshot: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  from: Date;
  to: Date;
  excludePeriodId: number;
  sameProjectId: number;
  /** H2.1 — the client can only pass this after already having seen the
   * BLOCKED conflict once and asked the user to confirm it; the API
   * still refuses without it, this flag is never trusted on its own. */
  allowOverlap?: boolean;
  client?: PrismaClient;
}

export interface BlockedError extends Error {
  code: "BLOCKED";
  blockingProject: { id: number; name: string; from: Date; to: Date };
}

/**
 * H1.2 — the check-then-create sequence in periods/[id]/people/route.ts
 * had no transaction and no P2002 catch (a lost race surfaced as a raw
 * 500), unlike the material path. Wraps the duplicate-assignment check,
 * the availability re-check, and the create in one transaction, with
 * the availability re-check re-run *inside* against the same `tx` —
 * mirroring booking.ts's bookFlatMaterial(). Throws an
 * `Error & { code }` the route maps to conflict(), same convention as
 * the material path's `UNAVAIL`/`P2002` handling.
 */
export async function bookPersonAssignment(args: BookPersonArgs) {
  const client = args.client ?? defaultPrisma;

  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await lockPeople(txClient, [args.personId]);

    const existing = await txClient.periodPerson.findUnique({
      where: { periodId_personId: { periodId: args.periodId, personId: args.personId } },
    });
    if (existing) {
      const err = new Error(
        `${args.personName} staat al toegewezen aan deze periode`,
      ) as Error & { code: string };
      err.code = "DUPLICATE";
      throw err;
    }

    const check = await checkPersonAvailability(
      args.personId,
      { from: args.from, to: args.to, excludePeriodId: args.excludePeriodId, sameProjectId: args.sameProjectId },
      txClient,
    );
    if (check.blockingProject && !args.allowOverlap) {
      const err = new Error(
        `${args.personName} staat al ingepland op project "${check.blockingProject.name}" tijdens deze periode`,
      ) as BlockedError;
      err.code = "BLOCKED";
      err.blockingProject = check.blockingProject;
      throw err;
    }

    const warnings: string[] = [];
    if (check.sameProjectWarning) {
      warnings.push(`${args.personName} staat ook in een andere periode van dit project`);
    }

    const assignment = await txClient.periodPerson.create({
      data: {
        periodId: args.periodId,
        personId: args.personId,
        functionId: args.functionId,
        billingUnit: args.billingUnit,
        dayPriceSnapshot: args.dayPriceSnapshot,
        rateSnapshot: args.rateSnapshot,
        discountPct: args.discountPct,
        discountAmount: args.discountAmount,
        // H2.1 — only ever true when the caller explicitly confirmed a
        // real conflict; never set when there was nothing to override.
        overlapAck: !!(check.blockingProject && args.allowOverlap),
      },
      include: { person: true, function: true },
    });

    return { assignment, warnings };
  });
}
