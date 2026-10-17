import type { PrismaClient } from "@/generated/prisma/client";
import { nextCode } from "@/lib/material-code";

/** The next free article code for a category (`0501-003`), or null when the
 * category is unknown or has no free code left. Shared by POST /api/materials
 * and the ad-hoc inhuur item so both number the same way. */
export async function nextCodeForCategory(client: PrismaClient, categoryId: number | null | undefined): Promise<string | null> {
  if (!categoryId) return null;
  const cat = await client.category.findUnique({ where: { id: categoryId } });
  if (!cat) return null;
  const existing = await client.material.findMany({ where: { code: { not: null } }, select: { code: true } });
  try {
    return nextCode(cat.prefix, existing.map((m) => m.code as string));
  } catch {
    return null;
  }
}
