import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ClientFunctionRate } from "@/types";

async function jsonOrThrow(res: Response, fallback: string) {
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error: string }).error ?? fallback);
  return data;
}

export interface ClientRateInput {
  functionId: number;
  dayRate?: number | null;
  hourRate?: number | null;
}

/** L3.1 — CRUD for a client's per-function rate card. */
export function useClientRates(clientId: number) {
  const queryClient = useQueryClient();
  const key = ["client-rates", clientId];
  const query = useQuery<ClientFunctionRate[]>({
    queryKey: key,
    queryFn: () =>
      fetch(`/api/clients/${clientId}/rates`).then((r) => jsonOrThrow(r, "Ophalen mislukt")),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (values: ClientRateInput) =>
      fetch(`/api/clients/${clientId}/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then((r) => jsonOrThrow(r, "Aanmaken mislukt")),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ functionId, ...values }: ClientRateInput) =>
      fetch(`/api/clients/${clientId}/rates/${functionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then((r) => jsonOrThrow(r, "Opslaan mislukt")),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (functionId: number) =>
      fetch(`/api/clients/${clientId}/rates/${functionId}`, { method: "DELETE" }).then((r) =>
        jsonOrThrow(r, "Verwijderen mislukt"),
      ),
    onSuccess: invalidate,
  });

  return { query, create, update, remove };
}
