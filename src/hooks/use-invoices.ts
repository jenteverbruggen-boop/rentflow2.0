import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Invoice, InvoiceRole, DepositType } from "@/types";

export interface InvoiceFilters {
  status?: string;
  clientId?: number;
  projectId?: number;
  kind?: string;
}

export interface CreateInvoiceValues {
  projectId: number;
  invoiceRole: InvoiceRole;
  depositType?: DepositType;
  depositValue?: number;
}

async function throwOnError(res: Response): Promise<void> {
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Mislukt");
  }
}

function buildQuery(filters: InvoiceFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.clientId != null) params.set("clientId", String(filters.clientId));
  if (filters.projectId != null) params.set("projectId", String(filters.projectId));
  if (filters.kind) params.set("kind", filters.kind);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** J2b.7 — the overview list (any filter combination) and creating a
 * new draft. Project-scoped callers (project-invoices-list.tsx) pass
 * `{ projectId }`; the facturen overview page passes status/kind. */
export function useInvoices(filters: InvoiceFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["invoices", filters],
    queryFn: async (): Promise<Invoice[]> => {
      const res = await fetch(`/api/invoices${buildQuery(filters)}`);
      await throwOnError(res);
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async (values: CreateInvoiceValues): Promise<Invoice> => {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      await throwOnError(res);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  return { query, create };
}
