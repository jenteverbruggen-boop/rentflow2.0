import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Material } from "@/types";

type CreateMaterialValues = Omit<Material, "id">;

async function fetchMaterials(): Promise<Material[]> {
  const res = await fetch("/api/materials");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<Material[]>;
}

export function useMaterials() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const create = useMutation({
    mutationFn: async (values: CreateMaterialValues) => {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Aanmaken mislukt");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["materials"] }),
  });

  return { query, create };
}