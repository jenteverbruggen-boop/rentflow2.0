import { useMemo, useState } from "react";
import { MODULES } from "@/lib/modules";
import type { PermissionCell } from "@/hooks/use-permissions";
import type { RoleOption } from "@/hooks/use-roles";
import type { AccessLevel, ModuleKey } from "@/types";

export type MatrixState = Record<string, AccessLevel>;

export function cellKey(roleId: number, module: string) {
  return `${roleId}:${module}`;
}

/**
 * Server state and pending edits are kept as two separate maps (B2a — a
 * background refetch used to overwrite local state wholesale on every
 * new `permsQuery.data` reference, silently discarding unsaved toggles
 * after e.g. `refetchOnWindowFocus`). `server` is *derived* from the
 * query data, never copied into local state; `dirty` only ever grows via
 * explicit user edits and is cleared only by `clearDirty()` (called once
 * a save actually lands in the server cache — see `usePermissions`).
 */
export function useMatrixState(serverData: PermissionCell[] | undefined) {
  const [dirty, setDirty] = useState<MatrixState>({});

  const server = useMemo<MatrixState>(() => {
    const next: MatrixState = {};
    for (const p of serverData ?? []) next[cellKey(p.roleId, p.module)] = p.access;
    return next;
  }, [serverData]);

  function getAccess(roleId: number, module: ModuleKey): AccessLevel {
    const key = cellKey(roleId, module);
    return dirty[key] ?? server[key] ?? "geen";
  }

  function setAccess(roleId: number, module: ModuleKey, access: AccessLevel) {
    setDirty((prev) => ({ ...prev, [cellKey(roleId, module)]: access }));
  }

  function toCells(roles: RoleOption[]): PermissionCell[] {
    const cells: PermissionCell[] = [];
    for (const r of roles) {
      for (const m of MODULES) cells.push({ roleId: r.id, module: m.key, access: getAccess(r.id, m.key) });
    }
    return cells;
  }

  return {
    getAccess,
    setAccess,
    toCells,
    isDirty: Object.keys(dirty).length > 0,
    clearDirty: () => setDirty({}),
  };
}
