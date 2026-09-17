"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PrintLayout } from "@/components/print/print-layout";
import { DocumentHeader } from "@/components/print/document-header";
import { PakbonMaterials } from "../pakbon-materials";
import { useSettings } from "@/hooks/use-settings";
import type { Project } from "@/types";

function fmtDT(d: string) {
  return format(new Date(d), "dd-MM-yyyy HH:mm", { locale: nl });
}

export default function PakbonPage() {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });
  // B1 — shared settings query (was DocumentHeader's own private fetch);
  // folded into the same loading gate so the print button never fires
  // before the company header block has resolved.
  const { data: settings, isLoading: settingsLoading } = useSettings();

  if (isLoading || settingsLoading) return <p className="p-6">Laden...</p>;
  if (!project) return <p className="p-6">Project niet gevonden</p>;

  const clientName = project.clientRel?.name ?? project.client;
  const locName = project.locationRel?.name ?? project.location;
  const locAddr = project.locationRel
    ? [
        project.locationRel.address,
        [project.locationRel.postalCode, project.locationRel.city]
          .filter(Boolean)
          .join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const sorted = [...project.periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  return (
    <PrintLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 text-sm">
        <DocumentHeader
          company={settings}
          meta={{
            opdrachtgever: clientName,
            locatie: locName,
            locatieAdres: locAddr,
            projectnummer: project.id,
            aangemaaktOp: format(new Date(project.createdAt), "dd-MM-yyyy", {
              locale: nl,
            }),
          }}
        />

        <h1 className="text-2xl font-bold">Pakbon</h1>

        <div>
          <h2 className="text-base font-semibold border-b pb-1 mb-2">
            Tijdschema
          </h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-2">Periode</th>
                <th className="text-left p-2">Van</th>
                <th className="text-left p-2">Tot</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{fmtDT(p.startDate)}</td>
                  <td className="p-2">{fmtDT(p.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PakbonMaterials periods={sorted} />

        <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t">
          <div>
            <p className="font-semibold mb-8">Handtekening uitvoerder</p>
            <div className="border-b border-foreground" />
            <p className="text-xs mt-1">Naam + datum</p>
          </div>
          <div>
            <p className="font-semibold mb-8">Handtekening klant</p>
            <div className="border-b border-foreground" />
            <p className="text-xs mt-1">Naam + datum</p>
          </div>
        </div>
      </div>
    </PrintLayout>
  );
}
