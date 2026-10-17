"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SubhireSupplierSelect } from "@/components/subhire-supplier-select";
import { costsForSupplierChange } from "@/lib/subhire-supplier-change";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useSubhire } from "@/hooks/use-subhire";
import { canWriteMoney } from "@/lib/me-access";
import type { SubhireCostBasis } from "@/types";

export interface SubhireTarget {
  mode: "hire" | "edit";
  periodId: number;
  shortageId: number;
  materialName: string;
  /** Units on this row (hire: how many can be hired in). */
  quantity: number;
  supplierId: number | null;
  supplierName?: string;
  /** The material's own hire defaults, to prefill on a supplier change. */
  defaults?: { defaultSupplierId?: number | null; subhireUnitCost?: number | null; subhireCostBasis?: SubhireCostBasis };
  basis: SubhireCostBasis;
  unitCost: number | null;
  costOverride: number | null;
}

interface Props {
  projectId: number;
  target: SubhireTarget | null;
  onClose: () => void;
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Hire (some of) an overbooked row in from a supplier, or change an existing
 * hire. Supplier and quantity are for everyone; what the supplier charges is
 * purchase cost, so those fields only exist for a caller who may see money
 * (everyone else gets the material's defaults, applied server-side). */
export function SubhireDialog({ projectId, target, onClose }: Props) {
  const { data: me } = useAuthMe();
  const money = canWriteMoney(me);
  const { query } = useSuppliers(false, !!target);
  const { hire, update } = useSubhire(projectId);
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [basis, setBasis] = useState<SubhireCostBasis>("per_huur");
  const [unitCost, setUnitCost] = useState("");
  const [override, setOverride] = useState("");

  useEffect(() => {
    if (!target) return;
    setSupplierId(target.supplierId == null ? "" : String(target.supplierId));
    setQuantity(String(target.quantity));
    setBasis(target.basis);
    setUnitCost(target.unitCost == null ? "" : String(target.unitCost));
    setOverride(target.costOverride == null ? "" : String(target.costOverride));
  }, [target]);

  if (!target) return null;
  const mutation = target.mode === "hire" ? hire : update;
  const costs = money ? { basis, unitCost: num(unitCost), costOverride: num(override) } : {};

  /** Edit mode: a price belongs to one supplier, so a change prefills the
   * material default (its default supplier) or clears the price. */
  function changeSupplier(value: string) {
    setSupplierId(value);
    if (target?.mode !== "edit" || Number(value) === target.supplierId) return;
    const next = costsForSupplierChange(Number(value), target.defaults ?? {}, { basis });
    setBasis(next.basis);
    setUnitCost(next.unitCost == null ? "" : String(next.unitCost));
    setOverride("");
  }

  function submit() {
    if (!target) return;
    const base = { periodId: target.periodId, shortageId: target.shortageId };
    const done = { onSuccess: onClose };
    if (target.mode === "hire") {
      hire.mutate({ ...base, values: { supplierId: Number(supplierId), quantity: Number(quantity), ...costs } }, done);
    } else {
      update.mutate({ ...base, values: { supplierId: Number(supplierId), ...costs } }, done);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{target.mode === "hire" ? "Inhuren" : "Inhuur wijzigen"} — {target.materialName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <SubhireSupplierSelect
            value={supplierId}
            onChange={changeSupplier}
            suppliers={query.data ?? []}
            current={target.mode === "edit" && target.supplierId != null ? { id: target.supplierId, name: target.supplierName ?? "Huidige leverancier" } : null}
          />
          {target.mode === "hire" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Aantal in te huren (max. {target.quantity})</Label>
              <Input type="number" min={1} max={target.quantity} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          )}
          {money && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Verrekening</Label>
                <Select value={basis} onValueChange={(v) => setBasis(v as SubhireCostBasis)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_huur">Per huur (eenmalig)</SelectItem>
                    <SelectItem value="per_dag">Per dag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Inkoopprijs per unit (€)</Label>
                <Input type="number" step="0.01" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Vast totaalbedrag (€, optioneel — wint van prijs × aantal)</Label>
                <Input type="number" step="0.01" min={0} value={override} onChange={(e) => setOverride(e.target.value)} placeholder="bv. met korting of transport" />
              </div>
            </div>
          )}
          {mutation.isError && <p className="text-xs text-destructive">{mutation.error.message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuleren</Button>
            <Button type="button" disabled={mutation.isPending || !supplierId} onClick={submit}>
              {target.mode === "hire" ? "Inhuren" : "Opslaan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
