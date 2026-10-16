"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatEUR } from "@/lib/pricing";
import { vatOptions } from "@/lib/invoice-vat-options";
import type { InvoiceLine, InvoiceLineUnit } from "@/types";
import { Pencil, Trash2 } from "lucide-react";

interface Props {
  line: InvoiceLine;
  editable: boolean;
  onUpdate?: (values: { description: string; quantity: number; unitPrice: number; unit?: InvoiceLineUnit; vatRate?: number }) => void;
  onDelete?: () => void;
}

/** J2b.7 — one InvoiceLine row; `editable` toggles inline edit/remove,
 * mirroring how PersonCostRow/MaterialGroupCostRow already embed
 * interactive controls directly in a row component
 * (cost-line-row.tsx). */
export function InvoiceLineRow({ line, editable, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(line.description);
  const [quantity, setQuantity] = useState(String(line.quantity));
  const [unitPrice, setUnitPrice] = useState(String(line.unitPrice));
  const [unit, setUnit] = useState<InvoiceLineUnit>(line.unit);
  const [vatRate, setVatRate] = useState(String(line.vatRate));
  // Unit and VAT are only free on the PO's own lines (the API enforces it);
  // a deduction mirrors an already-invoiced deposit and is not editable at all.
  const isOwn = line.kind === "manual";
  const locked = line.kind === "deduction";

  function save() {
    onUpdate?.({
      description, quantity: Number(quantity), unitPrice: Number(unitPrice),
      ...(isOwn ? { unit, vatRate: Number(vatRate) } : {}),
    });
    setEditing(false);
  }
  function cancel() {
    setDescription(line.description);
    setQuantity(String(line.quantity));
    setUnitPrice(String(line.unitPrice));
    setUnit(line.unit);
    setVatRate(String(line.vatRate));
    setEditing(false);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pl-3 pr-4 text-sm align-middle">
        {editing ? (
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8" />
        ) : (
          <div className="font-medium leading-tight">{line.description}</div>
        )}
      </td>
      <td className="py-2 pr-4 text-right text-sm tabular-nums whitespace-nowrap align-middle">
        {editing ? (
          <div className="flex justify-end gap-1">
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-8 w-16" />
            {isOwn && (
              <Select value={unit} onValueChange={(v) => setUnit(v as InvoiceLineUnit)}>
                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stuk">stuk</SelectItem>
                  <SelectItem value="dag">dag</SelectItem>
                  <SelectItem value="uur">uur</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          `${line.quantity} ${line.unit}`
        )}
      </td>
      <td className="hidden py-2 pr-4 text-right text-sm tabular-nums whitespace-nowrap align-middle sm:table-cell">
        {editing ? (
          <Input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="ml-auto h-8 w-24" />
        ) : (
          formatEUR(line.unitPrice)
        )}
      </td>
      <td className="hidden py-2 pr-3 text-right text-xs text-muted-foreground tabular-nums align-middle sm:table-cell">
        {editing && isOwn ? (
          <Select value={vatRate} onValueChange={setVatRate}>
            <SelectTrigger className="ml-auto h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {vatOptions(line.vatRate).map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
            </SelectContent>
          </Select>
        ) : `${line.vatRate}%`}
      </td>
      <td className="py-2 pr-3 text-right text-sm font-semibold tabular-nums align-middle">
        {formatEUR(editing ? Number(quantity) * Number(unitPrice) : line.lineTotalExcl)}
      </td>
      {editable && (
        <td className="py-2 pr-3 text-right whitespace-nowrap align-middle">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={save}>Opslaan</Button>
              <Button size="sm" variant="ghost" onClick={cancel}>Annuleren</Button>
            </>
          ) : (
            <>
              {!locked && (
                <Button size="sm" variant="ghost" aria-label="Regel bewerken" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" aria-label="Regel verwijderen" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </td>
      )}
    </tr>
  );
}
