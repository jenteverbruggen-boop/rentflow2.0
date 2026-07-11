"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatEUR } from "@/lib/pricing";
import { InlineEditField } from "@/components/inline-edit-field";
import { MaterialStockList } from "@/components/material-stock-list";
import { MaterialCodes } from "@/components/material-codes";
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

export function MaterialDetailPane({ material, onManageUnits }: MaterialDetailPaneProps) {
  const queryClient = useQueryClient();

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

  async function saveField(field: "dayPrice" | "category" | "code" | "notes", rawValue: string) {
    if (!material) return;
    const value = field === "dayPrice" ? Number(rawValue) : rawValue || null;
    const res = await fetch(`/api/materials/${material.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: material.name,
        category: material.category,
        categoryId: material.categoryId,
        code: material.code,
        notes: material.notes,
        dayPrice: material.dayPrice,
        [field]: value,
      }),
    });
    if (!res.ok) throw new Error("Opslaan mislukt");
    const updated = await res.json();
    queryClient.setQueryData<Material[]>(["materials"], (old) =>
      old?.map((m) => (m.id === material.id ? { ...m, ...updated } : m))
    );
    queryClient.invalidateQueries({ queryKey: ["materials"] });
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <CardTitle>{material.name}</CardTitle>
          <Button size="sm" variant="outline" onClick={onManageUnits}>Beheer units</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InlineEditField
            label="Dagprijs"
            value={material.dayPrice}
            displayValue={formatEUR(material.dayPrice)}
            type="number"
            onSave={(v) => saveField("dayPrice", v)}
          />
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Totale voorraad</p>
            <p className="font-medium">{material.totalStock ?? 0} units</p>
          </div>
        </div>

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

        <div className="space-y-2">
          <p className="text-sm font-semibold">Per item</p>
          <MaterialStockList stockItems={stockItems} />
        </div>
      </CardContent>
    </Card>
  );
}
