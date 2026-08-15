import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Function as Fn } from "@/types";

async function fetchFunctions(): Promise<Fn[]> {
  const res = await fetch("/api/functions");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<Fn[]>;
}

async function jsonOrThrow(res: Response, fallback: string) {
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error: string }).error ?? fallback);
  return data;
}

export interface FunctionRateInput {
  name: string;
  dayRate?: number | null;
  hourRate?: number | null;
}

/** L1.3 — manage functions (name + company-default day/hour rate) from
 * the person page's "Functies" dialog, mirroring use-roles.ts's shape. */
export function useFunctions() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["functions"], queryFn: fetchFunctions });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["functions"] });

  const create = useMutation({
    mutationFn: (values: FunctionRateInput) =>
      fetch("/api/functions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then((r) => jsonOrThrow(r, "Aanmaken mislukt")),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...values }: FunctionRateInput & { id: number }) =>
      fetch(`/api/functions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then((r) => jsonOrThrow(r, "Opslaan mislukt")),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/functions/${id}`, { method: "DELETE" }).then((r) =>
        jsonOrThrow(r, "Verwijderen mislukt"),
      ),
    onSuccess: invalidate,
  });

  return { query, create, update, remove };
}
