import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Invoice, InvoiceLine, InvoiceLineUnit } from "@/types";

export interface ManualLineValues {
  description: string;
  quantity: number;
  unit: InvoiceLineUnit;
  unitPrice: number;
  vatRate?: number;
  section?: string | null;
}

async function throwOnError(res: Response): Promise<void> {
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Mislukt");
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  await throwOnError(res);
  return res.json();
}

/**
 * J2b.7 — one invoice's full detail-page surface: the query plus every
 * mutation that operates on this specific invoice (metadata, lines,
 * lifecycle). Payment mutations live in use-invoice-payments.ts to
 * keep this file under the 150-line limit.
 */
export function useInvoice(id: number) {
  const queryClient = useQueryClient();
  const key = ["invoice", id];
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Invoice> => parseJson(await fetch(`/api/invoices/${id}`)),
  });

  const patch = useMutation({
    mutationFn: async (values: { notes?: string | null; footer?: string | null; dueDate?: string | null }) =>
      parseJson<Invoice>(
        await fetch(`/api/invoices/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }),
      ),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () => throwOnError(await fetch(`/api/invoices/${id}`, { method: "DELETE" })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const addLine = useMutation({
    mutationFn: async (values: ManualLineValues) =>
      parseJson<InvoiceLine>(
        await fetch(`/api/invoices/${id}/lines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }),
      ),
    onSuccess: invalidate,
  });

  const updateLine = useMutation({
    mutationFn: async ({ lineId, ...values }: { lineId: number } & Partial<ManualLineValues>) =>
      parseJson<InvoiceLine>(
        await fetch(`/api/invoices/${id}/lines/${lineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }),
      ),
    onSuccess: invalidate,
  });

  const deleteLine = useMutation({
    mutationFn: async (lineId: number) =>
      throwOnError(await fetch(`/api/invoices/${id}/lines/${lineId}`, { method: "DELETE" })),
    onSuccess: invalidate,
  });

  const regenerate = useMutation({
    mutationFn: async () => parseJson<Invoice>(await fetch(`/api/invoices/${id}/regenerate`, { method: "POST" })),
    onSuccess: invalidate,
  });

  const finalize = useMutation({
    mutationFn: async () => parseJson<Invoice>(await fetch(`/api/invoices/${id}/finalize`, { method: "POST" })),
    onSuccess: invalidate,
  });

  const creditNote = useMutation({
    mutationFn: async (lines?: { lineId: number; quantity?: number }[]) =>
      parseJson<Invoice>(
        await fetch(`/api/invoices/${id}/credit-note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines }),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  return { query, patch, remove, addLine, updateLine, deleteLine, regenerate, finalize, creditNote };
}
