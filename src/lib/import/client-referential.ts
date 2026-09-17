import type { PrismaClient } from "@/generated/prisma/client";
import type { BlockingReference } from "@/lib/import/pipeline-types";

/**
 * Extracted out of adapters/client.ts to stay under the project's
 * 150-line file limit — the referential-integrity check for "replace"
 * mode is unrelated to B4's parse/match-key work, so it lives on its
 * own. Project.clientId is SET NULL (design doc §7.4) — the DB will not
 * refuse this delete, so this app-level check is the only protection,
 * not a backstop to a DB error.
 */
export async function clientReferentialChecks(client: PrismaClient, ids: number[]): Promise<Map<number, BlockingReference[]>> {
  const map = new Map<number, BlockingReference[]>();
  if (ids.length === 0) return map;
  const projects = await client.project.groupBy({ by: ["clientId"], where: { clientId: { in: ids } }, _count: true });
  const invoices = await client.invoice.groupBy({ by: ["clientId"], where: { clientId: { in: ids } }, _count: true });
  for (const id of ids) {
    const blocks: BlockingReference[] = [];
    const projectCount = projects.find((p) => p.clientId === id)?._count as number | undefined;
    if (projectCount) blocks.push({ relation: "Project (projecten)", count: projectCount });
    const invoiceCount = invoices.find((i) => i.clientId === id)?._count as number | undefined;
    if (invoiceCount) blocks.push({ relation: "Invoice (facturen)", count: invoiceCount });
    if (blocks.length > 0) map.set(id, blocks);
  }
  return map;
}
