"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFunctions } from "@/hooks/use-functions";
import { FunctionFormDialog } from "@/components/function-form-dialog";
import type { Function as Fn } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function formatRate(v: number | null): string {
  return v == null ? "—" : `€${v.toFixed(2)}`;
}

/** L1.3 — the functions management page brought in as a dialog reachable
 * from the People page, since functions only ever matter in the context
 * of crew. Lists name + day/hour rate; create/edit/delete. A rate
 * showing "—" may mean "not set" or "redacted for this caller" (N2.1) —
 * indistinguishable by design, same as every other money field in the
 * app when Kosten/Facturen access is missing. */
export function FunctionsManagerDialog({ open, onOpenChange }: Props) {
  const { query, create, update, remove } = useFunctions();
  const functions = query.data ?? [];

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
    remove.mutate(fn.id, { onError: (err) => setError((err as Error).message) });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Functies</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate}>+ Nieuwe functie</Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Dagtarief</TableHead>
                  <TableHead>Uurtarief</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {functions.map((fn) => (
                  <TableRow key={fn.id}>
                    <TableCell className="font-medium">{fn.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatRate(fn.dayRate)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatRate(fn.hourRate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(fn)}>Bewerken</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(fn)}
                        >
                          Verwijderen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
