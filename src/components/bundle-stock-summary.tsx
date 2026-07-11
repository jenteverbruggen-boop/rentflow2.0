"use client";

import type { BundleStock } from "@/types";

interface BundleStockSummaryProps {
  bundleStock: BundleStock;
}

export function BundleStockSummary({ bundleStock }: BundleStockSummaryProps) {
  const { completeSets, hasIncomplete, components } = bundleStock;

  if (components.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Voeg componenten toe om beschikbare sets te berekenen.
      </p>
    );
  }

  const incompleteRows = components.filter((c) => c.remaining > 0);

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground">Complete sets (max)</p>
        <p className="text-lg font-semibold">
          {completeSets} {completeSets === 1 ? "set" : "sets"}
        </p>
        <p className="text-xs text-muted-foreground">
          Automatisch berekend — gedeelde componenten verlagen dit bij gelijktijdige boekingen.
        </p>
        {bundleStock.components.some((c) => c.sharedWith && c.sharedWith.length > 0) && (
          <div className="mt-2 space-y-0.5">
            {bundleStock.components
              .filter((c) => c.sharedWith && c.sharedWith.length > 0)
              .map((c) => (
                <p key={c.childId} className="text-[10px] text-muted-foreground">
                  🔗 {c.name} — gedeeld met {c.sharedWith!.map((s) => s.name).join(", ")}
                </p>
              ))}
          </div>
        )}
      </div>

      {hasIncomplete && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1.5">
          <p className="text-xs font-semibold">
            ⚠️ 1 onvolledige set — nog niet compleet
          </p>
          {incompleteRows.map((c) => (
            <div
              key={c.childId}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="min-w-0 truncate">{c.name}</span>
              {c.missingForNext > 0 ? (
                <span className="shrink-0 text-destructive">
                  {c.haveForNext}/{c.needPerSet} — mist {c.missingForNext}
                </span>
              ) : (
                <span className="shrink-0 text-muted-foreground">
                  {c.haveForNext}/{c.needPerSet} ✓
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
