import { satisfies } from "@/lib/modules";
import type { AccessLevel, ModuleKey } from "@/types";

export interface PermissionCell {
  roleId: number;
  module: ModuleKey;
  access: AccessLevel;
}

/** Which roles would hold `level` (or better) on `module` under this
 * proposed matrix state — the "join through User.roleId" check (N3.2)
 * counts users among exactly these roles, not RolePermission rows alone. */
export function rolesHolding(
  permissions: PermissionCell[],
  module: ModuleKey,
  level: AccessLevel,
): number[] {
  return permissions
    .filter((p) => p.module === module && satisfies(p.access, level))
    .map((p) => p.roleId);
}
