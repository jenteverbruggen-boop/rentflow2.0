import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AccessLevel, ModuleKey } from "@/types";

export interface PermissionCell {
  roleId: number;
  module: ModuleKey;
  access: AccessLevel;
}

async function fetchPermissions(): Promise<PermissionCell[]> {
  const res = await fetch("/api/permissions");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<PermissionCell[]>;
}

export function usePermissions() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["permissions"], queryFn: fetchPermissions });

  const save = useMutation({
    mutationFn: (permissions: PermissionCell[]) =>
      fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error((data as { error: string }).error ?? "Opslaan mislukt");
        return data;
      }),
    onSuccess: () => {
      // Makes the change visible immediately, no refresh needed — and
      // /api/auth/me's own permissions map depends on the same table.
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });

  return { query, save };
}
