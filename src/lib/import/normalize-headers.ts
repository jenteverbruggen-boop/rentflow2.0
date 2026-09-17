import { normalizeRentmanLocale } from "@/lib/import/rentman-locale";
import { normalizeRentmanClientsLocale } from "@/lib/import/rentman-clients-locale";

/**
 * B4 (round 3 PO feedback) — the single place both import routes
 * (`preview` and `apply`) run every locale translation before format
 * detection, so the two routes can't drift out of sync on which
 * translators run and in which order. Each translator is a no-op on
 * headers it doesn't recognise (see rentman-locale.ts /
 * rentman-clients-locale.ts), and the two never collide — materials'
 * table only matches material-shaped headers, clients' only
 * client-shaped ones — so running both unconditionally on every
 * entity's file is harmless.
 */
export function normalizeImportHeaders(
  headers: string[],
  rows: Record<string, string>[],
): { headers: string[]; rows: Record<string, string>[] } {
  const afterMaterialLocale = normalizeRentmanLocale(headers, rows);
  return normalizeRentmanClientsLocale(afterMaterialLocale.headers, afterMaterialLocale.rows);
}
