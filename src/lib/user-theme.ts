import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, parseTheme, type Theme } from "@/lib/theme";

/** The stored theme of an account; anything unexpected reads as the default. */
export async function getUserTheme(userId: number): Promise<Theme> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { theme: true } });
  return parseTheme(user?.theme) ?? DEFAULT_THEME;
}

/** Remembers the theme on the account (not just in this browser), so a second
 * device or a fresh login starts with the same look. */
export async function setUserTheme(userId: number, theme: Theme): Promise<Theme> {
  const updated = await prisma.user.update({ where: { id: userId }, data: { theme }, select: { theme: true } });
  return parseTheme(updated.theme) ?? DEFAULT_THEME;
}
