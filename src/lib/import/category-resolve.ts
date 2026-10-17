import type { PrismaClient } from "@/generated/prisma/client";

/**
 * M1.4 — resolves (and, if missing, creates) the Category row a parsed
 * row's folder maps to. A row with no folder at all gets no category
 * relation — its raw `category` string still lands on the material for
 * display, same as manual entry today.
 */
export async function resolveCategoryId(
  tx: PrismaClient,
  categoryCache: Map<string, number>,
  categoryName: string | null,
  categoryPrefix: string | null,
): Promise<number | null> {
  if (!categoryName || !categoryPrefix) return null;
  const cached = categoryCache.get(categoryName);
  if (cached != null) return cached;
  const existing = await tx.category.findUnique({ where: { name: categoryName } });
  if (existing) {
    categoryCache.set(categoryName, existing.id);
    return existing.id;
  }
  const created = await tx.category.create({
    data: { name: categoryName, prefix: categoryPrefix },
  });
  categoryCache.set(categoryName, created.id);
  return created.id;
}
