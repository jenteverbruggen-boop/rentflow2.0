import type { Period } from "@/types";

/** Hired-in units don't leave the warehouse — they arrive from a supplier —
 * so the packing slip lists them apart, per supplier, instead of among the
 * pick-and-check lines. No prices: this is a logistics view. Renders nothing
 * when nothing is hired in. */
export function PakbonSubhire({ periods }: { periods: Period[] }) {
  const bySupplier = new Map<string, { period: string; name: string; units: number }[]>();
  for (const period of periods) {
    for (const s of period.shortages ?? []) {
      // Component shortages belong to a set that is booked as a whole.
      if (s.supplierId == null) continue;
      const supplier = s.supplier?.name ?? "Onbekende leverancier";
      const lines = bySupplier.get(supplier) ?? [];
      const existing = lines.find((l) => l.period === period.name && l.name === s.material.name);
      if (existing) existing.units += s.quantity;
      else lines.push({ period: period.name, name: s.material.name, units: s.quantity });
      bySupplier.set(supplier, lines);
    }
  }
  if (bySupplier.size === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold border-b pb-1 mb-2">Ingehuurd — te ontvangen van leveranciers</h2>
      {[...bySupplier.entries()].map(([supplier, lines]) => (
        <div key={supplier} className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{supplier}</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-1.5 w-16">Aantal</th>
                <th className="text-center p-1.5 w-16">Ontvangen</th>
                <th className="text-left p-1.5">Naam</th>
                <th className="text-left p-1.5">Periode</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={`${l.period}-${l.name}`}>
                  <td className="p-1.5">{l.units}</td>
                  <td className="p-1.5 text-center"><span className="border border-muted-foreground inline-block w-4 h-4" /></td>
                  <td className="p-1.5">{l.name}</td>
                  <td className="p-1.5">{l.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
