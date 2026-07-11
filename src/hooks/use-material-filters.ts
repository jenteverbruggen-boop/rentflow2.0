import { useMemo } from "react";
import type {
  MaterialSort,
  MaterialTypeFilter,
} from "@/components/materials-filter-bar";
import type { Material } from "@/types";

interface UseMaterialFiltersArgs {
  materials: Material[];
  search: string;
  category: string;
  sort: MaterialSort;
  typeFilter: MaterialTypeFilter;
}

export function useMaterialFilters({
  materials,
  search,
  category,
  sort,
  typeFilter,
}: UseMaterialFiltersArgs) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => {
      const cat = m.categoryRel?.name ?? m.category;
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [materials]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matches = materials.filter((m) => {
      const catName = m.categoryRel?.name ?? m.category;
      if (category !== "all" && catName !== category) return false;
      if (typeFilter === "sets" && !m.isBundle) return false;
      if (typeFilter === "loose" && m.isBundle) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (catName ?? "").toLowerCase().includes(q)
      );
    });

    if (sort === "stock-desc")
      return matches.sort((a, b) => (b.totalStock ?? 0) - (a.totalStock ?? 0));
    if (sort === "name-desc")
      return matches.sort((a, b) => b.name.localeCompare(a.name));
    return matches.sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, search, category, sort, typeFilter]);

  const materialsByCategory = useMemo(() => {
    const grouped = new Map<string, Material[]>();
    for (const material of filtered) {
      const key =
        material.categoryRel?.name ?? material.category ?? "Zonder categorie";
      grouped.set(key, [...(grouped.get(key) ?? []), material]);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return { categories, filtered, materialsByCategory };
}
