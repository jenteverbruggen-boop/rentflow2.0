"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PersonCostRow, MaterialGroupCostRow } from "@/components/cost-line-row";
import { formatEUR, periodDays, personLineCost, periodTotal, projectTotal } from "@/lib/pricing";
import { groupMaterialAssignments } from "@/lib/grouping";
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
  const sorted = [...project.periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const grand = projectTotal(project.periods);

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="space-y-6 print-root">
        <div className="flex justify-between items-center no-print">
          <p className="text-xs text-muted-foreground">
            Klik op een prijs om een projectprijs in te stellen. Klik op het kortingsveld voor korting per regel.
          </p>
          <Button variant="outline" onClick={() => window.print()}>Afdrukken / PDF</Button>
        </div>

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
          {sorted.map((period) => {
            const days = periodDays(period);
            const subtotal = periodTotal(period);
            const matGroups = groupMaterialAssignments(period.materials);
            return (
              <section key={period.id} className="space-y-3 cost-period">
                <div className="flex items-baseline justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{period.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(period.startDate)} – {fmtDate(period.endDate)} · {days} dag{days !== 1 ? "en" : ""}
                    </p>
                  </div>
                  <span className="text-base font-semibold tabular-nums">{formatEUR(subtotal)}</span>
                </div>
                <div className="border rounded-lg overflow-hidden bg-card">
                  <table className="w-full">
                    <colgroup>
                      <col className="w-9" />
                      <col />
                      <col className="w-48" />
                      <col className="w-24" />
                      <col className="w-24" />
                      <col className="w-28" />
                    </colgroup>
                    <thead>
                      <tr className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pl-3 text-left font-semibold" colSpan={2}>Omschrijving</th>
                        <th className="py-2 pr-4 text-left font-semibold">Berekening</th>
                        <th className="py-2 pr-3 text-left font-semibold">Korting</th>
                        <th className="py-2 pr-3 text-right font-semibold">Projectprijs</th>
                        <th className="py-2 pr-3 text-right font-semibold">Subtotaal</th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr:hover]:bg-muted/30 [&>tr]:transition-colors">
                      {period.people.map((pp) => (
                        <PersonCostRow
                          key={`p-${pp.id}`}
                          line={pp}
                          days={days}
                          cost={personLineCost(pp, days)}
                          periodId={period.id}
                          project={project}
                        />
                      ))}
                      {period.people.length > 0 && matGroups.length > 0 && (
                        <tr><td colSpan={6} className="py-0.5" /></tr>
                      )}
                      {matGroups.map((g) => (
                        <MaterialGroupCostRow
                          key={`m-${g.key}`}
                          group={g}
                          days={days}
                          periodId={period.id}
                          project={project}
                        />
                      ))}
                      {period.people.length === 0 && period.materials.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                            Geen boekingen in deze periode
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>

        <Separator />

        <div className="flex justify-end">
          <div className="text-right space-y-0.5 print-grand-total">
            <p className="text-xs text-muted-foreground">Totaal excl. BTW</p>
            <p className="text-2xl font-bold tabular-nums">{formatEUR(grand)}</p>
          </div>
        </div>
      </div>
    </>
  );
}
