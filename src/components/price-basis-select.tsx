"use client";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { PriceBasis } from "@/types";

interface Props {
  value: PriceBasis;
  onChange: (value: PriceBasis) => void;
  id?: string;
}

/** What the client pays: per day or once per rental. */
export function PriceBasisSelect({ value, onChange, id }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PriceBasis)}>
      <SelectTrigger id={id} aria-label="Prijs gerekend per"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="per_dag">per dag</SelectItem>
        <SelectItem value="per_huur">per huur (eenmalig)</SelectItem>
      </SelectContent>
    </Select>
  );
}
