"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEUR } from "@/lib/pricing";
import type { InvoiceLine } from "@/types";

interface Props {
  line: InvoiceLine;
  editable: boolean;
  onUpdate?: (values: { description: string; quantity: number; unitPrice: number }) => void;
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

  function save() {
    onUpdate?.({ description, quantity: Number(quantity), unitPrice: Number(unitPrice) });
    setEditing(false);
  }
  function cancel() {
    setDescription(line.description);
    setQuantity(String(line.quantity));
    setUnitPrice(String(line.unitPrice));
    setEditing(false);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pl-3 pr-4 text-sm align-middle">
        {editing ? (
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8" />
        ) : (
          <>
            <div className="font-medium leading-tight">{line.description}</div>
            {line.section && <div className="text-muted-foreground text-[11px] leading-tight">{line.section}</div>}
          </>
        )}
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap align-middle">
        {editing ? (
          <div className="flex gap-1">
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-8 w-16" />
            <Input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="h-8 w-24" />
          </div>
        ) : (
          `${line.quantity} ${line.unit} × ${formatEUR(line.unitPrice)}`
        )}
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground tabular-nums align-middle">{line.vatRate}%</td>
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
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>✏️</Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>🗑️</Button>
            </>
          )}
        </td>
      )}
    </tr>
  );
}
