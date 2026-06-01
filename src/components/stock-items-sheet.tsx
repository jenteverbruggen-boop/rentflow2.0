"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StockItemForm } from "@/components/stock-item-form";
import { MaterialForm } from "@/components/material-form";
import { formatEUR } from "@/lib/pricing";
import type { Material, StockItem } from "@/types";

interface Props {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialDeleted: () => void;
}

async function fetchStockItems(materialId: number): Promise<StockItem[]> {
  const res = await fetch(`/api/materials/${materialId}/stock-items`);
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export function StockItemsSheet({ material, open, onOpenChange, onMaterialDeleted }: Props) {
  const queryClient = useQueryClient();
  const [stockFormOpen, setStockFormOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const stockKey = ["material", material?.id, "stock-items"] as const;

  const { data: stockItems = [] } = useQuery({
    queryKey: stockKey,
    queryFn: () => fetchStockItems(material!.id),
    enabled: !!material,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["materials"] });
    queryClient.invalidateQueries({ queryKey: stockKey });
  };

  const upsertStock = useMutation({
    mutationFn: async (values: { identifier?: string; notes?: string }) => {
      const url = editingStock
        ? `/api/stock-items/${editingStock.id}`
        : `/api/materials/${material!.id}/stock-items`;
      const res = await fetch(url, {
        method: editingStock ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
    },
    onSuccess: () => { setStockFormOpen(false); setEditingStock(null); invalidateAll(); },
  });

  const deleteStock = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/stock-items/${id}`, { method: "DELETE" });
      if (res.status === 409) throw new Error("Unit is geboekt en kan niet verwijderd worden.");
      if (!res.ok) throw new Error("Verwijderen mislukt");
    },
    onSuccess: () => { setDeleteError(""); invalidateAll(); },
    onError: (err) => setDeleteError((err as Error).message),
  });

  const updateMaterial = useMutation({
    mutationFn: async (values: Omit<Material, "id">) => {
      const res = await fetch(`/api/materials/${material!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      setMaterialFormOpen(false);
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: async () => {
      await fetch(`/api/materials/${material!.id}`, { method: "DELETE" });
    },
    onSuccess: () => { onOpenChange(false); onMaterialDeleted(); queryClient.invalidateQueries({ queryKey: ["materials"] }); },
  });

  if (!material) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{material.name}</SheetTitle>
          </SheetHeader>

          <div className="space-y-1 text-sm mb-3">
            {material.category && <Badge variant="secondary">{material.category}</Badge>}
            <p className="text-muted-foreground">Dagprijs: <span className="font-medium text-foreground">{formatEUR(material.dayPrice)}</span></p>
            {material.notes && <p className="text-muted-foreground">{material.notes}</p>}
          </div>

          <div className="flex gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={() => setMaterialFormOpen(true)}>✏️ Bewerken</Button>
            <Button size="sm" variant="destructive" onClick={() => {
              if (confirm(`Materiaal "${material.name}" verwijderen?`)) deleteMaterial.mutate();
            }}>🗑️ Verwijderen</Button>
          </div>

          <Separator className="mb-4" />

          {deleteError && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Units ({stockItems.length})</h3>
            <Button size="sm" variant="outline" onClick={() => { setEditingStock(null); setStockFormOpen(true); }}>
              + Unit toevoegen
            </Button>
          </div>

          <div className="space-y-2">
            {stockItems.map((si) => (
              <div key={si.id} className="flex items-start gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">#{si.unitNumber} {si.identifier ? `· ${si.identifier}` : ""}</p>
                  {si.notes && <p className="text-xs text-muted-foreground mt-0.5">{si.notes}</p>}
                  {!si.identifier && !si.notes && <p className="text-xs text-muted-foreground">—</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setEditingStock(si); setStockFormOpen(true); }}>✏️</Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-destructive" onClick={() => {
                  if (confirm(`Unit #${si.unitNumber} verwijderen?`)) deleteStock.mutate(si.id);
                }}>🗑️</Button>
              </div>
            ))}
            {stockItems.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Geen units aangemaakt</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <StockItemForm
        open={stockFormOpen}
        onOpenChange={setStockFormOpen}
        defaultValues={editingStock}
        onSubmit={(v) => upsertStock.mutate(v)}
        isPending={upsertStock.isPending}
      />

      <MaterialForm
        open={materialFormOpen}
        onOpenChange={setMaterialFormOpen}
        defaultValues={material}
        onSubmit={(v) => updateMaterial.mutate(v as Omit<Material, "id">)}
        isPending={updateMaterial.isPending}
      />
    </>
  );
}
