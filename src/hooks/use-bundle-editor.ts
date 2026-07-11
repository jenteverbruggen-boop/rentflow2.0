import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Material, MaterialComponent } from "@/types";

async function throwOnError(res: Response) {
  if (!res.ok) throw new Error((await res.json()).error ?? "Mislukt");
}

export function useBundleEditor(materialId: number) {
  const queryClient = useQueryClient();

  const { data: allMaterials = [] } = useQuery<Material[]>({
    queryKey: ["materials"],
    queryFn: () => fetch("/api/materials").then((r) => r.json()),
  });

  const { data: components = [] } = useQuery<MaterialComponent[]>({
    queryKey: ["material-components", materialId],
    queryFn: () =>
      fetch(`/api/materials/${materialId}/components`).then((r) => r.json()),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["material-components", materialId],
    });
    queryClient.invalidateQueries({ queryKey: ["materials"] });
  };

  const addComponent = useMutation({
    mutationFn: async (body: { childId: number; quantity: number }) => {
      await throwOnError(
        await fetch(`/api/materials/${materialId}/components`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    onSuccess: invalidate,
  });

  const updateQuantity = useMutation({
    mutationFn: async (body: { componentId: number; quantity: number }) => {
      await throwOnError(
        await fetch(
          `/api/materials/${materialId}/components/${body.componentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: body.quantity }),
          },
        ),
      );
    },
    onSuccess: invalidate,
  });

  const removeComponent = useMutation({
    mutationFn: (componentId: number) =>
      fetch(`/api/materials/${materialId}/components/${componentId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });

  return { allMaterials, components, addComponent, updateQuantity, removeComponent };
}
