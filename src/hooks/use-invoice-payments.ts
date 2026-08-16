import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Payment } from "@/types";

export interface PaymentValues {
  amount: number;
  paidAt: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
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

/** J2b.7 — split from use-invoice.ts to keep both files under the
 * 150-line limit. Every mutation invalidates the same ["invoice", id]
 * key so the payments panel and the summary's remainingBalance/
 * displayStatus stay in sync after a payment auto-flips the status. */
export function useInvoicePayments(invoiceId: number) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });

  const addPayment = useMutation({
    mutationFn: async (values: PaymentValues) =>
      parseJson<Payment>(
        await fetch(`/api/invoices/${invoiceId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }),
      ),
    onSuccess: invalidate,
  });

  const updatePayment = useMutation({
    mutationFn: async ({ paymentId, ...values }: { paymentId: number } & Partial<PaymentValues>) =>
      parseJson<Payment>(
        await fetch(`/api/invoices/${invoiceId}/payments/${paymentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }),
      ),
    onSuccess: invalidate,
  });

  const deletePayment = useMutation({
    mutationFn: async (paymentId: number) =>
      throwOnError(await fetch(`/api/invoices/${invoiceId}/payments/${paymentId}`, { method: "DELETE" })),
    onSuccess: invalidate,
  });

  return { addPayment, updatePayment, deletePayment };
}
