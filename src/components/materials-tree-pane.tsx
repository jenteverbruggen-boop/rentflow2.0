"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Material } from "@/types";

export type MaterialSort = "name-asc" | "name-desc" | "stock-desc";

interface MaterialTreePaneProps {
  materialsByCategory: Array<[string, Material[]]>;
  categories: string[];
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  sort: MaterialSort;
  onSortChange: (value: MaterialSort) => void;
  selectedMaterialId: number | null;
  onSelectMaterial: (id: number) => void;
}

export function MaterialsTreePane({
  materialsByCategory,
  categories,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  selectedMaterialId,
  onSelectMaterial,
}: MaterialTreePaneProps) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenCategories((prev) => {
      const next = { ...prev };
      for (const [cat] of materialsByCategory) {
        if (next[cat] == null) next[cat] = true;
      }
      return next;
    });
  }, [materialsByCategory]);

  function toggleCategory(categoryKey: string) {
    setOpenCategories((prev) => ({ ...prev, [categoryKey]: !prev[categoryKey] }));
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Materialen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Zoeken op naam of categorie..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={category} onValueChange={onCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => onSortChange(v as MaterialSort)}>
              <SelectTrigger>
                <SelectValue placeholder="Sortering" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Naam A-Z</SelectItem>
                <SelectItem value="name-desc">Naam Z-A</SelectItem>
                <SelectItem value="stock-desc">Meeste voorraad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
          {materialsByCategory.map(([cat, items]) => (
            <div key={cat} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="w-full text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                {openCategories[cat] ? "▾" : "▸"} {cat} ({items.length})
              </button>
              {openCategories[cat] && (
                <div className="space-y-1">
                  {items.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectMaterial(m.id)}
                      className={[
                        "w-full text-left rounded-md border px-3 py-2 transition-colors",
                        selectedMaterialId === m.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent",
                      ].join(" ")}
                    >
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">Voorraad: {m.totalStock ?? 0}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {materialsByCategory.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Geen materialen gevonden</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}