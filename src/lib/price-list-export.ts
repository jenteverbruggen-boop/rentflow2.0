import type { ExportColumn } from "@/lib/export/xlsx-writer";
import type { LoadedPriceList } from "@/lib/price-list-load";

/** The price list as a readable spreadsheet (Dutch headers, money as real
 * numbers) — unlike the materials export, which is a raw re-import dump. */
export function priceListColumns(vat: "excl" | "incl"): ExportColumn[] {
  const suffix = vat === "incl" ? "incl. BTW" : "excl. BTW";
  return [
    { key: "category", header: "Categorie", type: "string" },
    { key: "code", header: "Code", type: "string" },
    { key: "name", header: "Omschrijving", type: "string" },
    { key: "kind", header: "Type", type: "string" },
    { key: "dayPrice", header: `Prijs (${suffix})`, type: "number" },
    { key: "basis", header: "Per", type: "string" },
    { key: "hourRate", header: `Prijs per uur (${suffix})`, type: "number" },
    { key: "setupCost", header: `Op-/afbouw (${suffix})`, type: "number" },
  ];
}

export function priceListRows(list: LoadedPriceList): Record<string, unknown>[] {
  const materialRows = list.sections.flatMap((s) =>
    s.rows.map((r) => ({
      category: s.title, code: r.code, name: r.name, kind: r.isSet ? "Set" : "Materiaal",
      dayPrice: r.dayPrice, basis: r.perRental ? "huur" : "dag", hourRate: null, setupCost: r.setupCost,
    })),
  );
  const crewRows = list.crew.map((c) => ({
    category: "Personeel (indicatief)", code: null, name: c.name, kind: "Functie",
    dayPrice: c.dayRate, basis: "dag", hourRate: c.hourRate, setupCost: null,
  }));
  return [...materialRows, ...crewRows];
}
