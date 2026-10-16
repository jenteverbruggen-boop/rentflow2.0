export type Theme = "light" | "dark";

/** The two themes the UI knows. The default (and what the pre-paint script in
 * layout.tsx falls back to) is dark. */
export const DEFAULT_THEME: Theme = "dark";

export function parseTheme(value: unknown): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}
