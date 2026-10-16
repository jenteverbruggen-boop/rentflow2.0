"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { InlineEditField } from "@/components/inline-edit-field";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useSuppliers } from "@/hooks/use-suppliers";
import { formatEUR } from "@/lib/pricing";
import { canSeeMoney } from "@/lib/me-access";
import type { EditableMaterialField } from "@/hooks/use-material-update";
import type { Material } from "@/types";

const NONE = "__none__";

interface Props {
  material: Material;
  onSave: (field: EditableMaterialField, value: string) => Promise<void>;
}

/** "Inhuur" on a material: who it is hired from when you run out, what that
 * costs, and whether it is an item you never stock at all. The supplier's
 * price is purchase cost, so it only shows for a caller who may see money. */
export function MaterialSubhireSection({ material, onSave }: Props) {
  const { data: me } = useAuthMe();
  const { query } = useSuppliers(false);
  const suppliers = query.data ?? [];
  const money = canSeeMoney(me);

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-xs font-semibold">Inhuur</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Standaardleverancier</Label>
          <Select value={material.defaultSupplierId == null ? NONE : String(material.defaultSupplierId)}
            onValueChange={(v) => onSave("defaultSupplierId", v === NONE ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Geen</SelectItem>
              {suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {money && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verrekening leverancier</Label>
            <Select value={material.subhireCostBasis ?? "per_huur"} onValueChange={(v) => onSave("subhireCostBasis", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_huur">Per huur (eenmalig)</SelectItem>
                <SelectItem value="per_dag">Per dag</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {money && (
          <InlineEditField
            label="Inkoopprijs inhuur (per unit)"
            value={material.subhireUnitCost ?? null}
            displayValue={material.subhireUnitCost != null ? formatEUR(material.subhireUnitCost) : "—"}
            type="number"
            onSave={(v) => onSave("subhireUnitCost", v)}
          />
        )}
        <div className="flex items-center gap-2 self-end pb-2">
          <Checkbox id={`subhire-only-${material.id}`} checked={!!material.subhireOnly}
            onCheckedChange={(v) => onSave("subhireOnly", String(v === true))} />
          <Label htmlFor={`subhire-only-${material.id}`} className="font-normal">Enkel inhuur (nooit in eigen stock)</Label>
        </div>
      </div>
    </div>
  );
}
