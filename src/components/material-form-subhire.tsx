"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useSuppliers } from "@/hooks/use-suppliers";
import { canWriteMoney } from "@/lib/me-access";
import type { SubhireCostBasis } from "@/types";

export interface SubhireFormState {
  only: boolean;
  supplierId: string;
  unitCost: string;
  basis: SubhireCostBasis;
}

export const EMPTY_SUBHIRE: SubhireFormState = { only: false, supplierId: "", unitCost: "", basis: "per_huur" };

/** The POST /api/materials fields for this state (nothing when not inhuur). */
export function subhirePayload(s: SubhireFormState, money: boolean) {
  if (!s.only) return {};
  return {
    subhireOnly: true,
    defaultSupplierId: Number(s.supplierId),
    ...(money ? { subhireCostBasis: s.basis, subhireUnitCost: s.unitCost === "" ? null : Number(s.unitCost) } : {}),
  };
}

interface Props {
  value: SubhireFormState;
  onChange: (next: SubhireFormState) => void;
}

/** "Dit item huur ik altijd in" on the new-material form: a catalogue item you
 * never stock (tentwarmers, plates…). It sits among the normal materials, is
 * priced like any other, and booking it automatically hires it in from the
 * supplier chosen here. */
export function MaterialFormSubhire({ value, onChange }: Props) {
  const { data: me } = useAuthMe();
  const { query } = useSuppliers(false);
  const suppliers = query.data ?? [];
  const money = canWriteMoney(me);
  const set = (patch: Partial<SubhireFormState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-start gap-2">
        <Checkbox id="new-subhire-only" checked={value.only} onCheckedChange={(v) => set({ only: v === true })} />
        <div>
          <Label htmlFor="new-subhire-only" className="font-normal">Enkel inhuur — nooit in eigen voorraad</Label>
          <p className="text-xs text-muted-foreground">Boeken huurt het automatisch in bij de leverancier hieronder.</p>
        </div>
      </div>
      {value.only && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="new-subhire-supplier" className="text-xs">Leverancier *</Label>
            <Select value={value.supplierId} onValueChange={(v) => set({ supplierId: v })}>
              <SelectTrigger id="new-subhire-supplier"><SelectValue placeholder="Kies een leverancier" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            {suppliers.length === 0 && <p className="text-xs text-muted-foreground">Voeg eerst een leverancier toe via Leveranciers.</p>}
          </div>
          {money && (
            <>
              <div className="space-y-1">
                <Label htmlFor="new-subhire-cost" className="text-xs">Inkoopprijs per unit (€)</Label>
                <Input id="new-subhire-cost" type="number" step="0.01" min={0} value={value.unitCost} onChange={(e) => set({ unitCost: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Verrekening leverancier</Label>
                <Select value={value.basis} onValueChange={(v) => set({ basis: v as SubhireCostBasis })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_huur">Per huur (eenmalig)</SelectItem>
                    <SelectItem value="per_dag">Per dag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
