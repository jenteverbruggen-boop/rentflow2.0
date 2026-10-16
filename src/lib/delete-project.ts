import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

/** The project can't be deleted: invoices or sent quotes still point at it. */
export class ProjectInUseError extends Error {
  constructor() {
    super("Dit project heeft facturen of verzonden offertes en kan niet verwijderd worden");
  }
}

/**
 * Deletes a project. Quotes that were never sent (concept) or were refused are
 * only paperwork and go with it; anything that was sent as an invoice, credit
 * note, or a live/accepted quote is a record the project must not outlive.
 * (An Invoice's project link has no cascade, so this used to surface as a raw
 * 500 from the foreign-key violation.)
 */
export async function deleteProject(projectId: number, client: PrismaClient = defaultPrisma): Promise<void> {
  await client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await txClient.invoice.deleteMany({
      where: { projectId, kind: "offerte", status: { in: ["concept", "geweigerd"] } },
    });
    if ((await txClient.invoice.count({ where: { projectId } })) > 0) throw new ProjectInUseError();
    await txClient.project.delete({ where: { id: projectId } });
  });
}
