"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PrintLayout } from "@/components/print/print-layout";
import { DocumentHeader } from "@/components/print/document-header";
import { groupMaterialAssignments } from "@/lib/grouping";
import { formatEUR, periodDays, materialLineCost } from "@/lib/pricing";
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

  if (isLoading) return <p className="p-6">Laden...</p>;
  if (!project) return <p className="p-6">Project niet gevonden</p>;

  const clientName = project.clientRel?.name ?? project.client;
  const locName = project.locationRel?.name ?? project.location;
  const locAddr = project.locationRel
    ? [project.locationRel.address, [project.locationRel.postalCode, project.locationRel.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : null;

  const sorted = [...project.periods].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <PrintLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 text-sm">
        <DocumentHeader meta={{ opdrachtgever: clientName, locatie: locName, locatieAdres: locAddr, projectnummer: project.id, aangemaaktOp: format(new Date(project.createdAt), "dd-MM-yyyy", { locale: nl }) }} />

        <h1 className="text-2xl font-bold">Pakbon</h1>

        <div>
          <h2 className="text-base font-semibold border-b pb-1 mb-2">Tijdschema</h2>
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-100"><th className="text-left p-2">Periode</th><th className="text-left p-2">Van</th><th className="text-left p-2">Tot</th></tr></thead>
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

        <div>
          <h2 className="text-base font-semibold border-b pb-1 mb-2">Materialen</h2>
          {sorted.map((period) => {
            const days = periodDays(period);
            const groups = groupMaterialAssignments(period.materials);
            if (groups.length === 0) return null;

            const byCategory = new Map<string, typeof groups>();
            for (const g of groups) {
              const cat = g.material.categoryRel?.name ?? g.material.category ?? "Overig";
              byCategory.set(cat, [...(byCategory.get(cat) ?? []), g]);
            }

            return (
              <div key={period.id} className="mb-4">
                <p className="font-medium mb-1">{period.name}</p>
                {Array.from(byCategory.entries()).map(([cat, catGroups]) => (
                  <div key={cat} className="mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{cat}</p>
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-100">
                        <th className="text-left p-1.5">Aantal</th>
                        <th className="text-center p-1.5 w-16">✓ ✓</th>
                        <th className="text-left p-1.5">Naam</th>
                        <th className="text-left p-1.5">Code</th>
                        <th className="text-right p-1.5">Totaal</th>
                      </tr></thead>
                      <tbody>
                        {catGroups.map((g) => (
                          <tr key={g.key}>
                            <td className="p-1.5">{g.units}</td>
                            <td className="p-1.5 text-center"><span className="border border-gray-400 inline-block w-4 h-4 mr-1" /><span className="border border-gray-400 inline-block w-4 h-4" /></td>
                            <td className="p-1.5">{g.material.name}</td>
                            <td className="p-1.5">{g.material.code ?? "TEMP"}</td>
                            <td className="p-1.5 text-right">{formatEUR(materialLineCost(g.assignments[0], days) * g.units)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t">
          <div><p className="font-semibold mb-8">Handtekening uitvoerder</p><div className="border-b border-black" /><p className="text-xs mt-1">Naam + datum</p></div>
          <div><p className="font-semibold mb-8">Handtekening klant</p><div className="border-b border-black" /><p className="text-xs mt-1">Naam + datum</p></div>
        </div>
      </div>
    </PrintLayout>
  );
}
