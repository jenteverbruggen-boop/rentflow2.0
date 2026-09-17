import { satisfies } from "@/lib/modules";
import type { AccessLevel, ModuleKey } from "@/types";

export interface PermissionCell {
  roleId: number;
  module: ModuleKey;
  access: AccessLevel;
}

export interface RoleScope {
  id: number;
  scope: "all" | "own";
}

/** Which roles would hold `level` (or better) on `module` under this
 * proposed matrix state — the "join through User.roleId" check (N3.2)
 * counts users among exactly these roles, not RolePermission rows alone.
 *
 * Scope-aware (B2b): `requireModule` (api-auth.ts) unconditionally vetoes
 * any non-`lezen` action for a `scope: "own"` role, regardless of what
 * the matrix says for that role/module. A `scope: "own"` role holding
 * e.g. `verwijderen` on a module is therefore a dead letter for any
 * level above `lezen` — it must never be counted as "coverage" for a
 * self-lockout check, or the last real holder of a delete permission
 * could be an own-scope role, passing validation while creating a real,
 * unrecoverable lockout. */
export function rolesHolding(
  permissions: PermissionCell[],
  roles: RoleScope[],
  module: ModuleKey,
  level: AccessLevel,
): number[] {
  const scopeById = new Map(roles.map((r) => [r.id, r.scope]));
  return permissions
    .filter((p) => p.module === module && satisfies(p.access, level))
    .filter((p) => level === "lezen" || scopeById.get(p.roleId) !== "own")
    .map((p) => p.roleId);
}
