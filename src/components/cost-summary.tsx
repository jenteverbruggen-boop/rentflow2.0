"use client";

import { Separator } from "@/components/ui/separator";
import { formatEUR, periodPeopleCost, periodMaterialsCost, projectCostSummary } from "@/lib/pricing";
import type { Period } from "@/types";

interface PeriodSubtotalsProps {
  period: Period;
}

export function PeriodSubtotals({ period }: PeriodSubtotalsProps) {
  const people = periodPeopleCost(period);
  const materials = periodMaterialsCost(period);
  return (
    <div className="flex justify-end gap-6 pt-2 text-sm">
      {period.people.length > 0 && (
        <span className="text-muted-foreground">Personen: <span className="font-medium text-foreground">{formatEUR(people)}</span></span>
      )}
      {period.materials.length > 0 && (
        <span className="text-muted-foreground">Materialen: <span className="font-medium text-foreground">{formatEUR(materials)}</span></span>
      )}
    </div>
  );
}

interface CostSummaryProps {
  periods: Period[];
}

export function CostSummary({ periods }: CostSummaryProps) {
  const { people, materials, total } = projectCostSummary(periods);
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
        <Separator className="my-1" />
        <div className="flex justify-between gap-6">
          <span className="text-xs text-muted-foreground">Totaal project excl. BTW</span>
          <span className="text-2xl font-bold tabular-nums">{formatEUR(total)}</span>
        </div>
      </div>
    </div>
  );
}
