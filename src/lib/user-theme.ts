import { prisma } from "@/lib/prisma";
import { parseTheme, type Theme } from "@/lib/theme";

/** The stored theme of an account; `null` when none was ever saved (or the
 * stored value is not one we know) — the client then keeps its own. */
export async function getUserTheme(userId: number): Promise<Theme | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { theme: true } });
  return parseTheme(user?.theme);
}

/** Remembers the theme on the account (not just in this browser), so a second
 * device or a fresh login starts with the same look. */
export async function setUserTheme(userId: number, theme: Theme): Promise<Theme | null> {
  const updated = await prisma.user.update({ where: { id: userId }, data: { theme }, select: { theme: true } });
  return parseTheme(updated.theme);
}
