"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type MaterialSort = "name-asc" | "name-desc" | "stock-desc";
export type MaterialTypeFilter = "all" | "sets" | "loose";

const TYPE_OPTIONS: { value: MaterialTypeFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "sets", label: "🎁 Sets" },
  { value: "loose", label: "Losse" },
];

interface MaterialsFilterBarProps {
  categories: string[];
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  sort: MaterialSort;
  onSortChange: (value: MaterialSort) => void;
  typeFilter: MaterialTypeFilter;
  onTypeFilterChange: (value: MaterialTypeFilter) => void;
}

export function MaterialsFilterBar({
  categories,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  typeFilter,
  onTypeFilterChange,
}: MaterialsFilterBarProps) {
  return (
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
      <div className="flex gap-1">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onTypeFilterChange(opt.value)}
            className={cn(
              "flex-1 rounded-md border px-2 py-2 text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              typeFilter === opt.value
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
