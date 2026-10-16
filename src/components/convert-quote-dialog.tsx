"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { ConvertQuoteValues } from "@/hooks/use-quotes";
import type { DepositType } from "@/types";

type Mode = "full" | "deposit" | "final";

const HINTS: Record<Mode, string> = {
  full: "Eén factuur met alle regels van de offerte, zoals ze er staan.",
  deposit: "Eén regel voor een deel van het offertebedrag. De rest factureer je later als eindfactuur.",
  final: "Alle regels van de offerte, min de reeds verzonden voorschotfacturen.",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  error?: string;
  onConvert: (values: ConvertQuoteValues) => void;
}

/** An accepted quote becomes an invoice draft: in full, as a deposit
 * (percentage or fixed), or as the final invoice after a deposit. */
export function ConvertQuoteDialog({ open, onOpenChange, isPending, error, onConvert }: Props) {
  const [mode, setMode] = useState<Mode>("full");
  const [depositType, setDepositType] = useState<DepositType>("percentage");
  const [depositValue, setDepositValue] = useState("30");

  function submit() {
    onConvert(
      mode === "deposit"
        ? { mode, depositType, depositValue: Number(depositValue) }
        : { mode },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Omzetten naar factuur</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Soort factuur</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Volledige factuur</SelectItem>
                <SelectItem value="deposit">Voorschotfactuur</SelectItem>
                <SelectItem value="final">Eindfactuur</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{HINTS[mode]}</p>
          </div>
          {mode === "deposit" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type voorschot</Label>
                <Select value={depositType} onValueChange={(v) => setDepositType(v as DepositType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Vast bedrag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{depositType === "percentage" ? "Percentage (%)" : "Bedrag excl. BTW (€)"}</Label>
                <Input type="number" step="0.01" min={0} value={depositValue} onChange={(e) => setDepositValue(e.target.value)} />
              </div>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="button" disabled={isPending || (mode === "deposit" && !(Number(depositValue) > 0))} onClick={submit}>
              Factuur aanmaken
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
