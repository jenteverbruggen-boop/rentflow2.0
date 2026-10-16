"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { useInvoice } from "@/hooks/use-invoice";
import type { Invoice } from "@/types";

interface Props {
  invoice: Invoice;
  onRegenerate: () => void;
  onCredit: () => void;
}

/** Title, client line and the status actions of one invoice: finalise /
 * regenerate / refresh client / delete while it is a draft, a credit note
 * once it is sent. */
export function InvoiceDetailHeader({ invoice, onRegenerate, onCredit }: Props) {
  const router = useRouter();
  const { finalize, remove, regenerate, refreshClient } = useInvoice(invoice.id);
  const isConcept = invoice.status === "concept";
  const isCreditNote = invoice.kind === "creditnota";
  const error = [finalize, regenerate, refreshClient].find((m) => m.isError)?.error?.message;

  return (
    <>
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold truncate">{invoice.number ?? `Concept #${invoice.id}`}</h2>
            <InvoiceStatusBadge status={invoice.displayStatus} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{invoice.clientName}</p>
          {isCreditNote && invoice.creditNoteOfNumber && (
            <p className="text-xs text-muted-foreground">Creditnota bij factuur {invoice.creditNoteOfNumber}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/facturen/${invoice.id}/print?autoprint=1`}>
            <Button variant="outline">Afdrukken</Button>
          </Link>
          {isConcept && !isCreditNote && (
            <>
              <Button variant="outline" onClick={onRegenerate} disabled={regenerate.isPending}>Opnieuw genereren</Button>
              {invoice.projectId && (
                <Button variant="outline" onClick={() => refreshClient.mutate()} disabled={refreshClient.isPending}>
                  Klantgegevens verversen
                </Button>
              )}
            </>
          )}
          {isConcept && <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>Finaliseren</Button>}
          {!isConcept && !isCreditNote && <Button variant="outline" onClick={onCredit}>Creditnota</Button>}
          {isConcept && (
            <Button variant="outline" onClick={() => remove.mutate(undefined, { onSuccess: () => router.push("/facturen") })}>
              Verwijderen
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
