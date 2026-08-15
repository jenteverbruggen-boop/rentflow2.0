import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface RoleOption {
  id: number;
  key: string;
  label: string;
  isSystem: boolean;
  scope: "all" | "own";
  _count?: { users: number };
}

async function fetchRoles(): Promise<RoleOption[]> {
  const res = await fetch("/api/roles");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<RoleOption[]>;
}

async function jsonOrThrow(res: Response, fallback: string) {
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error: string }).error ?? fallback);
  return data;
}

export function useRoles() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["roles"] });

  const create = useMutation({
    mutationFn: (values: { key: string; label: string }) =>
      fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then((r) => jsonOrThrow(r, "Aanmaken mislukt")),
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: ({ id, label, scope }: { id: number; label: string; scope: "all" | "own" }) =>
      fetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, scope }),
      }).then((r) => jsonOrThrow(r, "Opslaan mislukt")),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/roles/${id}`, { method: "DELETE" }).then((r) =>
        jsonOrThrow(r, "Verwijderen mislukt"),
      ),
    onSuccess: invalidate,
  });

  return { query, create, rename, remove };
}
