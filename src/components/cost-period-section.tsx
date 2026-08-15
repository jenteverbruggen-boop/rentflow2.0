"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  PersonCostRow,
  MaterialGroupCostRow,
  TravelCostRow,
} from "@/components/cost-line-row";
import { PeriodSubtotals } from "@/components/cost-summary";
import { formatEUR, periodDays, personLineCost, periodTotal } from "@/lib/pricing";
import { groupMaterialAssignments } from "@/lib/grouping";
import type { Period, Project } from "@/types";

interface Props {
  period: Period;
  project: Project;
}

function fmtDate(d: string) {
  return format(new Date(d), "d MMM yyyy", { locale: nl });
}

/** One period's cost table, extracted from project-costs-tab.tsx (Y3.1) —
 * pure move, no behaviour change. */
export function CostPeriodSection({ period, project }: Props) {
  const days = periodDays(period);
  const total = periodTotal(period);
  const matGroups = groupMaterialAssignments(period.materials);
  const travelLines = period.people.flatMap((pp) =>
    (pp.travelCosts ?? []).map((travel) => ({
      key: `t-${travel.id}`,
      travel,
      personName: pp.person.name,
    })),
  );

  return (
    <section className="space-y-3 cost-period">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold">{period.name}</h2>
          <p className="text-xs text-muted-foreground">
            {fmtDate(period.startDate)} – {fmtDate(period.endDate)} ·{" "}
            {days} dag{days !== 1 ? "en" : ""}
          </p>
        </div>
        <span className="text-base font-semibold tabular-nums">
          {formatEUR(total)}
        </span>
      </div>
      <PeriodSubtotals period={period} />
      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="w-full min-w-[560px]">
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
              <th className="py-2 pl-3 text-left font-semibold" colSpan={2}>
                Omschrijving
              </th>
              <th className="py-2 pr-4 text-left font-semibold">Berekening</th>
              <th className="py-2 pr-3 text-left font-semibold">Korting</th>
              <th className="py-2 pr-3 text-right font-semibold">
                Projectprijs
              </th>
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
              <tr>
                <td colSpan={6} className="py-0.5" />
              </tr>
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
            {(period.people.length > 0 || matGroups.length > 0) &&
              travelLines.length > 0 && (
                <tr>
                  <td colSpan={6} className="py-0.5" />
                </tr>
              )}
            {travelLines.map(({ key, travel, personName }) => (
              <TravelCostRow key={key} travel={travel} personName={personName} />
            ))}
            {period.people.length === 0 && period.materials.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  Geen boekingen in deze periode
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
