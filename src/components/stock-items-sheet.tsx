"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StockItemForm } from "@/components/stock-item-form";
import { StockItemRow } from "@/components/stock-item-row";
import { StockBulkControls } from "@/components/stock-bulk-controls";
import { StockSelectionBar } from "@/components/stock-selection-bar";
import { StockSheetHeader } from "@/components/stock-sheet-header";
import { MaterialForm } from "@/components/material-form";
import { useStockBulk } from "@/hooks/use-stock-bulk";
import { useStockItemsSheet } from "@/hooks/use-stock-items-sheet";
import type { Material } from "@/types";

interface Props {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialDeleted: () => void;
}

export function StockItemsSheet({ material, open, onOpenChange, onMaterialDeleted }: Props) {
  const [stockFormOpen, setStockFormOpen] = useState(false);
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const {
    stockItems,
    editingStock,
    setEditingStock,
    deleteError,
    upsertStock,
    deleteStock,
    updateMaterial,
    deleteMaterial,
  } = useStockItemsSheet(material, onMaterialDeleted, onOpenChange);

  const { bulkRemove } = useStockBulk(material?.id);

  useEffect(() => setSelectedIds([]), [material?.id]);

  if (!material) return null;

  const freeIds = stockItems.filter((si) => (si.assignments?.length ?? 0) === 0).map((si) => si.id);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <StockSheetHeader material={material} onEdit={() => setMaterialFormOpen(true)} onDelete={() => deleteMaterial.mutate()} />

          {deleteError && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <StockBulkControls materialId={material.id} units={stockItems} />

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Units ({stockItems.length})</h3>
            <Button size="sm" variant="outline" onClick={() => { setEditingStock(null); setStockFormOpen(true); }}>
              + Unit toevoegen
            </Button>
          </div>

          <StockSelectionBar
            units={stockItems}
            selectedIds={selectedIds}
            onSelectAllFree={() => setSelectedIds(freeIds)}
            onClear={() => setSelectedIds([])}
            isPending={bulkRemove.isPending}
            onRemoveSelection={() => bulkRemove.mutate({ ids: selectedIds }, { onSuccess: () => setSelectedIds([]) })}
          />

          <div className="space-y-2">
            {stockItems.map((si) => (
              <StockItemRow
                key={si.id}
                item={si}
                selected={selectedIds.includes(si.id)}
                onToggleSelect={(checked) =>
                  setSelectedIds((prev) => (checked ? [...prev, si.id] : prev.filter((id) => id !== si.id)))
                }
                onEdit={() => { setEditingStock(si); setStockFormOpen(true); }}
                onDelete={() => {
                  if (confirm(`Unit #${si.unitNumber} verwijderen?`)) deleteStock.mutate(si.id);
                }}
              />
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
        onSubmit={(v) => upsertStock.mutate(v, { onSuccess: () => setStockFormOpen(false) })}
        isPending={upsertStock.isPending}
      />

      <MaterialForm
        open={materialFormOpen}
        onOpenChange={setMaterialFormOpen}
        defaultValues={material}
        onSubmit={(v) => updateMaterial.mutate(v as Omit<Material, "id">, { onSuccess: () => setMaterialFormOpen(false) })}
        isPending={updateMaterial.isPending}
      />
    </>
  );
}
