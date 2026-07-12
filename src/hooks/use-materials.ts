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
      if (!res.ok) {
        // Surface validation messages (4xx) verbatim; keep server faults (5xx)
        // friendly — the raw Prisma error is logged server-side, not shown here.
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          res.status < 500 && data?.error
            ? data.error
            : "Aanmaken mislukt — er ging iets mis. Probeer het opnieuw.",
        );
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["materials"] }),
  });

  return { query, create };
}