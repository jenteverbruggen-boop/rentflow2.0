"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRoles, type RoleOption } from "@/hooks/use-roles";
import { RoleFormDialog } from "@/components/role-form-dialog";
import { RoleDeleteDialog } from "@/components/role-delete-dialog";

/** List/create/rename/delete custom roles (N3.1) — a new sibling section
 * on the settings page, not merged into settings-form.tsx (already 163
 * lines, over the limit before this phase touches anything). */
export function RolesManager() {
  const { query, create, rename, remove } = useRoles();
  const roles = query.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleOption | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleOption | null>(null);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  function openCreate() {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }
  function openRename(role: RoleOption) {
    setEditing(role);
    setFormError("");
    setFormOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Rollen</CardTitle>
        <Button size="sm" onClick={openCreate}>+ Nieuwe rol</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Sleutel</TableHead>
              <TableHead>Zichtbaarheid</TableHead>
              <TableHead>Gebruikers</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.label}{" "}
                  {r.isSystem && <Badge variant="secondary" className="ml-1 text-[10px]">systeem</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{r.key}</TableCell>
                <TableCell className="text-xs">
                  {r.scope === "own" ? (
                    <Badge variant="outline">alleen eigen boekingen</Badge>
                  ) : (
                    <span className="text-muted-foreground">volledig</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{r._count?.users ?? 0}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openRename(r)}>
                      Bewerken
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={r.isSystem}
                      title={r.isSystem ? "Systeemrollen kunnen niet verwijderd worden" : undefined}
                      onClick={() => { setDeleteError(""); setDeleteTarget(r); }}
                    >
                      Verwijderen
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        isPending={create.isPending || rename.isPending}
        error={formError}
        onCreate={(values) =>
          create.mutate(values, {
            onSuccess: () => setFormOpen(false),
            onError: (err) => setFormError((err as Error).message),
          })
        }
        onRename={(values) =>
          rename.mutate(values, {
            onSuccess: () => setFormOpen(false),
            onError: (err) => setFormError((err as Error).message),
          })
        }
      />

      <RoleDeleteDialog
        target={deleteTarget}
        isPending={remove.isPending}
        error={deleteError}
        onConfirm={(role) =>
          remove.mutate(role.id, {
            onSuccess: () => setDeleteTarget(null),
            onError: (err) => setDeleteError((err as Error).message),
          })
        }
        onClose={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
