"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InlineEditField } from "@/components/inline-edit-field";
import { MaterialStockList } from "@/components/material-stock-list";
import { MaterialCodes } from "@/components/material-codes";
import { BundleComponentEditor } from "@/components/bundle-component-editor";
import { BundleStockSummary } from "@/components/bundle-stock-summary";
import { MaterialSummaryGrid } from "@/components/material-summary-grid";
import { MaterialDetailHeader } from "@/components/material-detail-header";
import { useMaterialUpdate } from "@/hooks/use-material-update";
import type { Material, StockItem } from "@/types";

interface MaterialDetailPaneProps {
  material: Material | null;
  onManageUnits: () => void;
}

async function fetchStockItems(materialId: number): Promise<StockItem[]> {
  const res = await fetch(`/api/materials/${materialId}/stock-items`);
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<StockItem[]>;
}

export function MaterialDetailPane({
  material,
  onManageUnits,
}: MaterialDetailPaneProps) {
  const saveField = useMaterialUpdate(material);

  const { data: stockItems = [] } = useQuery({
    queryKey: ["material", material?.id, "stock-items"],
    queryFn: () => fetchStockItems(material!.id),
    enabled: !!material,
  });

  if (!material) {
    return (
      <Card className="h-full">
        <CardContent className="h-full py-20 text-center text-sm text-muted-foreground">
          Selecteer links een materiaal om details te bekijken.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <MaterialDetailHeader
        material={material}
        onToggleBundle={() => saveField("isBundle", String(!material.isBundle))}
        onManageUnits={onManageUnits}
      />

      <CardContent className="space-y-4">
        <MaterialSummaryGrid material={material} onSave={saveField} />

        <InlineEditField
          label="Artikelcode"
          value={material.code}
          displayValue={material.code ?? "TEMP"}
          onSave={(v) => saveField("code", v)}
        />

        <InlineEditField
          label="Categorie"
          value={material.category}
          onSave={(v) => saveField("category", v)}
        />

        <InlineEditField
          label="Notities"
          value={material.notes}
          onSave={(v) => saveField("notes", v)}
        />

        <Separator />

        <MaterialCodes material={material} />

        <Separator />

        {material.isBundle ? (
          <div className="space-y-4">
            {material.bundleStock && (
              <BundleStockSummary bundleStock={material.bundleStock} />
            )}
            <BundleComponentEditor key={material.id} material={material} />
          </div>
        ) : (
          <div className="space-y-2">
            {material.usedInSets && material.usedInSets.length > 0 && (
              <div className="rounded-md border border-border p-3 text-xs space-y-1">
                <p className="font-semibold">🔗 Gedeeld — zit in {material.usedInSets.length} {material.usedInSets.length === 1 ? "set" : "sets"}</p>
                {material.usedInSets.map((s) => (
                  <p key={s.id} className="text-muted-foreground">{s.name} (×{s.quantity})</p>
                ))}
              </div>
            )}
            <p className="text-sm font-semibold">Per item</p>
            <MaterialStockList stockItems={stockItems} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
