export type Theme = "light" | "dark";

/** The two themes the UI knows. What the pre-paint script in layout.tsx falls
 * back to, when neither the account nor the browser has a choice, is dark. */
export const DEFAULT_THEME: Theme = "dark";

export function parseTheme(value: unknown): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}
