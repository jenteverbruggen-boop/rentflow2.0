"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PrintLayout } from "@/components/print/print-layout";
import { InvoicePrintHeader } from "@/components/print/invoice-print-header";
import { InvoicePaymentBlock } from "@/components/print/invoice-payment-block";
import { InvoiceLinesSection } from "@/components/invoice-lines-section";
import { InvoiceSummary } from "@/components/invoice-summary";
import { useSettings } from "@/hooks/use-settings";
import type { Invoice } from "@/types";

/**
 * J2b.8 — reuses PrintLayout and the shared company block exactly as pakbon/
 * callsheet/kosten do (the shared print stylesheet lives in globals.css).
 *
 * B1 — company settings come from the shared useSettings() query (one cached
 * call), and both queries gate `ready`, so the print button (and
 * ?autoprint=1) can't fire against a half-loaded document.
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
      <div className="p-6 max-w-4xl mx-auto space-y-8 text-sm">
        <InvoicePrintHeader invoice={invoice} company={settings} />
        <InvoiceLinesSection lines={invoice.lines} editable={false} />
        <InvoiceSummary invoice={invoice} />
        <InvoicePaymentBlock invoice={invoice} settings={settings} />
      </div>
    </PrintLayout>
  );
}
