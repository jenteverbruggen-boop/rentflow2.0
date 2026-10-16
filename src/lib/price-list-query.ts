import type { ResolvedAccess } from "@/lib/api-auth";
import { moneyVisible } from "@/lib/redact";
import { satisfies } from "@/lib/modules";
import { DEFAULT_PRICE_LIST_OPTIONS, type PriceListOptions } from "@/lib/price-list";

const flag = (v: string | null, fallback: boolean) => (v === null ? fallback : v === "1" || v === "true");

/** `?categories=1,2&sets=0&crew=1&hideZero=0&client=7&vat=incl` → options.
 * Anything unparseable falls back to the default instead of failing. */
export function parsePriceListQuery(params: URLSearchParams): PriceListOptions {
  const d = DEFAULT_PRICE_LIST_OPTIONS;
  const cats = (params.get("categories") ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
  const client = Number(params.get("client"));
  return {
    categoryIds: params.has("categories") && cats.length > 0 ? cats : null,
    includeSets: flag(params.get("sets"), d.includeSets),
    includeCrew: flag(params.get("crew"), d.includeCrew),
    hideZero: flag(params.get("hideZero"), d.hideZero),
    clientId: Number.isInteger(client) && client > 0 ? client : null,
    vat: params.get("vat") === "incl" ? "incl" : "excl",
  };
}

/**
 * Who may generate what. Prices are money, so a caller who can't see money
 * (own scope, or no `kosten_facturen: lezen`) gets no price list at all;
 * crew rates are `personen` data and a client's rate card is `klanten` data.
 * Returns a reason string, or null when the request is allowed.
 */
export function priceListDenial(access: ResolvedAccess, opts: PriceListOptions): string | null {
  if (access.scope === "own" || !moneyVisible(access)) return "Geen toegang tot prijzen";
  const level = (m: "personen" | "klanten") => access.permissions[m] ?? "geen";
  if (opts.includeCrew && !satisfies(level("personen"), "lezen")) return "Geen toegang tot tarieven van personeel";
  if (opts.clientId != null && !satisfies(level("klanten"), "lezen")) return "Geen toegang tot klanten";
  return null;
}
