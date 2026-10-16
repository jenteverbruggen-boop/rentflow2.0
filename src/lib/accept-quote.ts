import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { fillShortages, assertNoShortages } from "@/lib/material-shortage-db";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { QuoteError } from "@/lib/quote-error";

/**
 * verzonden → aanvaard, and the project follows: a concept project becomes
 * `bevestigd` (a project that is already further along is left alone — never
 * downgraded). Leaving concept is gated on overbooking exactly like the
 * project status change is (open shortages are first filled from free stock,
 * then refuse); nothing is written when that refuses.
 *
 * Refused when the project is cancelled, or when another quote of the project
 * is already accepted — one accepted quote per project keeps "which quote do I
 * invoice from" unambiguous.
 */
export async function acceptQuote(id: number, client: PrismaClient = defaultPrisma) {
  const quote = await client.invoice.findUnique({ where: { id } });
  if (!quote) throw new QuoteError("NOT_FOUND", "Offerte niet gevonden");
  if (quote.kind !== "offerte") throw new QuoteError("NOT_A_QUOTE", "Dit is geen offerte");
  if (quote.status !== "verzonden") throw new QuoteError("WRONG_STATUS", "Alleen een verzonden offerte kan aanvaard worden");
  if (quote.projectId == null) throw new QuoteError("NOT_FOUND", "Offerte heeft geen project");

  const project = await client.project.findUnique({ where: { id: quote.projectId }, select: { id: true, status: true } });
  if (!project) throw new QuoteError("NOT_FOUND", "Project niet gevonden");
  if (project.status === "geannuleerd") {
    throw new QuoteError("PROJECT_CANCELLED", "Het project is geannuleerd — heropen het project eerst");
  }
  const other = await client.invoice.findFirst({
    where: { projectId: project.id, kind: "offerte", status: "aanvaard", id: { not: id } },
    select: { number: true },
  });
  if (other) {
    throw new QuoteError("ALREADY_ACCEPTED", `Offerte ${other.number ?? ""} is al aanvaard voor dit project`.replace("  ", " "));
  }

  const promote = project.status === "concept";
  if (promote) {
    await fillShortages(project.id, client);
    try {
      await assertNoShortages(project.id, client);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; shortages?: unknown };
      if (err.code === "OVERBOOK") throw new QuoteError("OVERBOOK", err.message ?? "Overboekt materiaal", err.shortages);
      throw e;
    }
  }

  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    if (promote) {
      await txClient.project.update({ where: { id: project.id }, data: { status: "bevestigd" } });
    }
    return txClient.invoice.update({
      where: { id },
      data: { status: "aanvaard", acceptedAt: new Date() },
      include: invoiceInclude,
    });
  });
}
