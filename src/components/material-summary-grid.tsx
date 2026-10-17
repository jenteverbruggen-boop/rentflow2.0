"use client";

import { InlineEditField } from "@/components/inline-edit-field";
import { PriceBasisSelect } from "@/components/price-basis-select";
import { useAuthMe } from "@/hooks/use-auth-me";
import { canWriteMoney } from "@/lib/me-access";
import { formatEUR } from "@/lib/pricing";
import type { EditableMaterialField } from "@/hooks/use-material-update";
import type { Material } from "@/types";

interface MaterialSummaryGridProps {
  material: Material;
  onSave: (field: EditableMaterialField, value: string) => Promise<void>;
}

export function MaterialSummaryGrid({ material, onSave }: MaterialSummaryGridProps) {
  const { data: me } = useAuthMe();
  const writeMoney = canWriteMoney(me);
  if (material.isBundle) {
    return (
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Setprijs {material.bundlePriceOverride == null && "(automatisch)"}
          </p>
          <p className="font-medium">{formatEUR(material.setPrice ?? 0)}/d</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">Complete sets</p>
          <p className="font-medium">
            {material.bundleStock?.completeSets ?? 0} sets
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <InlineEditField
        label={material.priceBasis === "per_huur" ? "Prijs (per huur)" : "Prijs (per dag)"}
        value={material.dayPrice}
        displayValue={formatEUR(material.dayPrice)}
        type="number"
        onSave={(v) => onSave("dayPrice", v)}
      />
      <div className="space-y-1 rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground">Prijs gerekend per</p>
        {writeMoney ? (
          <PriceBasisSelect value={material.priceBasis ?? "per_dag"} onChange={(v) => onSave("priceBasis", v)} />
        ) : (
          <p className="font-medium">{material.priceBasis === "per_huur" ? "per huur (eenmalig)" : "per dag"}</p>
        )}
      </div>
      <div className="rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground">Totale voorraad</p>
        <p className="font-medium">{material.totalStock ?? 0} units</p>
      </div>
      <InlineEditField
        label="Op-/afbouwkosten (per unit)"
        value={material.setupCost}
        displayValue={material.setupCost != null ? formatEUR(material.setupCost) : "—"}
        type="number"
        onSave={(v) => onSave("setupCost", v)}
      />
      <InlineEditField
        label="Aankoopprijs (per unit)"
        value={material.costPrice}
        displayValue={material.costPrice != null ? formatEUR(material.costPrice) : "—"}
        type="number"
        onSave={(v) => onSave("costPrice", v)}
      />
      <InlineEditField
        label="Al terugverdiend (vóór RentFlow)"
        value={material.revenueBefore}
        displayValue={material.revenueBefore != null ? formatEUR(material.revenueBefore) : "—"}
        type="number"
        onSave={(v) => onSave("revenueBefore", v)}
      />
    </div>
  );
}
