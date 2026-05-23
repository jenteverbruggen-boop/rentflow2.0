import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@/types";
import type { CreateUserValues, EditUserValues } from "@/components/user-form";

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<User[]>;
}

export function useUsers() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const create = useMutation({
    mutationFn: (values: CreateUserValues) =>
      fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error((d as { error: string }).error ?? "Aanmaken mislukt");
        return d as User;
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const update = useMutation({
    mutationFn: ({ id, values }: { id: number; values: EditUserValues }) =>
      fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error((d as { error: string }).error ?? "Opslaan mislukt");
        return d as User;
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/users/${id}`, { method: "DELETE" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error((d as { error: string }).error ?? "Verwijderen mislukt");
        return d;
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  return { query, create, update, remove };
}
