"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEUR } from "@/lib/pricing";
import { useInvoicePayments } from "@/hooks/use-invoice-payments";
import type { Invoice } from "@/types";

/** J2b.7 — payments table + "registreer betaling" form + the
 * remainingBalance figure. The form only shows for a sent (non-
 * concept), non-credit-note invoice — the API rejects both cases
 * anyway (J2b.6), this is the affordance. */
export function InvoicePaymentsPanel({ invoice }: { invoice: Invoice }) {
  const { addPayment, deletePayment } = useInvoicePayments(invoice.id);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));

  function submit() {
    addPayment.mutate({ amount: Number(amount), paidAt }, { onSuccess: () => setAmount("") });
  }

  const canPay = invoice.status !== "concept" && invoice.kind !== "creditnota";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Betalingen</h3>
      {invoice.payments.length > 0 && (
        <ul className="text-sm space-y-1">
          {invoice.payments.map((p) => (
            <li key={p.id} className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {new Date(p.paidAt).toLocaleDateString("nl-BE")}
                {p.method ? ` · ${p.method}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatEUR(p.amount)}</span>
                <Button size="sm" variant="ghost" onClick={() => deletePayment.mutate(p.id)}>🗑️</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between text-sm font-medium">
        <span>Openstaand</span>
        <span className="tabular-nums">{formatEUR(invoice.remainingBalance)}</span>
      </div>
      {canPay && (
        <div className="flex gap-2 items-end">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">Bedrag (€)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">Datum</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <Button disabled={addPayment.isPending || !amount} onClick={submit}>Registreer</Button>
        </div>
      )}
      {addPayment.isError && <p className="text-xs text-destructive">{addPayment.error.message}</p>}
    </div>
  );
}
