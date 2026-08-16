"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceLinesSection } from "@/components/invoice-lines-section";
import { InvoiceSummary } from "@/components/invoice-summary";
import { InvoicePaymentsPanel } from "@/components/invoice-payments-panel";
import { CreditNoteDialog } from "@/components/credit-note-dialog";
import { useInvoice } from "@/hooks/use-invoice";

/** J2b.7 — detail/edit: header, editable lines section (concept
 * only), summary, payments panel, status actions (finaliseren /
 * credit note / verwijderen), link to print (J2b.8). */
export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const { query, finalize, remove, regenerate, updateLine, deleteLine } = useInvoice(id);
  const [creditOpen, setCreditOpen] = useState(false);

  if (query.isLoading) return <p className="text-muted-foreground">Laden...</p>;
  const invoice = query.data;
  if (!invoice) return <p className="text-muted-foreground">Factuur niet gevonden.</p>;

  const isConcept = invoice.status === "concept";
  const isCreditNote = invoice.kind === "creditnota";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold truncate">{invoice.number ?? `Concept #${invoice.id}`}</h2>
            <InvoiceStatusBadge status={invoice.displayStatus} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{invoice.clientName}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/facturen/${invoice.id}/print`}>
            <Button variant="outline">Afdrukken</Button>
          </Link>
          {isConcept && (
            <>
              <Button variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
                Opnieuw genereren
              </Button>
              <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>Finaliseren</Button>
            </>
          )}
          {!isConcept && !isCreditNote && (
            <Button variant="outline" onClick={() => setCreditOpen(true)}>Creditnota</Button>
          )}
          {isConcept && (
            <Button variant="outline" onClick={() => remove.mutate(undefined, { onSuccess: () => router.push("/facturen") })}>
              Verwijderen
            </Button>
          )}
        </div>
      </div>

      {finalize.isError && <p className="text-sm text-destructive">{finalize.error.message}</p>}
      {regenerate.isError && <p className="text-sm text-destructive">{regenerate.error.message}</p>}

      <InvoiceLinesSection
        lines={invoice.lines}
        editable={isConcept}
        onUpdateLine={(lineId, values) => updateLine.mutate({ lineId, ...values })}
        onDeleteLine={(lineId) => deleteLine.mutate(lineId)}
      />

      <Separator />
      <InvoiceSummary invoice={invoice} />

      {!isCreditNote && (
        <>
          <Separator />
          <InvoicePaymentsPanel invoice={invoice} />
        </>
      )}

      <CreditNoteDialog open={creditOpen} onOpenChange={setCreditOpen} invoice={invoice} />
    </div>
  );
}
