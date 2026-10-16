"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InvoiceDetailHeader } from "@/components/invoice-detail-header";
import { InvoiceLinesSection } from "@/components/invoice-lines-section";
import { InvoiceSummary } from "@/components/invoice-summary";
import { InvoiceAddLine } from "@/components/invoice-add-line";
import { InvoiceMetaForm } from "@/components/invoice-meta-form";
import { InvoicePaymentsPanel } from "@/components/invoice-payments-panel";
import { CreditNoteDialog } from "@/components/credit-note-dialog";
import { RegenerateInvoiceDialog } from "@/components/regenerate-invoice-dialog";
import { useInvoice } from "@/hooks/use-invoice";
import { useSettings } from "@/hooks/use-settings";

/** J2b.7 — detail/edit: header, editable lines section (concept
 * only), summary, payments panel, status actions (finaliseren /
 * credit note / verwijderen), link to print (J2b.8). */
export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const { query, patch, regenerate, updateLine, deleteLine } = useInvoice(id);
  const { data: settings } = useSettings();
  const [creditOpen, setCreditOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  const invoice = query.data;
  // Quotes share the Invoice table but have their own pages.
  useEffect(() => {
    if (invoice?.kind === "offerte") router.replace(`/offertes/${invoice.id}`);
  }, [invoice, router]);

  if (query.isLoading) return <p className="text-muted-foreground">Laden...</p>;
  if (!invoice || invoice.kind === "offerte") return <p className="text-muted-foreground">Factuur niet gevonden.</p>;

  const isConcept = invoice.status === "concept";
  const isCreditNote = invoice.kind === "creditnota";
  const ownLineCount = invoice.lines.filter((l) => l.kind === "manual" || l.kind === "text").length;

  return (
    <div className="space-y-6">
      <InvoiceDetailHeader invoice={invoice} onRegenerate={() => setRegenerateOpen(true)} onCredit={() => setCreditOpen(true)} />

      {invoice.isStale && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p className="flex-1">Het project is gewijzigd sinds deze factuur werd opgemaakt. De regels kloppen mogelijk niet meer.</p>
          <Button size="sm" variant="outline" onClick={() => setRegenerateOpen(true)}>Opnieuw genereren</Button>
        </div>
      )}

      <InvoiceLinesSection
        lines={invoice.lines}
        editable={isConcept}
        onUpdateLine={(lineId, values) => updateLine.mutate({ lineId, ...values })}
        onDeleteLine={(lineId) => deleteLine.mutate(lineId)}
      />
      {isConcept && <InvoiceAddLine invoiceId={invoice.id} lines={invoice.lines} />}

      <Separator />
      <InvoiceSummary invoice={invoice} />

      {isConcept && !isCreditNote && (
        <InvoiceMetaForm
          invoice={invoice}
          defaultFooter={settings?.invoiceFooter ?? ""}
          defaultTermDays={Number(settings?.invoicePaymentTermDays) || 30}
          isPending={patch.isPending}
          onSave={(values) => patch.mutate(values)}
        />
      )}

      {!isCreditNote && (
        <>
          <Separator />
          <InvoicePaymentsPanel invoice={invoice} />
        </>
      )}

      <CreditNoteDialog open={creditOpen} onOpenChange={setCreditOpen} invoice={invoice} />
      <RegenerateInvoiceDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        ownLineCount={ownLineCount}
        onConfirm={() => regenerate.mutate()}
      />
    </div>
  );
}
