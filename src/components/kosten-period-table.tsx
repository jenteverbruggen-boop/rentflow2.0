import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PeriodSubtotals } from "@/components/cost-summary";
import { formatEUR, periodDays, personLineCost, periodTotal } from "@/lib/pricing";
import { groupMaterialAssignments, materialGroupCost } from "@/lib/grouping";
import { toNumber } from "@/lib/serialize";
import type { Period } from "@/types";

interface Props {
  period: Period;
}

function fmtDate(d: string) {
  return format(new Date(d), "d MMM yyyy", { locale: nl });
}

function discountLabel(discountPct: number | null, discountAmount: number | null): string {
  if (discountPct != null) return `-${discountPct}%`;
  if (discountAmount != null) return `-${formatEUR(discountAmount)}`;
  return "—";
}

/** J2a — a read-only cost table for the printable /projects/[id]/kosten
 * route. Deliberately does not reuse CostPeriodSection/cost-line-row.tsx:
 * those render LinePricePopover/BookingDiscountPopover — editable
 * controls with no place in a document handed to a client. Reuses
 * PeriodSubtotals (already plain, no interactive elements) and the
 * same pricing.ts/grouping.ts functions the interactive tab uses, so
 * the figures match exactly. */
export function KostenPeriodTable({ period }: Props) {
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
            {fmtDate(period.startDate)} – {fmtDate(period.endDate)} · {days} dag{days !== 1 ? "en" : ""}
          </p>
        </div>
        <span className="text-base font-semibold tabular-nums">{formatEUR(total)}</span>
      </div>
      <PeriodSubtotals period={period} />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 text-left font-semibold">Omschrijving</th>
            <th className="py-2 text-left font-semibold">Berekening</th>
            <th className="py-2 text-left font-semibold">Korting</th>
            <th className="py-2 text-right font-semibold">Subtotaal</th>
          </tr>
        </thead>
        <tbody>
          {period.people.map((pp) => (
            <tr key={`p-${pp.id}`} className="border-b last:border-0">
              <td className="py-2">
                {pp.person.name}
                {pp.function?.name && (
                  <span className="text-muted-foreground text-xs"> · {pp.function.name}</span>
                )}
              </td>
              <td className="py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {days} × {formatEUR(pp.dayPriceSnapshot)}
              </td>
              <td className="py-2 text-xs text-muted-foreground">
                {discountLabel(pp.discountPct, pp.discountAmount)}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {formatEUR(personLineCost(pp, days))}
              </td>
            </tr>
          ))}
          {matGroups.map((g) => (
            <tr key={`m-${g.key}`} className="border-b last:border-0">
              <td className="py-2">
                {g.material.name} <span className="text-muted-foreground text-xs">×{g.units}</span>
              </td>
              <td className="py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {g.units} × {days} × {formatEUR(g.dayPriceSnapshot)}
              </td>
              <td className="py-2 text-xs text-muted-foreground">
                {discountLabel(g.discountPct, g.discountAmount)}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {formatEUR(materialGroupCost(g, days))}
              </td>
            </tr>
          ))}
          {travelLines.map(({ key, travel, personName }) => (
            <tr key={key} className="border-b last:border-0">
              <td className="py-2">
                {travel.label ?? "Reiskosten"}
                <span className="text-muted-foreground text-xs"> · {personName}</span>
              </td>
              <td className="py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {travel.quantity} × {formatEUR(toNumber(travel.unitCost))}
              </td>
              <td className="py-2" />
              <td className="py-2 text-right font-medium tabular-nums">
                {formatEUR(toNumber(travel.unitCost) * travel.quantity)}
              </td>
            </tr>
          ))}
          {period.people.length === 0 && period.materials.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                Geen boekingen in deze periode
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
