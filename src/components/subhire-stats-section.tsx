import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEUR } from "@/lib/pricing";
import type { SubhireStatsEntry } from "@/hooks/use-stats";

/** C3 — inhuur in the range: what hired-in units were billed, what the
 * suppliers charged, and the margin. Its own card, not folded into "omzet":
 * it is the one place a cost is known, and mixing it into revenue would skew
 * the figures above. */
export function SubhireStatsSection({ data }: { data: SubhireStatsEntry }) {
  if (data.rows === 0) return null;
  const figures = [
    { label: "Omzet inhuur", value: data.revenue, note: "aangerekend aan klanten" },
    { label: "Inkoop inhuur", value: data.cost, note: "betaald aan leveranciers" },
    { label: "Marge inhuur", value: data.margin, note: "omzet min inkoop" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Inhuur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {figures.map((f) => (
            <div key={f.label} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-xl font-semibold tabular-nums">{formatEUR(f.value.agreed)}</p>
              <p className="text-[11px] text-muted-foreground">afgesproken · {f.note}</p>
              <p className="text-xs tabular-nums text-muted-foreground">+ {formatEUR(f.value.pending)} nog te bevestigen</p>
            </div>
          ))}
        </div>
        {data.componentCost.agreed > 0 && (
          <p className="text-xs text-muted-foreground">
            Waarvan {formatEUR(data.componentCost.agreed)} inkoop voor ingehuurde onderdelen van sets (hun omzet is het aandeel in de setprijs).
          </p>
        )}
        {data.unpricedRows > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Voor {data.unpricedRows} ingehuurde regel(s) is nog geen inkoopprijs ingevuld — de marge is dus te hoog ingeschat.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
