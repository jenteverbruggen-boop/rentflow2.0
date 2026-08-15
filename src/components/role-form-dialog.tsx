"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { RoleOption } from "@/hooks/use-roles";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: RoleOption | null;
  onCreate: (values: { key: string; label: string }) => void;
  onRename: (values: { id: number; label: string }) => void;
  isPending: boolean;
  error: string;
}

/** Create/rename dialog for custom roles (N3.1) — key is only entered on
 * create; renaming a role (system or custom) only ever changes its label. */
export function RoleFormDialog({
  open,
  onOpenChange,
  editing,
  onCreate,
  onRename,
  isPending,
  error,
}: Props) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (open) {
      setKey(editing ? editing.key : "");
      setLabel(editing ? editing.label : "");
    }
  }, [open, editing]);

  function submit() {
    if (editing) onRename({ id: editing.id, label });
    else onCreate({ key: key.toUpperCase(), label });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editing ? "Rol hernoemen" : "Nieuwe rol"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!editing && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sleutel (bv. FREELANCER)</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Naam</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button
              type="button"
              disabled={isPending || !label || (!editing && !key)}
              onClick={submit}
            >
              {editing ? "Opslaan" : "Aanmaken"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
