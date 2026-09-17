"use client";

import {
  MaterialsFilterBar,
  type MaterialSort,
  type MaterialTypeFilter,
} from "@/components/materials-filter-bar";
import { Button } from "@/components/ui/button";
import { toggleAllInSelection } from "@/lib/label-selection";
import type { Material } from "@/types";

interface LabelMaterialPickerProps {
  materials: Material[]; // already filtered — the visible set
  categories: string[];
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  sort: MaterialSort;
  onSortChange: (value: MaterialSort) => void;
  typeFilter: MaterialTypeFilter;
  onTypeFilterChange: (value: MaterialTypeFilter) => void;
  selectedIds: Set<number>;
  onSelectedIdsChange: (next: Set<number>) => void;
}

export function LabelMaterialPicker({
  materials,
  categories,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  typeFilter,
  onTypeFilterChange,
  selectedIds,
  onSelectedIdsChange,
}: LabelMaterialPickerProps) {
  const visibleIds = materials.map((m) => m.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    onSelectedIdsChange(toggleAllInSelection(selectedIds, visibleIds));
  }

  function toggleMaterial(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  }

  return (
    <div className="space-y-3">
      <MaterialsFilterBar
        categories={categories}
        search={search}
        onSearchChange={onSearchChange}
        category={category}
        onCategoryChange={onCategoryChange}
        sort={sort}
        onSortChange={onSortChange}
        typeFilter={typeFilter}
        onTypeFilterChange={onTypeFilterChange}
      />

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleAll}
          disabled={materials.length === 0}
        >
          {allVisibleSelected ? "Zichtbare deselecteren" : "Alle zichtbare selecteren"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto border rounded-lg p-3">
        {materials.map((m) => (
          <label
            key={m.id}
            className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-accent rounded px-1 py-0.5"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(m.id)}
              onChange={() => toggleMaterial(m.id)}
            />
            <span className="truncate">{m.name}</span>
          </label>
        ))}
        {materials.length === 0 && (
          <p className="col-span-full text-xs text-muted-foreground py-2">
            Geen materialen gevonden voor dit filter.
          </p>
        )}
      </div>
    </div>
  );
}
