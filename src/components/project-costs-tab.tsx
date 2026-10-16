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
import { ProjectQuotesList } from "@/components/project-quotes-list";
import { useQuotes } from "@/hooks/use-quotes";
import { useRouter } from "next/navigation";
import type { Project } from "@/types";

interface Props {
  project: Project;
}

function fmtDate(d: string) {
  return format(new Date(d), "d MMM yyyy", { locale: nl });
}

export function ProjectCostsTab({ project }: Props) {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const router = useRouter();
  const { create: createQuote } = useQuotes({ projectId: project.id });
  const sorted = [...project.periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  return (
    <>
      <div className="space-y-6 print-root">
        <div className="flex justify-between items-center no-print">
          <p className="text-xs text-muted-foreground">
            Klik op een prijs om een projectprijs in te stellen. Klik op het
            kortingsveld voor korting per regel.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={createQuote.isPending}
              onClick={() => createQuote.mutate(project.id, { onSuccess: (q) => router.push(`/offertes/${q.id}`) })}
            >
              + Nieuwe offerte
            </Button>
            <Button variant="outline" onClick={() => setInvoiceOpen(true)}>
              + Nieuwe factuur
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              Afdrukken / PDF
            </Button>
          </div>
        </div>

        {createQuote.isError && <p className="text-sm text-destructive no-print">{createQuote.error.message}</p>}
        <ProjectQuotesList projectId={project.id} />
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
