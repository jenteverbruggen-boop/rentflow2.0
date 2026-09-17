import { groupMaterialAssignmentsNested } from "@/lib/grouping";
import { formatEUR, periodDays, materialLineCost } from "@/lib/pricing";
import type { Period } from "@/types";

/** Extracted from pakbon/page.tsx to stay under the 150-line file limit
 * (B1 pass) — pure presentational, no behavior change. */
export function PakbonMaterials({ periods }: { periods: Period[] }) {
  return (
    <div>
      <h2 className="text-base font-semibold border-b pb-1 mb-2">Materialen</h2>
      {periods.map((period) => {
        const days = periodDays(period);
        const nestedGroups = groupMaterialAssignmentsNested(
          period.materials,
          period.bundleBookings ?? [],
        );
        if (nestedGroups.length === 0) return null;

        return (
          <div key={period.id} className="mb-4">
            <p className="font-medium mb-1">{period.name}</p>
            {nestedGroups.map(({ category, flatLines, bundleLines }) => (
              <div key={category} className="mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  {category}
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-1.5">Aantal</th>
                      <th className="text-center p-1.5 w-16">✓ ✓</th>
                      <th className="text-left p-1.5">Naam</th>
                      <th className="text-left p-1.5">Code</th>
                      <th className="text-right p-1.5">Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatLines.map((g) => (
                      <tr key={g.key}>
                        <td className="p-1.5">{g.units}</td>
                        <td className="p-1.5 text-center">
                          <span className="border border-muted-foreground inline-block w-4 h-4 mr-1" />
                          <span className="border border-muted-foreground inline-block w-4 h-4" />
                        </td>
                        <td className="p-1.5">{g.material.name}</td>
                        <td className="p-1.5">{g.material.code ?? "TEMP"}</td>
                        <td className="p-1.5 text-right">
                          {formatEUR(materialLineCost(g.assignments[0], days) * g.units)}
                        </td>
                      </tr>
                    ))}
                    {bundleLines.map((b) => (
                      <>
                        <tr key={`bundle-${b.booking.id}`} className="bg-muted/50 font-semibold">
                          <td className="p-1.5">{b.booking.quantity}</td>
                          <td className="p-1.5 text-center">
                            <span className="border border-muted-foreground inline-block w-4 h-4 mr-1" />
                            <span className="border border-muted-foreground inline-block w-4 h-4" />
                          </td>
                          <td className="p-1.5">
                            {b.booking.material?.name ?? "Set"}{" "}
                            <span className="text-muted-foreground">(set)</span>
                          </td>
                          <td className="p-1.5">{b.booking.material?.code ?? "SET"}</td>
                          <td className="p-1.5 text-right">
                            {formatEUR(
                              b.booking.dayPriceSnapshot == null
                                ? null
                                : b.booking.dayPriceSnapshot * days * b.booking.quantity,
                            )}
                          </td>
                        </tr>
                        {b.componentGroups.map((cg) => (
                          <tr key={`comp-${cg.key}`} className="text-muted-foreground">
                            <td className="p-1.5 pl-6">{cg.units}</td>
                            <td className="p-1.5" />
                            <td className="p-1.5 pl-6 italic">{cg.material.name}</td>
                            <td className="p-1.5 pl-6">{cg.material.code ?? "TEMP"}</td>
                            <td className="p-1.5 text-right">—</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
