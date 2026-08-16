import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatEUR } from "@/lib/pricing";
import type { PaybackEntry } from "@/hooks/use-stats";

function PaybackRow({ entry }: { entry: PaybackEntry }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline text-sm">
        <span className="min-w-0 truncate font-medium">{entry.name}</span>
        <span className="tabular-nums shrink-0 ml-2">{entry.paybackPct}%</span>
      </div>
      <Progress value={Math.min(100, entry.paybackPct)} className="h-2" />
      <p className="text-xs text-muted-foreground">
        {formatEUR(entry.earned)} verdiend op {formatEUR(entry.costBasis)} kostprijs
      </p>
    </div>
  );
}

/**
 * K2.4 — two ranked lists with progress bars to 100%, lifetime-to-date
 * (K4 — never filtered by the page's date range) and deliberately
 * shown in its own card, visually separate from the range-filtered
 * sections above, so nobody reads payback as "this month". Not a
 * chart, and deliberately not the full sortable table (declined by
 * the PO).
 */
export function PaybackSection({ best, worst }: { best: PaybackEntry[]; worst: PaybackEntry[] }) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">Terugverdiend (lifetime)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Onafhankelijk van de gekozen periode hierboven — dit is de volledige
          geschiedenis per materiaal.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Best terugverdiend</h3>
          {best.length === 0 ? (
            <p className="text-muted-foreground text-sm">Geen materialen met bekende kostprijs.</p>
          ) : (
            best.map((e) => <PaybackRow key={e.materialId} entry={e} />)
          )}
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Slechtst terugverdiend</h3>
          {worst.length === 0 ? (
            <p className="text-muted-foreground text-sm">Geen materialen met bekende kostprijs.</p>
          ) : (
            worst.map((e) => <PaybackRow key={e.materialId} entry={e} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}
