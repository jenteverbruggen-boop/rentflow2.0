import { z } from "zod";
import type { AccessLevel, ModuleKey } from "@/types";

/**
 * The module registry — the single source of truth for what a "module" is.
 * The DB (Role/RolePermission, N1.2) only stores *who* may do *what*; the
 * set of modules itself lives in code, per the decided design.
 *
 * All ten modules are declared now, even the two with no route file yet
 * (Cijfers ships in phase 3) — the rollout decision (C1) requires the
 * matrix to cover every module from day one, or phase 3 needs a second
 * schema-adjacent change just to add a column.
 */
export const MODULES: { key: ModuleKey; label: string }[] = [
  { key: "projecten", label: "Projecten" },
  { key: "planning", label: "Planning" },
  { key: "personen", label: "Personen" },
  { key: "materialen", label: "Materialen" },
  { key: "klanten", label: "Klanten" },
  { key: "locaties", label: "Locaties" },
  { key: "kosten_facturen", label: "Kosten/Facturen" },
  { key: "cijfers", label: "Cijfers" },
  { key: "gebruikers", label: "Gebruikers" },
  { key: "instellingen", label: "Instellingen" },
];

export const moduleKeySchema = z.enum([
  "projecten",
  "planning",
  "personen",
  "materialen",
  "klanten",
  "locaties",
  "kosten_facturen",
  "cijfers",
  "gebruikers",
  "instellingen",
]);

export const accessLevelSchema = z.enum([
  "geen",
  "lezen",
  "wijzigen",
  "verwijderen",
]);

// Total order, not set membership: verwijderen > wijzigen > lezen > geen.
const LEVEL_ORDER: Record<AccessLevel, number> = {
  geen: 0,
  lezen: 1,
  wijzigen: 2,
  verwijderen: 3,
};

/**
 * Does `held` satisfy `required`? Each level satisfies itself and every
 * level strictly below it — `verwijderen` satisfies `wijzigen`/`lezen`/
 * `geen`; `geen` satisfies only `geen`. This must never throw: a call like
 * `satisfies(x, "geen")` is a degenerate case nothing should make, but
 * nothing should crash on either.
 */
export function satisfies(held: AccessLevel, required: AccessLevel): boolean {
  return LEVEL_ORDER[held] >= LEVEL_ORDER[required];
}
