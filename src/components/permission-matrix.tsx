"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MODULES, satisfies } from "@/lib/modules";
import { useRoles } from "@/hooks/use-roles";
import { usePermissions, type PermissionCell } from "@/hooks/use-permissions";
import { useAuthMe } from "@/hooks/use-auth-me";
import { PermissionMatrixRow } from "@/components/permission-matrix-row";
import { PermissionMatrixWarnDialog } from "@/components/permission-matrix-warn-dialog";
import type { AccessLevel, ModuleKey } from "@/types";

type MatrixState = Record<string, AccessLevel>;

function cellKey(roleId: number, module: string) {
  return `${roleId}:${module}`;
}

/** Modules as rows, roles as columns, a four-level select per cell
 * (N3.2). Self-lockout checks and the atomic replace live server-side
 * (PUT /api/permissions); this component's own job is the "would this
 * remove MY access" warning, which needs the current user's own role. */
export function PermissionMatrix() {
  const { query: rolesQuery } = useRoles();
  const roles = rolesQuery.data ?? [];
  const { query: permsQuery, save } = usePermissions();
  const { data: me } = useAuthMe();

  const [matrix, setMatrix] = useState<MatrixState>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!permsQuery.data) return;
    const next: MatrixState = {};
    for (const p of permsQuery.data) next[cellKey(p.roleId, p.module)] = p.access;
    setMatrix(next);
  }, [permsQuery.data]);

  function getAccess(roleId: number, module: ModuleKey): AccessLevel {
    return matrix[cellKey(roleId, module)] ?? "geen";
  }
  function setAccess(roleId: number, module: ModuleKey, access: AccessLevel) {
    setMatrix((prev) => ({ ...prev, [cellKey(roleId, module)]: access }));
  }

  function toCells(): PermissionCell[] {
    const cells: PermissionCell[] = [];
    for (const r of roles) {
      for (const m of MODULES) cells.push({ roleId: r.id, module: m.key, access: getAccess(r.id, m.key) });
    }
    return cells;
  }

  // "Exceeds" the recommendation isn't relevant here (that's N3.3) — this
  // is a plain regression check: did the CURRENT user's own role lose
  // ground on any module compared to what /api/auth/me last reported.
  function ownAccessReduced(): boolean {
    if (!me?.user.roleId) return false;
    return MODULES.some((m) => {
      const before = me.permissions[m.key] ?? "geen";
      const after = getAccess(me.user.roleId!, m.key);
      // after satisfies before <=> after >= before in the level order;
      // false means the save would reduce this module below what the
      // user currently holds.
      return !satisfies(after, before);
    });
  }

  function doSave() {
    setError("");
    save.mutate(toCells(), { onError: (err) => setError((err as Error).message) });
  }

  function handleSaveClick() {
    if (ownAccessReduced()) setConfirmOpen(true);
    else doSave();
  }

  if (roles.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rechtenmatrix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-muted-foreground">Module</th>
                {roles.map((r) => (
                  <th key={r.id} className="py-2 pr-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <PermissionMatrixRow
                  key={m.key}
                  moduleKey={m.key}
                  moduleLabel={m.label}
                  roles={roles}
                  getAccess={getAccess}
                  onChange={setAccess}
                />
              ))}
            </tbody>
          </table>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={handleSaveClick} disabled={save.isPending}>
            {save.isPending ? "Bezig…" : "Matrix opslaan"}
          </Button>
        </div>
      </CardContent>

      <PermissionMatrixWarnDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        isPending={save.isPending}
        onConfirm={() => {
          setConfirmOpen(false);
          doSave();
        }}
      />
    </Card>
  );
}
