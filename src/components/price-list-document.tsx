import { formatEUR } from "@/lib/pricing";
import type { LoadedPriceList } from "@/lib/price-list-load";

/** The printable body of a price list: one table per category, then the
 * crew rates. Prices are right-aligned and tabular so columns line up. */
export function PriceListDocument({ list }: { list: LoadedPriceList }) {
  const vatLabel = list.vat === "incl" ? `incl. ${list.btwRate}% BTW` : "excl. BTW";
  const hasSetup = list.sections.some((s) => s.rows.some((r) => r.setupCost != null));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prijslijst{list.clientName ? ` — ${list.clientName}` : ""}</h1>
        <p className="text-muted-foreground">Prijzen per dag (of per huur waar vermeld), {vatLabel}</p>
      </div>

      {list.sections.length === 0 && <p className="text-muted-foreground">Geen materialen voor deze selectie.</p>}

      {list.sections.map((section) => (
        <section key={section.title} className="break-inside-avoid-page space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{section.title}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-28 py-1 font-medium">Code</th>
                <th className="py-1 font-medium">Omschrijving</th>
                <th className="w-28 py-1 text-right font-medium">Prijs</th>
                {hasSetup && <th className="w-28 py-1 text-right font-medium">Op-/afbouw</th>}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((r) => (
                <tr key={`${r.code}-${r.name}`} className="border-t">
                  <td className="py-1 text-xs text-muted-foreground">{r.code}</td>
                  <td className="py-1">{r.name}{r.isSet && <span className="text-xs text-muted-foreground"> (set)</span>}</td>
                  <td className="py-1 text-right tabular-nums">{formatEUR(r.dayPrice)}{r.perRental ? <span className="text-xs text-muted-foreground"> /huur</span> : null}</td>
                  {hasSetup && <td className="py-1 text-right tabular-nums">{r.setupCost != null ? formatEUR(r.setupCost) : ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {list.crew.length > 0 && (
        <section className="break-inside-avoid-page space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Personeel</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Functie</th>
                <th className="w-28 py-1 text-right font-medium">Per dag</th>
                <th className="w-28 py-1 text-right font-medium">Per uur</th>
              </tr>
            </thead>
            <tbody>
              {list.crew.map((c) => (
                <tr key={c.name} className="border-t">
                  <td className="py-1">{c.name}</td>
                  <td className="py-1 text-right tabular-nums">{c.dayRate != null ? formatEUR(c.dayRate) : "—"}</td>
                  <td className="py-1 text-right tabular-nums">{c.hourRate != null ? formatEUR(c.hourRate) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">Tarieven personeel zijn indicatief (vanaf); een afwijkend tarief per persoon kan gelden.</p>
        </section>
      )}
    </div>
  );
}
