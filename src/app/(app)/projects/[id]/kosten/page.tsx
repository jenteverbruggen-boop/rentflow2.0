"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PrintLayout } from "@/components/print/print-layout";
import { DocumentHeader } from "@/components/print/document-header";
import { CostSummary } from "@/components/cost-summary";
import { KostenPeriodTable } from "@/components/kosten-period-table";
import type { Project } from "@/types";

export default function KostenPrintPage() {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  if (isLoading) return <p className="p-6">Laden...</p>;
  if (!project) return <p className="p-6">Project niet gevonden</p>;

  const clientName = project.clientRel?.name ?? project.client;
  const clientAddr = project.clientRel
    ? [
        project.clientRel.address,
        [project.clientRel.postalCode, project.clientRel.city].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : null;
  const locName = project.locationRel?.name ?? project.location;

  const sorted = [...project.periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  return (
    <PrintLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 text-sm">
        <DocumentHeader
          meta={{
            opdrachtgever: clientName,
            opdrachtgeverAdres: clientAddr,
            opdrachtgeverVat: project.clientRel?.vatNumber ?? undefined,
            locatie: locName,
            projectnummer: project.id,
            aangemaaktOp: format(new Date(project.createdAt), "dd-MM-yyyy", { locale: nl }),
          }}
        />

        <h1 className="text-2xl font-bold">Kostenoverzicht</h1>
        <p className="text-muted-foreground">
          {project.name} · {format(new Date(project.startDate), "d MMM yyyy", { locale: nl })}
          {" – "}
          {format(new Date(project.endDate), "d MMM yyyy", { locale: nl })}
        </p>

        <div className="space-y-6">
          {sorted.map((period) => (
            <KostenPeriodTable key={period.id} period={period} />
          ))}
        </div>

        <CostSummary periods={sorted} />
      </div>
    </PrintLayout>
  );
}
