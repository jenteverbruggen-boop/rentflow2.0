import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Supplier } from "@/types";

export type SupplierValues = Omit<Supplier, "id" | "archived"> & { archived?: boolean };

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Mislukt");
  return data as T;
}

/** Suppliers (the companies material is hired in from). Archived ones are
 * left out unless asked for — they stay on historic hires but drop out of the
 * pickers. */
export function useSuppliers(includeArchived = false, enabled = true) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["suppliers"] });

  const query = useQuery({
    queryKey: ["suppliers", includeArchived],
    enabled,
    queryFn: async () => parse<Supplier[]>(await fetch(`/api/suppliers${includeArchived ? "?includeArchived=true" : ""}`)),
  });
  const save = useMutation({
    mutationFn: async ({ id, values }: { id?: number; values: Partial<SupplierValues> }) =>
      parse<Supplier>(await fetch(id ? `/api/suppliers/${id}` : "/api/suppliers", {
        method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      })),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => parse(await fetch(`/api/suppliers/${id}`, { method: "DELETE" })),
    onSuccess: invalidate,
  });
  return { query, save, remove };
}
