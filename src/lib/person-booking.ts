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
  role: string | null;
  functionId: number | null;
  dayPriceSnapshot: number;
  discountPct: number | null;
  discountAmount: number | null;
  from: Date;
  to: Date;
  excludePeriodId: number;
  sameProjectId: number;
  client?: PrismaClient;
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
    if (check.blockingProject) {
      const err = new Error(
        `${args.personName} staat al ingepland op project "${check.blockingProject.name}" tijdens deze periode`,
      ) as Error & { code: string };
      err.code = "BLOCKED";
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
        role: args.role,
        functionId: args.functionId,
        dayPriceSnapshot: args.dayPriceSnapshot,
        discountPct: args.discountPct,
        discountAmount: args.discountAmount,
      },
      include: { person: true, function: true },
    });

    return { assignment, warnings };
  });
}
