"use client";

import { useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CostSummary } from "@/components/cost-summary";
import { CostPeriodSection } from "@/components/cost-period-section";
import { CreateInvoiceDialog } from "@/components/create-invoice-dialog";
import { ProjectInvoicesList } from "@/components/project-invoices-list";
import type { Project } from "@/types";

interface Props {
  project: Project;
}

function fmtDate(d: string) {
  return format(new Date(d), "d MMM yyyy", { locale: nl });
}

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 1.5cm; }
  html, body { background: white !important; height: auto !important; overflow: visible !important; }
  body * { visibility: hidden; }
  .print-root, .print-root * { visibility: visible; }
  .print-root { position: absolute; inset: 0; width: 100%; height: auto !important; overflow: visible !important; padding: 0 !important; }
  body { color: #000 !important; font-size: 10pt; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .cost-period { page-break-inside: avoid; break-inside: avoid; }
  .cost-period + .cost-period { margin-top: 1.5rem; }
  table { border-collapse: collapse; width: 100%; }
  table th, table td { border-bottom: 1px solid #ddd !important; }
  table thead { background: #f4f4f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2 { color: #000 !important; }
  .text-muted-foreground { color: #4b5563 !important; }
  .print-grand-total { border-top: 2px solid #000; padding-top: 0.5rem; }
}
.print-only { display: none; }
`;

export function ProjectCostsTab({ project }: Props) {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const sorted = [...project.periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="space-y-6 print-root">
        <div className="flex justify-between items-center no-print">
          <p className="text-xs text-muted-foreground">
            Klik op een prijs om een projectprijs in te stellen. Klik op het
            kortingsveld voor korting per regel.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setInvoiceOpen(true)}>
              + Nieuwe factuur
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              Afdrukken / PDF
            </Button>
          </div>
        </div>

        <ProjectInvoicesList projectId={project.id} />

        <header className="print-only space-y-1">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm">
            {[project.client, project.location].filter(Boolean).join(" · ")}
          </p>
          <p className="text-sm">
            {fmtDate(project.startDate)} – {fmtDate(project.endDate)}
          </p>
        </header>

        <div className="space-y-6">
          {sorted.map((period) => (
            <CostPeriodSection key={period.id} period={period} project={project} />
          ))}
        </div>

        <Separator />

        <CostSummary periods={sorted} />
      </div>

      <CreateInvoiceDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} projectId={project.id} />
    </>
  );
}
