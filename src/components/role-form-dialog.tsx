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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoleOption } from "@/hooks/use-roles";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: RoleOption | null;
  onCreate: (values: { key: string; label: string }) => void;
  onRename: (values: { id: number; label: string; scope: "all" | "own" }) => void;
  isPending: boolean;
  error: string;
}

/** Create/rename dialog for custom roles (N3.1) — key is only entered on
 * create; renaming a role (system or custom) changes its label and scope.
 * Scope (N5.1) is "all" (sees every project) or "own" (own-data-only —
 * see .plans/own-data-scoping-design.md); it's a per-role toggle, not a
 * fifth access level in the permission matrix. New roles default to
 * "all" — a freelancer role is switched to "own" explicitly here after
 * creation, there is no separate create-time scope picker to keep this
 * dialog's two flows (create vs rename) from diverging further. */
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
  const [scope, setScope] = useState<"all" | "own">("all");

  useEffect(() => {
    if (open) {
      setKey(editing ? editing.key : "");
      setLabel(editing ? editing.label : "");
      setScope(editing ? editing.scope : "all");
    }
  }, [open, editing]);

  function submit() {
    if (editing) onRename({ id: editing.id, label, scope });
    else onCreate({ key: key.toUpperCase(), label });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editing ? "Rol bewerken" : "Nieuwe rol"}</DialogTitle>
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
          {editing && (
            <div className="space-y-1.5">
              <Label className="text-xs">Zichtbaarheid</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "all" | "own")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Volledig — ziet alle projecten</SelectItem>
                  <SelectItem value="own">Alleen eigen boekingen (freelancer)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Alleen eigen boekingen: geen bedragen, alleen-lezen, alleen projecten waarop deze gebruiker is geboekt.
              </p>
            </div>
          )}
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
