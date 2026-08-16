"use client";

import { useState } from "react";
import { StatsDateRange } from "@/components/stats-date-range";
import { RevenueByMonthSection } from "@/components/revenue-by-month-section";
import { RevenueByClientSection } from "@/components/revenue-by-client-section";
import { PersonUtilisationSection } from "@/components/person-utilisation-section";
import { TopMaterialsSection } from "@/components/top-materials-section";
import { PaybackSection } from "@/components/payback-section";
import { useStats } from "@/hooks/use-stats";

function defaultRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-01-01`;
  const to = `${now.getFullYear()}-12-31`;
  return { from, to };
}

/** K2.2-K2.4 — the figures page: a date-range control shared by every
 * range-scoped section, then the range-filtered charts+tables, then
 * payback (lifetime, visually separate) last. */
export default function CijfersPage() {
  const [{ from, to }, setRange] = useState(defaultRange);
  const { data, isLoading, isError, error } = useStats(from, to);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Cijfers</h2>
        <StatsDateRange
          from={from}
          to={to}
          onFromChange={(v) => setRange((r) => ({ ...r, from: v }))}
          onToChange={(v) => setRange((r) => ({ ...r, to: v }))}
        />
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Laden...</p>}
      {isError && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <>
          <RevenueByMonthSection data={data.revenueByMonth} />
          <RevenueByClientSection data={data.revenueByClient} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PersonUtilisationSection data={data.personUtilisation} />
            <TopMaterialsSection data={data.topMaterials} />
          </div>
          <PaybackSection best={data.payback.best} worst={data.payback.worst} />
        </>
      )}
    </div>
  );
}
