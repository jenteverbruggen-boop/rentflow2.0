import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Takes a row lock for the rest of the transaction (Postgres `FOR UPDATE`), so
 * two requests acting on the same invoice, quote or project run one after the
 * other instead of both passing the same "is this still allowed?" check — a
 * double-clicked finalize, convert, correct or accept. A second caller blocks
 * here until the first commits, then re-reads fresh state. SQLite (dev/tests)
 * has a single writer and no row locks, so it is skipped there — the same
 * convention as `lockMaterials` in booking.ts.
 */
export async function lockRow(tx: PrismaClient, table: "Invoice" | "Project", id: number): Promise<void> {
  if ((process.env.DATABASE_URL ?? "").startsWith("file:")) return;
  await tx.$executeRawUnsafe(`SELECT 1 FROM "${table}" WHERE "id" = ${Math.trunc(id)} FOR UPDATE`);
}
