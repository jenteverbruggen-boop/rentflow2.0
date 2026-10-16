import { describe, it, expect } from "vitest";
import {
  buildPriceList, DEFAULT_PRICE_LIST_OPTIONS, type PriceListMaterial, type PriceListOptions,
} from "@/lib/price-list";

const mat = (over: Partial<PriceListMaterial>): PriceListMaterial => ({
  name: "Tent", code: "T1", category: null, categoryId: 1, categoryName: "Tenten", isBundle: false,
  dayPrice: 100, setupCost: null, bundlePriceOverride: null, components: [], ...over,
});
const opts = (over: Partial<PriceListOptions> = {}): PriceListOptions => ({ ...DEFAULT_PRICE_LIST_OPTIONS, ...over });
const build = (m: PriceListMaterial[], o: PriceListOptions = opts()) => buildPriceList(m, [], new Map(), o, 21);

describe("buildPriceList — materials", () => {
  it("groups per category, names sorted, 'Overig' last", () => {
    const list = build([
      mat({ name: "Zetel", categoryId: 2, categoryName: "Meubilair" }),
      mat({ name: "Kabel", categoryId: null, categoryName: null, category: null }),
      mat({ name: "Tent B" }), mat({ name: "Tent A" }),
    ]);
    expect(list.sections.map((s) => s.title)).toEqual(["Meubilair", "Tenten", "Overig"]);
    expect(list.sections[1].rows.map((r) => r.name)).toEqual(["Tent A", "Tent B"]);
  });

  it("uses the legacy category string when there is no category relation", () => {
    expect(build([mat({ categoryId: null, categoryName: null, category: "Geluid" })]).sections[0].title).toBe("Geluid");
  });

  it("prices a set at its override, else the component sum — including archived-looking children", () => {
    const parts = [{ quantity: 2, child: { dayPrice: 10 } }, { quantity: 1, child: { dayPrice: 5 } }];
    const list = build([
      mat({ name: "Set A", isBundle: true, components: parts }),
      mat({ name: "Set B", isBundle: true, components: parts, bundlePriceOverride: 40 }),
    ]);
    const rows = list.sections[0].rows;
    expect(rows.find((r) => r.name === "Set A")).toMatchObject({ dayPrice: 25, isSet: true });
    expect(rows.find((r) => r.name === "Set B")!.dayPrice).toBe(40);
  });

  it("can leave out sets, zero-price items and other categories", () => {
    const m = [
      mat({ name: "Set", isBundle: true, bundlePriceOverride: 50 }),
      mat({ name: "Gratis", dayPrice: 0 }),
      mat({ name: "Stoel", categoryId: 2, categoryName: "Meubilair" }),
      mat({ name: "Tent" }),
    ];
    expect(build(m, opts({ includeSets: false })).sections.flatMap((s) => s.rows.map((r) => r.name)).sort()).toEqual(["Stoel", "Tent"]);
    expect(build(m, opts({ hideZero: false })).sections.flatMap((s) => s.rows.map((r) => r.name))).toContain("Gratis");
    expect(build(m, opts({ categoryIds: [2] })).sections.map((s) => s.title)).toEqual(["Meubilair"]);
    expect(build(m).sections.flatMap((s) => s.rows.map((r) => r.name))).not.toContain("Gratis");
  });

  it("shows setup cost only when there is one, and applies BTW to every amount", () => {
    const m = [mat({ name: "Tent", dayPrice: 100, setupCost: 50 }), mat({ name: "Stoel", dayPrice: 2, setupCost: 0 })];
    const incl = build(m, opts({ vat: "incl" }));
    expect(incl.sections[0].rows.find((r) => r.name === "Tent")).toMatchObject({ dayPrice: 121, setupCost: 60.5 });
    expect(incl.sections[0].rows.find((r) => r.name === "Stoel")).toMatchObject({ dayPrice: 2.42, setupCost: null });
  });

  it("accepts Postgres-style string money", () => {
    expect(build([mat({ dayPrice: "12.50" })]).sections[0].rows[0].dayPrice).toBe(12.5);
  });
});

describe("buildPriceList — crew", () => {
  const fns = [
    { id: 1, name: "Technicus", dayRate: 300, hourRate: 40 },
    { id: 2, name: "Chauffeur", dayRate: 250, hourRate: null },
    { id: 3, name: "Stagiair", dayRate: null, hourRate: null },
  ];
  const crew = (rates: Map<number, { dayRate: unknown; hourRate: unknown }>, o = opts({ includeCrew: true })) =>
    buildPriceList([], fns, rates, o, 21).crew;

  it("is empty unless asked for, and skips functions without any rate", () => {
    expect(buildPriceList([], fns, new Map(), opts(), 21).crew).toEqual([]);
    expect(crew(new Map()).map((c) => c.name)).toEqual(["Chauffeur", "Technicus"]);
  });

  it("a client's rate card wins per field and falls back to the default for the other", () => {
    const rows = crew(new Map([[1, { dayRate: 350, hourRate: null }]]));
    expect(rows.find((c) => c.name === "Technicus")).toEqual({ name: "Technicus", dayRate: 350, hourRate: 40, clientSpecific: true });
    expect(rows.find((c) => c.name === "Chauffeur")!.clientSpecific).toBe(false);
  });
});
