"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFunctions } from "@/hooks/use-functions";
import { FunctionFormDialog } from "@/components/function-form-dialog";
import { FunctionManagerTable } from "@/components/function-manager-table";
import type { Function as Fn } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** L1.3 — the functions management page brought in as a dialog reachable
 * from the People page, since functions only ever matter in the context
 * of crew. Lists name + day/hour rate + usage; create/edit, and either
 * "Archiveren" (an in-use function) or "Verwijderen" (a genuinely unused
 * one — function-deletable.ts decides which). Archived functions are
 * hidden by default behind a "Toon gearchiveerde" toggle, where they can
 * be "Hersteld". A rate showing "—" may mean "not set" or "redacted for
 * this caller" (N2.1) — indistinguishable by design, same as every other
 * money field in the app when Kosten/Facturen access is missing. */
export function FunctionsManagerDialog({ open, onOpenChange }: Props) {
  const { query, create, update, remove } = useFunctions();
  const all = query.data ?? [];
  const active = all.filter((f) => !f.archived);
  const archived = all.filter((f) => f.archived);

  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Fn | null>(null);
  const [error, setError] = useState("");

  function openCreate() {
    setEditing(null);
    setError("");
    setFormOpen(true);
  }
  function openEdit(fn: Fn) {
    setEditing(fn);
    setError("");
    setFormOpen(true);
  }
  function handleDelete(fn: Fn) {
    if (!confirm(`Functie "${fn.name}" verwijderen?`)) return;
    setError("");
    remove.mutate(fn.id, { onError: (err) => setError((err as Error).message) });
  }
  function handleArchive(fn: Fn) {
    setError("");
    update.mutate({ id: fn.id, archived: true }, { onError: (err) => setError((err as Error).message) });
  }
  function handleRestore(fn: Fn) {
    setError("");
    update.mutate({ id: fn.id, archived: false }, { onError: (err) => setError((err as Error).message) });
  }

  const rowHandlers = { onEdit: openEdit, onArchive: handleArchive, onRestore: handleRestore, onDelete: handleDelete };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Functies</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate}>+ Nieuwe functie</Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <FunctionManagerTable functions={active} {...rowHandlers} />

          {archived.length > 0 && (
            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Verberg" : "Toon"} gearchiveerde functies ({archived.length})
              </Button>
              {showArchived && (
                <div className="mt-2">
                  <FunctionManagerTable functions={archived} showHeader={false} {...rowHandlers} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FunctionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        isPending={create.isPending || update.isPending}
        error={error}
        onSubmit={(values) =>
          editing
            ? update.mutate(
                { id: editing.id, ...values },
                { onSuccess: () => setFormOpen(false), onError: (err) => setError((err as Error).message) },
              )
            : create.mutate(values, {
                onSuccess: () => setFormOpen(false),
                onError: (err) => setError((err as Error).message),
              })
        }
      />
    </>
  );
}
