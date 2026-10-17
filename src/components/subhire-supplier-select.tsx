"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Supplier } from "@/types";

interface Props {
  value: string;
  onChange: (value: string) => void;
  suppliers: Supplier[];
  /** Edit mode: the hire's current supplier, listed even when archived. */
  current?: { id: number; name: string } | null;
}

/** Active suppliers, plus (when editing) the current one marked
 * "(gearchiveerd)" if it has since been archived. */
export function SubhireSupplierSelect({ value, onChange, suppliers, current }: Props) {
  const missing = current && !suppliers.some((s) => s.id === current.id) ? current : null;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Leverancier</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Kies een leverancier" /></SelectTrigger>
        <SelectContent>
          {missing && <SelectItem value={String(missing.id)}>{missing.name} (gearchiveerd)</SelectItem>}
          {suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {suppliers.length === 0 && !missing && <p className="text-xs text-muted-foreground">Nog geen leveranciers — voeg er een toe via Leveranciers.</p>}
    </div>
  );
}
