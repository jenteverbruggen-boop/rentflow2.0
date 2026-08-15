import type { ResolvedAccess } from "@/lib/api-auth";
import { satisfies } from "@/lib/modules";

/**
 * Whether money fields should be visible to this caller. This is the
 * single check every money-visibility decision in the app goes through —
 * N5.1b (own-data scoping) extends this exact function with a scope
 * override rather than duplicating the Kosten/Facturen check elsewhere.
 */
export function moneyVisible(access: ResolvedAccess): boolean {
  const held = access.permissions.kosten_facturen ?? "geen";
  return satisfies(held, "lezen");
}

// Whole record dropped entirely — a redacted PersonTravelCost with only
// unitCost removed would still disclose that a travel arrangement exists,
// itself commercial information (own-data-scoping-design.md:105's
// reasoning applies to any Kosten/Facturen: geen caller, not only scoped
// ones). Same logic for the two project-level price-override arrays: the
// override's mere existence is commercial.
const ARRAY_DENYLIST = new Set(["materialPrices", "personPrices", "travelCosts"]);

// Whole nested object dropped — bundleStock.componentSum is itself a
// derived price; redacting only componentSum and keeping the rest would
// still leak per-component pricing via the object's other fields.
const OBJECT_DENYLIST = new Set(["bundleStock"]);

// Scalars nulled in place — the surrounding record (e.g. a PeriodStockItem
// booking) is otherwise still useful to a non-Kosten caller (quantities,
// material name, who's assigned), so only the money fields inside it are
// stripped. `costPrice`/`listPrice`/`revenueBefore` are forward entries
// for phase 3's material-payback feature (K4) — declared now so redact.ts
// doesn't need a second pass when those fields land.
const SCALAR_DENYLIST = new Set([
  "dayPrice",
  "dayPriceSnapshot",
  "setupCost",
  "setupCostSnapshot",
  "bundlePriceOverride",
  "discountPct",
  "discountAmount",
  "unitCost",
  "basePrice",
  "setPrice",
  "costPrice",
  "listPrice",
  "revenueBefore",
]);

// hasOverride is a boolean, not a price — but "an override exists" is
// still commercial information, so it's forced false rather than left
// visible while dayPrice/basePrice next to it are hidden.
const BOOLEAN_DENYLIST = new Set(["hasOverride"]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (ARRAY_DENYLIST.has(key)) out[key] = [];
      else if (OBJECT_DENYLIST.has(key)) out[key] = undefined;
      else if (SCALAR_DENYLIST.has(key)) out[key] = null;
      else if (BOOLEAN_DENYLIST.has(key)) out[key] = false;
      else out[key] = redactValue(v);
    }
    return out;
  }
  return value;
}

/**
 * Recursively strip every money field from `value` for a caller without
 * Kosten/Facturen access. A generic denylist walk, not a hand-typed
 * per-shape function — a field added later to project-include.ts (or any
 * other payload) without a matching entry here fails the redact.test.ts
 * recursive scan instead of silently leaking.
 *
 * No-op (returns `value` unchanged) when the caller can see money.
 */
export function redactMoney<T>(value: T, access: ResolvedAccess): T {
  if (moneyVisible(access)) return value;
  return redactValue(value) as T;
}

const MONEY_WRITE_FIELDS = ["dayPrice", "setupCost", "bundlePriceOverride"] as const;

/**
 * Generic per-field-presence check: reject a request body containing any
 * of `fields` unless the caller holds Kosten/Facturen: wijzigen. Checks
 * presence, not "does the caller have Kosten access" as a blanket deny —
 * a caller without Kosten access must still be able to write the other
 * fields in the same body (e.g. `role` on a booking PATCH).
 */
export function findRejectedField(
  body: Record<string, unknown>,
  access: ResolvedAccess,
  fields: readonly string[],
): string | null {
  const held = access.permissions.kosten_facturen ?? "geen";
  if (satisfies(held, "wijzigen")) return null;
  for (const field of fields) {
    if (body[field] !== undefined) return field;
  }
  return null;
}

/**
 * For write endpoints (people/[id], materials/[id]): reject a request
 * body that attempts to set a money field without Kosten/Facturen:
 * wijzigen. Returns the offending field name, or null if the write is
 * allowed.
 */
export function findRejectedMoneyWrite(
  body: Record<string, unknown>,
  access: ResolvedAccess,
): string | null {
  return findRejectedField(body, access, MONEY_WRITE_FIELDS);
}
