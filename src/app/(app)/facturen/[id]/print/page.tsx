"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PrintLayout } from "@/components/print/print-layout";
import { DocumentHeader } from "@/components/print/document-header";
import { InvoiceLinesSection } from "@/components/invoice-lines-section";
import { InvoiceSummary } from "@/components/invoice-summary";
import { formatEUR } from "@/lib/pricing";
import type { Invoice } from "@/types";

interface InvoiceSettings {
  invoicePaymentTermDays?: string;
  invoiceBankAccountHolder?: string;
  invoiceFooter?: string;
  companyIban?: string;
}

function fmtDate(d: string) {
  return format(new Date(d), "dd-MM-yyyy", { locale: nl });
}

/**
 * J2b.8 — reuses PrintLayout/DocumentHeader exactly as pakbon/
 * callsheet/kosten do. Ships its own scoped <style> block in the same
 * shape as project-costs-tab.tsx's PRINT_CSS (design doc §8.5) — J3
 * later folds all four into one shared stylesheet, deliberately not
 * blocking this item on that one.
 */
export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [settings, setSettings] = useState<InvoiceSettings>({});

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings).catch(() => {});
  }, []);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", Number(id)],
    queryFn: () => fetch(`/api/invoices/${id}`).then((r) => r.json()),
  });

  if (isLoading) return <p className="p-6">Laden...</p>;
  if (!invoice) return <p className="p-6">Factuur niet gevonden</p>;

  return (
    <PrintLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 text-sm">
        <DocumentHeader
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
