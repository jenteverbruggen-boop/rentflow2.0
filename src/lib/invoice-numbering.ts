import type { PrismaClient } from "@/generated/prisma/client";

/**
 * J2b.3 (invoice-design.md §2) — a number is allocated only inside the
 * transaction that flips concept → verzonden, via an atomic upsert-
 * increment on InvoiceCounter, never a read-then-write. Safe under
 * Postgres's default READ COMMITTED: the INSERT ... ON CONFLICT ... DO
 * UPDATE takes an implicit row lock on the (series, year) row for the
 * transaction's duration, so a second concurrent finalisation blocks
 * until the first commits (§2.2) — no advisory lock needed here, unlike
 * booking.ts's genuine multi-row check-then-act race.
 */
export async function nextInvoiceSequence(
  tx: PrismaClient,
  series: "invoice" | "credit",
  year: number,
): Promise<number> {
  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "InvoiceCounter" ("series", "year", "lastSeq")
    VALUES (${series}, ${year}, 1)
    ON CONFLICT ("series", "year")
    DO UPDATE SET "lastSeq" = "InvoiceCounter"."lastSeq" + 1
    RETURNING "lastSeq"
  `;
  return rows[0].lastSeq;
}

/**
 * Applies `invoiceNumberFormat` (default `"{year}-{seq:04d}"`) — a
 * credit note always gets `"CN-"` prepended to the same template's
 * output (§2.2 — Q25b names one format setting, not two, so the
 * credit-note prefix is hardcoded rather than independently
 * configurable).
 */
export function formatInvoiceNumber(
  template: string,
  series: "invoice" | "credit",
  year: number,
  seq: number,
): string {
  const body = template
    .replace("{year}", String(year))
    .replace(/\{seq:0(\d+)d\}/, (_, width: string) => String(seq).padStart(Number(width), "0"))
    .replace("{seq}", String(seq));
  return series === "credit" ? `CN-${body}` : body;
}

/** The current Brussels-local calendar year — a draft opened in
 * December and finalised in January gets a January number (§2.1). The
 * server's own OS clock may be UTC regardless of where users are, per
 * this project's Time rule, so this never reads `Date.getFullYear()`
 * directly. */
export function brusselsYear(instant: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Brussels", year: "numeric" }).format(instant),
  );
}
