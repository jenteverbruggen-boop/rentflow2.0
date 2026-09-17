"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@/types";

// B3 — shared between material-form.tsx (create/edit dialog) and
// material-category-field.tsx (detail pane inline editor) so both
// call sites read the same category list and create categories the
// same way, instead of each dialog carrying its own copy.
export function useCategories() {
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
  });

  async function createCategory(name: string) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, prefix: "9999" }),
    });
    const created = (await res.json()) as { id: number };
    await queryClient.invalidateQueries({ queryKey: ["categories"] });
    return created;
  }

  return { categories, createCategory };
}
