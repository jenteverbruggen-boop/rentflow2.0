"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddInvoiceLineDialog } from "@/components/add-invoice-line-dialog";
import { useInvoice } from "@/hooks/use-invoice";
import { useSettings } from "@/hooks/use-settings";
import type { InvoiceLine } from "@/types";

/** C8 — "Regel toevoegen" under a draft's lines. The default VAT comes from
 * the BTW setting; the period sections already on the invoice are offered
 * as places to put the line. */
export function InvoiceAddLine({ invoiceId, lines }: { invoiceId: number; lines: InvoiceLine[] }) {
  const [open, setOpen] = useState(false);
  const { addLine } = useInvoice(invoiceId);
  const { data: settings } = useSettings();
  const sections = [...new Set(lines.map((l) => l.section).filter((s): s is string => !!s))];

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" aria-hidden /> Regel toevoegen
      </Button>
      <AddInvoiceLineDialog
        open={open}
        onOpenChange={setOpen}
        sections={sections}
        defaultVatRate={Number(settings?.btwRate) || 21}
        isPending={addLine.isPending}
        error={addLine.isError ? addLine.error.message : undefined}
        onSubmit={(values) => addLine.mutate(values, { onSuccess: () => setOpen(false) })}
      />
    </>
  );
}
