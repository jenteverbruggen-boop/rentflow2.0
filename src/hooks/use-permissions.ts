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
  // refetchOnWindowFocus is disabled for THIS query only (not the global
  // default in query-provider.tsx, which other screens rely on) — a
  // matrix edit session routinely outlives the 30s staleTime, and an
  // alt-tab-triggered background refetch must not race unsaved edits
  // back onto the screen (B2a).
  const query = useQuery({
    queryKey: ["permissions"],
    queryFn: fetchPermissions,
    refetchOnWindowFocus: false,
  });

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
    onSuccess: (_data, permissions) => {
      // Seed the cache with exactly what was saved so the UI reflects it
      // instantly (no flicker back to the pre-save value while the
      // revalidating refetch below is in flight) — /api/auth/me's own
      // permissions map depends on the same table, so it still needs a
      // real refetch.
      queryClient.setQueryData(["permissions"], permissions);
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });

  return { query, save };
}
