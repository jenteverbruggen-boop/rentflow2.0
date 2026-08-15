"use client";

import { Separator } from "@/components/ui/separator";
import {
  formatEUR,
  periodPeopleCost,
  periodMaterialsCost,
  periodTravelCost,
  projectCostSummary,
  BTW_RATE,
  btwAmount,
  withBtw,
} from "@/lib/pricing";
import type { Period } from "@/types";

interface PeriodSubtotalsProps {
  period: Period;
}

export function PeriodSubtotals({ period }: PeriodSubtotalsProps) {
  const people = periodPeopleCost(period);
  const materials = periodMaterialsCost(period);
  const travel = periodTravelCost(period);
  return (
    <div className="flex justify-end gap-6 pt-2 text-sm">
      {period.people.length > 0 && (
        <span className="text-muted-foreground">
          Personen:{" "}
          <span className="font-medium text-foreground">
            {formatEUR(people)}
          </span>
        </span>
      )}
      {period.materials.length > 0 && (
        <span className="text-muted-foreground">
          Materialen:{" "}
          <span className="font-medium text-foreground">
            {formatEUR(materials)}
          </span>
        </span>
      )}
      {travel > 0 && (
        <span className="text-muted-foreground">
          Reiskosten:{" "}
          <span className="font-medium text-foreground">
            {formatEUR(travel)}
          </span>
        </span>
      )}
    </div>
  );
}

interface CostSummaryProps {
  periods: Period[];
}

export function CostSummary({ periods }: CostSummaryProps) {
  const { people, materials, subtotal, travel, total } =
    projectCostSummary(periods);
  return (
    <div className="flex justify-end">
      <div className="text-right space-y-1 print-grand-total min-w-48">
        <Separator className="mb-2" />
        {people > 0 && (
          <div className="flex justify-between gap-6 text-sm">
            <span className="text-muted-foreground">Personen</span>
            <span className="tabular-nums">{formatEUR(people)}</span>
          </div>
        )}
        {materials > 0 && (
          <div className="flex justify-between gap-6 text-sm">
            <span className="text-muted-foreground">Materialen</span>
            <span className="tabular-nums">{formatEUR(materials)}</span>
          </div>
        )}
        <div className="flex justify-between gap-6 text-sm">
          <span className="text-muted-foreground">Subtotaal</span>
          <span className="tabular-nums">{formatEUR(subtotal)}</span>
        </div>
        {travel > 0 && (
          <div className="flex justify-between gap-6 text-sm">
            <span className="text-muted-foreground">Reiskosten</span>
            <span className="tabular-nums">{formatEUR(travel)}</span>
          </div>
        )}
        <Separator className="my-1" />
        <div className="flex justify-between gap-6 text-sm">
          <span className="text-muted-foreground">Totaal excl. BTW</span>
          <span className="tabular-nums">{formatEUR(total)}</span>
        </div>
        <div className="flex justify-between gap-6 text-sm">
          <span className="text-muted-foreground">
            BTW {Math.round(BTW_RATE * 100)}%
          </span>
          <span className="tabular-nums">{formatEUR(btwAmount(total))}</span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between gap-6 items-baseline">
          <span className="text-xs text-muted-foreground">
            Totaal incl. BTW
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {formatEUR(withBtw(total))}
          </span>
        </div>
      </div>
    </div>
  );
}
