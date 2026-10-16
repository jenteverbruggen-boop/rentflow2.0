import { setDayPrice } from "@/lib/set-price";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

export interface PriceListOptions {
  /** Category ids to include; `null` = every category (incl. uncategorised). */
  categoryIds: number[] | null;
  includeSets: boolean;
  includeCrew: boolean;
  /** Leave out items that cost nothing (stock without a price yet). */
  hideZero: boolean;
  /** Apply this client's crew rates on top of the function defaults. */
  clientId: number | null;
  vat: "excl" | "incl";
}

export interface PriceListMaterial {
  name: string;
  code: string | null;
  category: string | null;
  categoryId: number | null;
  categoryName: string | null;
  isBundle: boolean;
  dayPrice: unknown;
  setupCost: unknown;
  bundlePriceOverride: unknown;
  components: { quantity: number; child: { dayPrice: unknown } }[];
}

export interface PriceListFunction {
  id: number;
  name: string;
  dayRate: unknown;
  hourRate: unknown;
}

export interface PriceListRow {
  code: string | null;
  name: string;
  isSet: boolean;
  dayPrice: number;
  setupCost: number | null;
}
export interface PriceListSection { title: string; rows: PriceListRow[] }
export interface PriceListCrewRow {
  name: string;
  dayRate: number | null;
  hourRate: number | null;
  /** At least one of the rates comes from the chosen client's rate card. */
  clientSpecific: boolean;
}
export interface PriceList {
  sections: PriceListSection[];
  crew: PriceListCrewRow[];
  vat: "excl" | "incl";
  btwRate: number;
}

export const DEFAULT_PRICE_LIST_OPTIONS: PriceListOptions = {
  categoryIds: null, includeSets: true, includeCrew: false, hideZero: true, clientId: null, vat: "excl",
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "nl");

/** Category label as the rest of the app shows it. */
function categoryTitle(m: PriceListMaterial): string {
  return m.categoryName ?? m.category ?? "Overig";
}

export function buildMaterialSections(
  materials: PriceListMaterial[],
  opts: PriceListOptions,
  priceOf: (n: number) => number,
): PriceListSection[] {
  const sections = new Map<string, PriceListRow[]>();
  for (const m of materials) {
    if (m.isBundle && !opts.includeSets) continue;
    if (opts.categoryIds && (m.categoryId == null || !opts.categoryIds.includes(m.categoryId))) continue;
    const day = m.isBundle ? setDayPrice(m.bundlePriceOverride, m.components) : toNumber(m.dayPrice);
    if (opts.hideZero && day <= 0) continue;
    const setup = toNumberOrNull(m.setupCost);
    const row: PriceListRow = {
      code: m.code, name: m.name, isSet: m.isBundle, dayPrice: priceOf(day),
      setupCost: setup != null && setup > 0 ? priceOf(setup) : null,
    };
    const title = categoryTitle(m);
    sections.set(title, [...(sections.get(title) ?? []), row]);
  }
  return [...sections.entries()]
    .sort(([a], [b]) => (a === "Overig" ? 1 : b === "Overig" ? -1 : a.localeCompare(b, "nl")))
    .map(([title, rows]) => ({ title, rows: rows.sort(byName) }));
}

/** Crew rates per function. Day and hour rate fall back to the function
 * default *independently* (a client card with only a day rate keeps the
 * default hour rate), and functions with no rate at all are left out. The
 * result is indicative: a person's own override can still differ. */
export function buildCrewRows(
  functions: PriceListFunction[],
  clientRates: Map<number, { dayRate: unknown; hourRate: unknown }>,
  priceOf: (n: number) => number,
): PriceListCrewRow[] {
  const rows: PriceListCrewRow[] = [];
  for (const f of functions) {
    const card = clientRates.get(f.id);
    const clientDay = toNumberOrNull(card?.dayRate) ?? null;
    const clientHour = toNumberOrNull(card?.hourRate) ?? null;
    const day = clientDay ?? toNumberOrNull(f.dayRate) ?? null;
    const hour = clientHour ?? toNumberOrNull(f.hourRate) ?? null;
    if (day == null && hour == null) continue;
    rows.push({
      name: f.name,
      dayRate: day == null ? null : priceOf(day),
      hourRate: hour == null ? null : priceOf(hour),
      clientSpecific: clientDay != null || clientHour != null,
    });
  }
  return rows.sort(byName);
}

export function buildPriceList(
  materials: PriceListMaterial[],
  functions: PriceListFunction[],
  clientRates: Map<number, { dayRate: unknown; hourRate: unknown }>,
  opts: PriceListOptions,
  btwRate: number,
): PriceList {
  const priceOf = (n: number) => (opts.vat === "incl" ? round2(n * (1 + btwRate / 100)) : round2(n));
  return {
    sections: buildMaterialSections(materials, opts, priceOf),
    crew: opts.includeCrew ? buildCrewRows(functions, clientRates, priceOf) : [],
    vat: opts.vat,
    btwRate,
  };
}
