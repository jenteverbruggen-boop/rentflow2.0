"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEUR } from "@/lib/pricing";
import { useInvoice } from "@/hooks/use-invoice";
import type { Invoice } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice;
}

/** J2b.7 — full-vs-partial line selection; posts
 * /api/invoices/:id/credit-note and redirects to the new draft credit
 * note. */
export function CreditNoteDialog({ open, onOpenChange, invoice }: Props) {
  const router = useRouter();
  const { creditNote } = useInvoice(invoice.id);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [selected, setSelected] = useState<Record<number, number>>({});

  function toggle(lineId: number, quantity: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (lineId in next) delete next[lineId];
      else next[lineId] = quantity;
      return next;
    });
  }

  function submit() {
    const lines =
      mode === "partial"
        ? Object.entries(selected).map(([lineId, quantity]) => ({ lineId: Number(lineId), quantity }))
        : undefined;
    creditNote.mutate(lines, {
      onSuccess: (cn) => {
        onOpenChange(false);
        router.push(`/facturen/${cn.id}`);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Creditnota aanmaken</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" variant={mode === "full" ? "default" : "outline"} size="sm" onClick={() => setMode("full")}>
              Volledig
            </Button>
            <Button type="button" variant={mode === "partial" ? "default" : "outline"} size="sm" onClick={() => setMode("partial")}>
              Gedeeltelijk
            </Button>
          </div>
          {mode === "partial" && (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {invoice.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={line.id in selected} onChange={() => toggle(line.id, line.quantity)} />
                  <span className="flex-1 min-w-0 truncate">{line.description}</span>
                  <Input
                    type="number"
                    className="h-7 w-20"
                    max={line.quantity}
                    disabled={!(line.id in selected)}
                    value={selected[line.id] ?? line.quantity}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [line.id]: Number(e.target.value) }))}
                  />
                  <span className="text-muted-foreground w-20 text-right shrink-0">{formatEUR(line.lineTotalExcl)}</span>
                </li>
              ))}
            </ul>
          )}
          {creditNote.isError && <p className="text-xs text-destructive">{creditNote.error.message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button
              type="button"
              disabled={creditNote.isPending || (mode === "partial" && Object.keys(selected).length === 0)}
              onClick={submit}
            >
              Creditnota aanmaken
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
