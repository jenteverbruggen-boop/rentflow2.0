import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DepositType, Invoice } from "@/types";

export type ConvertQuoteValues =
  | { mode: "full" | "final" }
  | { mode: "deposit"; depositType: DepositType; depositValue: number };

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Mislukt");
  return data as T;
}

/** The quotes overview (optionally one project's, optionally by status), and
 * creating a draft quote for a project. */
export function useQuotes(filters: { status?: string; projectId?: number } = {}) {
  const queryClient = useQueryClient();
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.projectId != null) params.set("projectId", String(filters.projectId));
  const qs = params.toString();

  const query = useQuery({
    queryKey: ["quotes", filters],
    queryFn: async () => parse<Invoice[]>(await fetch(`/api/quotes${qs ? `?${qs}` : ""}`)),
  });
  const create = useMutation({
    mutationFn: async (projectId: number) =>
      parse<Invoice>(await fetch("/api/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }),
      })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }),
  });
  return { query, create };
}

/** The status moves of one quote: send / reopen / refuse / accept, and
 * converting an accepted quote into an invoice draft. */
export function useQuoteActions(id: number) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
  };
  const post = (action: string, body?: unknown) => async () =>
    parse<Invoice>(await fetch(`/api/quotes/${id}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
    }));

  const send = useMutation({ mutationFn: post("send"), onSuccess: refresh });
  const reopen = useMutation({ mutationFn: post("reopen"), onSuccess: refresh });
  const reject = useMutation({ mutationFn: post("reject"), onSuccess: refresh });
  const accept = useMutation({ mutationFn: post("accept"), onSuccess: refresh });
  const convert = useMutation({
    mutationFn: async (values: ConvertQuoteValues) => post("convert", values)(),
    onSuccess: refresh,
  });
  return { send, reopen, reject, accept, convert };
}
