"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PrintLayout } from "@/components/print/print-layout";
import { DocumentHeader } from "@/components/print/document-header";
import type { Project } from "@/types";

function fmtDT(d: string) {
  return format(new Date(d), "dd-MM-yyyy HH:mm", { locale: nl });
}

export default function CallsheetPage() {
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
          meta={{
            opdrachtgever: clientName,
            locatie: locName,
            locatieAdres: locAddr,
            projectnummer: project.id,
          }}
        />

        <h1 className="text-2xl font-bold">Callsheet — {project.name}</h1>

        {sorted.map((period) => (
          <div key={period.id} className="space-y-3">
            <div className="border-b pb-1">
              <p className="font-semibold text-base">{period.name}</p>
              <p className="text-xs text-muted-foreground">
                {fmtDT(period.startDate)} – {fmtDT(period.endDate)}
              </p>
            </div>

            {project.locationRel && (
              <div className="text-xs space-y-0.5">
                <p>
                  <span className="font-medium">Locatie:</span>{" "}
                  {project.locationRel.name}
                </p>
                {project.locationRel.address && (
                  <p>{project.locationRel.address}</p>
                )}
                {(project.locationRel.postalCode ||
                  project.locationRel.city) && (
                  <p>
                    {[project.locationRel.postalCode, project.locationRel.city]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}
                {project.locationRel.phone && (
                  <p>Tel: {project.locationRel.phone}</p>
                )}
              </div>
            )}

            {period.people.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Geen medewerkers ingepland
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-2">Naam</th>
                    <th className="text-left p-2">Functie</th>
                    <th className="text-left p-2">Van</th>
                    <th className="text-left p-2">Tot</th>
                    <th className="text-left p-2">Telefoon</th>
                  </tr>
                </thead>
                <tbody>
                  {period.people.map((pp) => (
                    <tr key={pp.id}>
                      <td className="p-2">{pp.person.name}</td>
                      <td className="p-2">
                        {pp.function?.name ?? pp.role ?? pp.person.role ?? "—"}
                      </td>
                      <td className="p-2">{fmtDT(period.startDate)}</td>
                      <td className="p-2">{fmtDT(period.endDate)}</td>
                      <td className="p-2">{pp.person.phone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </PrintLayout>
  );
}
