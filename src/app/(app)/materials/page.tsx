"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MaterialForm } from "@/components/material-form";
import { MaterialDetailPane } from "@/components/material-detail-pane";
import {
  MaterialsTreePane,
  type MaterialSort,
  type MaterialTypeFilter,
} from "@/components/materials-tree-pane";
import { StockItemsSheet } from "@/components/stock-items-sheet";
import { CameraScanner } from "@/components/camera-scanner";
import { useMaterials } from "@/hooks/use-materials";
import { useMaterialFilters } from "@/hooks/use-material-filters";
import type { Material } from "@/types";

function MaterialsPageContent() {
  const { query, create } = useMaterials();
  const materials = useMemo(() => query.data ?? [], [query.data]);
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<MaterialSort>("name-asc");
  const [typeFilter, setTypeFilter] = useState<MaterialTypeFilter>("all");
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    const paramId = searchParams.get("materialId");
    if (paramId && materials.length > 0) {
      const id = parseInt(paramId);
      if (materials.some((m) => m.id === id)) setSelectedMaterialId(id);
    }
  }, [searchParams, materials]);

  const { categories, filtered, materialsByCategory } = useMaterialFilters({
    materials,
    search,
    category,
    sort,
    typeFilter,
  });

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId],
  );

  useEffect(() => {
    if (
      selectedMaterialId &&
      materials.some((m) => m.id === selectedMaterialId)
    )
      return;
    setSelectedMaterialId(filtered[0]?.id ?? null);
  }, [selectedMaterialId, materials, filtered]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Materialen</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            📷 Scan
          </Button>
          <Link href="/materials/labels">
            <Button variant="outline">🏷️ Labels</Button>
          </Link>
          <Button onClick={() => setFormOpen(true)}>+ Nieuw materiaal</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4">
        <MaterialsTreePane
          materialsByCategory={materialsByCategory}
          categories={categories}
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          selectedMaterialId={selectedMaterialId}
          onSelectMaterial={setSelectedMaterialId}
        />

        <MaterialDetailPane
          material={selectedMaterial}
          onManageUnits={() => selectedMaterial && setSheetOpen(true)}
        />
      </div>

      <MaterialForm
        open={formOpen}
        onOpenChange={(o) => {
          if (!o) create.reset();
          setFormOpen(o);
        }}
        defaultValues={null}
        onSubmit={(v) =>
          create.mutate(v as Omit<Material, "id">, {
            onSuccess: () => setFormOpen(false),
          })
        }
        isPending={create.isPending}
        error={create.error?.message ?? null}
      />

      <StockItemsSheet
        material={selectedMaterial}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMaterialDeleted={() => setSelectedMaterialId(null)}
      />

      <CameraScanner open={scanOpen} onOpenChange={setScanOpen} />
    </div>
  );
}

export default function MaterialsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Laden...</p>}>
      <MaterialsPageContent />
    </Suspense>
  );
}
