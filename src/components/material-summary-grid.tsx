"use client";

import { InlineEditField } from "@/components/inline-edit-field";
import { formatEUR } from "@/lib/pricing";
import type { EditableMaterialField } from "@/hooks/use-material-update";
import type { Material } from "@/types";

interface MaterialSummaryGridProps {
  material: Material;
  onSave: (field: EditableMaterialField, value: string) => Promise<void>;
}

export function MaterialSummaryGrid({ material, onSave }: MaterialSummaryGridProps) {
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
        label="Dagprijs"
        value={material.dayPrice}
        displayValue={formatEUR(material.dayPrice)}
        type="number"
        onSave={(v) => onSave("dayPrice", v)}
      />
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
    </div>
  );
}
