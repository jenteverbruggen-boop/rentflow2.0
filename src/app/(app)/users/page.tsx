"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserForm } from "@/components/user-form";
import { DeleteUserDialog } from "./delete-user-dialog";
import { useUsers } from "@/hooks/use-users";
import type { User } from "@/types";

export default function UsersPage() {
  const { query, create, update, remove } = useUsers();
  const users = query.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setFormOpen(true);
  }

  function closeForm(v: boolean) {
    setFormOpen(v);
    if (!v) setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gebruikers</h2>
        <Button onClick={openCreate}>+ Nieuwe gebruiker</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Aangemaakt</TableHead>
            <TableHead className="text-right">Acties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                  {u.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(u.createdAt).toLocaleDateString("nl-BE")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                    Bewerken
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(u)}
                  >
                    Verwijderen
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing ? (
        <UserForm
          mode="edit"
          open={formOpen}
          onOpenChange={closeForm}
          defaultValues={editing}
          onSubmit={(values) =>
            update.mutate(
              { id: editing.id, values },
              { onSuccess: () => closeForm(false) }
            )
          }
          isPending={update.isPending}
        />
      ) : (
        <UserForm
          mode="create"
          open={formOpen}
          onOpenChange={setFormOpen}
          onSubmit={(values) =>
            create.mutate(values, { onSuccess: () => setFormOpen(false) })
          }
          isPending={create.isPending}
        />
      )}

      <DeleteUserDialog
        target={deleteTarget}
        isPending={remove.isPending}
        onConfirm={(u) => remove.mutate(u.id, { onSuccess: () => setDeleteTarget(null) })}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
