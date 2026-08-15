import { MODULES, satisfies } from "@/lib/modules";
import type { PermissionCell } from "@/lib/permission-lockout";
import type { AccessLevel, ModuleKey } from "@/types";

const KOSTEN_ADJACENT: ModuleKey[] = ["kosten_facturen", "gebruikers", "instellingen"];

/**
 * The three recommended defaults (N3.3), keyed by system role KEY, not by
 * arbitrary matching — this action only ever touches the three literal
 * keys ADMIN/PLANNER/VIEWER. Custom roles have no principled default (the
 * PO hasn't named one yet), so they are never touched by "apply
 * recommended defaults" — left for the PO to configure by hand.
 */
export function recommendedLevel(roleKey: string, module: ModuleKey): AccessLevel | null {
  if (roleKey === "ADMIN") return "verwijderen";
  if (roleKey === "VIEWER") return "lezen";
  if (roleKey === "PLANNER") return KOSTEN_ADJACENT.includes(module) ? "geen" : "wijzigen";
  return null;
}

interface RoleLike {
  id: number;
  key: string;
  isSystem: boolean;
}

function heldLevel(permissions: PermissionCell[], roleId: number, module: ModuleKey): AccessLevel {
  return permissions.find((p) => p.roleId === roleId && p.module === module)?.access ?? "geen";
}

/**
 * "Exceeds" the recommendation — not "differs from". A role configured
 * MORE restrictively than the recommended baseline must not trigger the
 * banner. Uses satisfies()'s ordering: held exceeds recommended when held
 * satisfies recommended but isn't equal to it (i.e. held is strictly
 * above).
 */
export function exceedsBaseline(permissions: PermissionCell[], roles: RoleLike[]): boolean {
  for (const role of roles) {
    if (!role.isSystem) continue;
    for (const m of MODULES) {
      const recommended = recommendedLevel(role.key, m.key);
      if (!recommended) continue;
      const held = heldLevel(permissions, role.id, m.key);
      if (held !== recommended && satisfies(held, recommended)) return true;
    }
  }
  return false;
}

export interface DefaultsDiffRow {
  roleLabel: string;
  moduleLabel: string;
  before: AccessLevel;
  after: AccessLevel;
}

/** Every cell that would actually change, for the three system roles only
 * — the exact per-cell before/after table the PO reads before committing
 * to the change (not a prose summary). */
export function diffAgainstRecommended(
  permissions: PermissionCell[],
  roles: (RoleLike & { label: string })[],
): DefaultsDiffRow[] {
  const rows: DefaultsDiffRow[] = [];
  for (const role of roles) {
    if (!role.isSystem) continue;
    for (const m of MODULES) {
      const recommended = recommendedLevel(role.key, m.key);
      if (!recommended) continue;
      const before = heldLevel(permissions, role.id, m.key);
      if (before !== recommended) {
        rows.push({ roleLabel: role.label, moduleLabel: m.label, before, after: recommended });
      }
    }
  }
  return rows;
}

/** The full replacement matrix: recommended defaults for the three system
 * roles, every other role's existing cells untouched — PUT /api/permissions
 * replaces the whole matrix, so custom-role cells must be carried through
 * unchanged rather than dropped. */
export function buildRecommendedMatrix(
  permissions: PermissionCell[],
  roles: RoleLike[],
): PermissionCell[] {
  const systemRoleIds = new Set(roles.filter((r) => r.isSystem).map((r) => r.id));
  const untouched = permissions.filter((p) => !systemRoleIds.has(p.roleId));
  const replaced: PermissionCell[] = [];
  for (const role of roles) {
    if (!role.isSystem) continue;
    for (const m of MODULES) {
      const recommended = recommendedLevel(role.key, m.key);
      if (recommended) replaced.push({ roleId: role.id, module: m.key, access: recommended });
    }
  }
  return [...untouched, ...replaced];
}
