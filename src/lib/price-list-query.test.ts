import { describe, it, expect } from "vitest";
import { parsePriceListQuery, priceListDenial } from "@/lib/price-list-query";
import { DEFAULT_PRICE_LIST_OPTIONS } from "@/lib/price-list";
import type { ResolvedAccess } from "@/lib/api-auth";

const q = (s: string) => parsePriceListQuery(new URLSearchParams(s));

describe("parsePriceListQuery", () => {
  it("defaults to everything, sets on, crew off, excl. BTW", () => {
    expect(q("")).toEqual(DEFAULT_PRICE_LIST_OPTIONS);
  });
  it("parses every option", () => {
    expect(q("categories=1,2&sets=0&crew=1&hideZero=0&client=7&vat=incl")).toEqual({
      categoryIds: [1, 2], includeSets: false, includeCrew: true, hideZero: false, clientId: 7, vat: "incl",
    });
  });
  it("ignores junk instead of failing", () => {
    expect(q("categories=a,-1,0&client=abc&vat=weird")).toMatchObject({ categoryIds: null, clientId: null, vat: "excl" });
  });
});

const access = (over: Partial<ResolvedAccess> = {}): ResolvedAccess => ({
  id: 1, personId: null, scope: "all",
  permissions: { materialen: "lezen", kosten_facturen: "lezen", personen: "lezen", klanten: "lezen" }, ...over,
});

describe("priceListDenial", () => {
  const base = DEFAULT_PRICE_LIST_OPTIONS;
  it("allows a caller who can see money", () => {
    expect(priceListDenial(access(), base)).toBeNull();
  });
  it("refuses scope own and callers without kosten_facturen", () => {
    expect(priceListDenial(access({ scope: "own" }), base)).not.toBeNull();
    expect(priceListDenial(access({ permissions: { materialen: "lezen", kosten_facturen: "geen" } }), base)).not.toBeNull();
  });
  it("crew rates need personen, a client's card needs klanten", () => {
    const noPeople = access({ permissions: { materialen: "lezen", kosten_facturen: "lezen", klanten: "lezen" } });
    expect(priceListDenial(noPeople, { ...base, includeCrew: true })).not.toBeNull();
    expect(priceListDenial(noPeople, base)).toBeNull();
    const noClients = access({ permissions: { materialen: "lezen", kosten_facturen: "lezen", personen: "lezen" } });
    expect(priceListDenial(noClients, { ...base, clientId: 3 })).not.toBeNull();
  });
});
