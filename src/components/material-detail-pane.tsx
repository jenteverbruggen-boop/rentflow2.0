"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InlineEditField } from "@/components/inline-edit-field";
import { MaterialStockList } from "@/components/material-stock-list";
import { MaterialCodes } from "@/components/material-codes";
import { BundleComponentEditor } from "@/components/bundle-component-editor";
import { BundleStockSummary } from "@/components/bundle-stock-summary";
import { MaterialSummaryGrid } from "@/components/material-summary-grid";
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
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>
              {material.isBundle && "🎁 "}
              {material.name}
            </CardTitle>
            {material.isBundle && (
              <span className="text-xs text-muted-foreground">Set / bundel</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={material.isBundle ? "default" : "outline"}
              onClick={() => saveField("isBundle", String(!material.isBundle))}
            >
              {material.isBundle ? "🎁 Set" : "Markeer als set"}
            </Button>
            {!material.isBundle && (
              <Button size="sm" variant="outline" onClick={onManageUnits}>
                Beheer units
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

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
            <p className="text-sm font-semibold">Per item</p>
            <MaterialStockList stockItems={stockItems} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
