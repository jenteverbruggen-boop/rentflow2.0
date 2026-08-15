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
import type { Function as Fn } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Fn | null;
  onSubmit: (values: { name: string; dayRate: number | null; hourRate: number | null }) => void;
  isPending: boolean;
  error: string;
}

/** Create/edit dialog for functions (L1.3) — day and hour rate are both
 * optional company defaults; a function with no hour rate falls back to
 * day billing (Q19, effective-price.ts). */
export function FunctionFormDialog({ open, onOpenChange, editing, onSubmit, isPending, error }: Props) {
  const [name, setName] = useState("");
  const [dayRate, setDayRate] = useState("");
  const [hourRate, setHourRate] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDayRate(editing?.dayRate != null ? String(editing.dayRate) : "");
      setHourRate(editing?.hourRate != null ? String(editing.hourRate) : "");
    }
  }, [open, editing]);

  function submit() {
    onSubmit({
      name,
      dayRate: dayRate === "" ? null : Number(dayRate),
      hourRate: hourRate === "" ? null : Number(hourRate),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editing ? "Functie bewerken" : "Nieuwe functie"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Naam</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Dagtarief (€)</Label>
              <Input type="number" step="0.01" min={0} value={dayRate} onChange={(e) => setDayRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Uurtarief (€)</Label>
              <Input type="number" step="0.01" min={0} value={hourRate} onChange={(e) => setHourRate(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Geen uurtarief? Dan wordt bij uurfacturatie automatisch een volledige dag aangerekend.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="button" disabled={isPending || !name} onClick={submit}>
              {editing ? "Opslaan" : "Aanmaken"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
