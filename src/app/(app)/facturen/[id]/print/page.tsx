"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PrintLayout } from "@/components/print/print-layout";
import { DocumentHeader } from "@/components/print/document-header";
import { InvoiceLinesSection } from "@/components/invoice-lines-section";
import { InvoiceSummary } from "@/components/invoice-summary";
import { formatEUR } from "@/lib/pricing";
import { useSettings } from "@/hooks/use-settings";
import type { Invoice } from "@/types";

function fmtDate(d: string) {
  return format(new Date(d), "dd-MM-yyyy", { locale: nl });
}

/**
 * J2b.8 — reuses PrintLayout/DocumentHeader exactly as pakbon/
 * callsheet/kosten do. Ships its own scoped <style> block in the same
 * shape as project-costs-tab.tsx's PRINT_CSS (design doc §8.5) — J3
 * later folds all four into one shared stylesheet, deliberately not
 * blocking this item on that one.
 *
 * B1 — settings now come from the shared useSettings() query (one
 * cached call instead of two independent ones), and both queries gate
 * `isLoading`/`ready` so the print button (and ?autoprint=1) can't fire
 * against a half-loaded document.
 */
export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const autoprint = searchParams.get("autoprint") === "1";
  const printedRef = useRef(false);

  const { data: settings = {}, isLoading: settingsLoading } = useSettings();

  const { data: invoice, isLoading: invoiceLoading } = useQuery<Invoice>({
    queryKey: ["invoice", Number(id)],
    queryFn: () => fetch(`/api/invoices/${id}`).then((r) => r.json()),
  });

  const isLoading = invoiceLoading || settingsLoading;
  const ready = !isLoading && !!invoice;

  useEffect(() => {
    if (autoprint && ready && !printedRef.current) {
      printedRef.current = true;
      window.print();
    }
  }, [autoprint, ready]);

  if (isLoading) return <p className="p-6">Laden...</p>;
  if (!invoice) return <p className="p-6">Factuur niet gevonden</p>;

  return (
    <PrintLayout ready={ready}>
      <div className="p-6 max-w-4xl mx-auto space-y-6 text-sm">
        <DocumentHeader
          company={settings}
          meta={{
            opdrachtgever: invoice.clientName,
            opdrachtgeverAdres:
              [invoice.clientAddress, [invoice.clientPostalCode, invoice.clientCity].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ") || null,
            opdrachtgeverVat: invoice.clientVatNumber,
            factuurnummer: invoice.number ?? `Concept #${invoice.id}`,
            factuurdatum: invoice.invoiceDate ? fmtDate(invoice.invoiceDate) : undefined,
            vervaldatum: invoice.dueDate ? fmtDate(invoice.dueDate) : undefined,
          }}
        />

        <h1 className="text-2xl font-bold">
          {invoice.kind === "creditnota" ? "Creditnota" : "Factuur"}
        </h1>

        <InvoiceLinesSection lines={invoice.lines} editable={false} />
        <InvoiceSummary invoice={invoice} />

        <div className="pt-6 border-t space-y-1 text-xs text-muted-foreground">
          {settings.invoicePaymentTermDays && (
            <p>Betalingstermijn: {settings.invoicePaymentTermDays} dagen</p>
          )}
          {(settings.companyIban || settings.invoiceBankAccountHolder) && (
            <p>
              {[settings.companyIban, settings.invoiceBankAccountHolder].filter(Boolean).join(" — ")}
            </p>
          )}
          {invoice.paymentReference && <p>Gestructureerde mededeling: {invoice.paymentReference}</p>}
          {invoice.remainingBalance > 0 && invoice.status !== "concept" && (
            <p className="font-medium text-foreground">
              Nog te betalen: {formatEUR(invoice.remainingBalance)}
            </p>
          )}
          {settings.invoiceFooter && <p className="pt-2">{settings.invoiceFooter}</p>}
        </div>
      </div>
    </PrintLayout>
  );
}
