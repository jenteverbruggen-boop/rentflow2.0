"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { QuoteDetailHeader } from "@/components/quote-detail-header";
import { InvoiceLinesSection } from "@/components/invoice-lines-section";
import { InvoiceSummary } from "@/components/invoice-summary";
import { InvoiceAddLine } from "@/components/invoice-add-line";
import { InvoiceMetaForm } from "@/components/invoice-meta-form";
import { RegenerateInvoiceDialog } from "@/components/regenerate-invoice-dialog";
import { useInvoice } from "@/hooks/use-invoice";
import { useSettings } from "@/hooks/use-settings";

/** C2 — a quote: the same editable lines, free lines, totals and remarks as a
 * draft invoice, with the quote's own status actions on top. */
export default function QuoteDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(idParam);
  const { query, patch, regenerate, updateLine, deleteLine } = useInvoice(id);
  const { data: settings } = useSettings();
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const quote = query.data;

  // The invoice pages and the quote pages share the Invoice table; send each
  // document to its own page.
  useEffect(() => {
    if (quote && quote.kind !== "offerte") router.replace(`/facturen/${quote.id}`);
  }, [quote, router]);

  if (query.isLoading) return <p className="text-muted-foreground">Laden...</p>;
  if (!quote || quote.kind !== "offerte") return <p className="text-muted-foreground">Offerte niet gevonden.</p>;

  const editable = quote.status === "concept";
  const ownLineCount = quote.lines.filter((l) => l.kind === "manual" || l.kind === "text").length;

  return (
    <div className="space-y-6">
      <QuoteDetailHeader quote={quote} onRegenerate={() => setRegenerateOpen(true)} />

      {quote.isStale && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p className="flex-1">Het project is gewijzigd sinds deze offerte werd opgemaakt. De regels kloppen mogelijk niet meer.</p>
          <Button size="sm" variant="outline" onClick={() => setRegenerateOpen(true)}>Opnieuw genereren</Button>
        </div>
      )}

      <InvoiceLinesSection
        lines={quote.lines}
        editable={editable}
        onUpdateLine={(lineId, values) => updateLine.mutate({ lineId, ...values })}
        onDeleteLine={(lineId) => deleteLine.mutate(lineId)}
      />
      {editable && <InvoiceAddLine invoiceId={quote.id} lines={quote.lines} />}

      <Separator />
      <InvoiceSummary invoice={quote} />

      {editable && (
        <InvoiceMetaForm
          invoice={quote}
          isQuote
          defaultFooter=""
          defaultTermDays={Number(settings?.quoteValidityDays) || 30}
          isPending={patch.isPending}
          onSave={(values) => patch.mutate(values)}
        />
      )}

      <RegenerateInvoiceDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        ownLineCount={ownLineCount}
        onConfirm={() => regenerate.mutate()}
      />
    </div>
  );
}
