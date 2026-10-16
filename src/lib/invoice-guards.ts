import type { PrismaClient } from "@/generated/prisma/client";
import { assertNoShortages } from "@/lib/material-shortage-db";

/** The project can't be invoiced yet — it still has overbooked material that
 * no one has bought in or hired in. */
export class InvoiceBlockedError extends Error {
  code = "OVERBOOK" as const;
}

/**
 * An invoice may only be generated or sent for a project without open
 * shortages: units that aren't in stock would otherwise sit on the invoice as
 * phantom lines. Applies to regenerate and finalize as well as create — a
 * shortage can appear on a project after its draft was made. Quotes are
 * exempt (they exist precisely to price an overbooked concept project).
 */
export async function assertInvoiceable(projectId: number, client: PrismaClient): Promise<void> {
  try {
    await assertNoShortages(projectId, client);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "OVERBOOK") {
      throw new InvoiceBlockedError((e as Error).message);
    }
    throw e;
  }
}
