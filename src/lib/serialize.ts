/**
 * Money-safe coercion at the API boundary.
 *
 * Postgres types money columns `Decimal`; SQLite (dev) types them `Float`.
 * `Prisma.Decimal.toJSON()` returns a *string*, so a route that returns a
 * Decimal-bearing Prisma result straight to `NextResponse.json()` hands the
 * client `"150"` where dev would have handed it `150`. Client code that does
 * `number + wireValue` then string-concatenates instead of adding.
 *
 * `toNumber` is the single conversion mechanism — every route returning a
 * money field must run it through here rather than reimplementing `Number(...)`
 * ad hoc.
 */

interface Decimalish {
  toString(): string;
}

function isDecimalish(v: unknown): v is Decimalish {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toString?: unknown }).toString === "function" &&
    (v as object).constructor?.name === "Decimal"
  );
}

/**
 * Coerce a value that may be a `number`, a numeric `string`, a
 * `Prisma.Decimal`-like object, or `null`/`undefined` into a plain `number`.
 *
 * `null`/`undefined` convert to `0` (matching the existing `?? 0` fallback
 * convention used across `pricing.ts`). Anything else that cannot be parsed
 * as a finite number throws — silently returning `NaN` would just move the
 * corruption downstream instead of fixing it.
 */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error(`toNumber: non-finite number ${v}`);
    }
    return v;
  }
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      throw new Error(`toNumber: cannot convert string "${v}" to a number`);
    }
    return n;
  }
  if (isDecimalish(v)) {
    return toNumber(v.toString());
  }
  throw new Error(`toNumber: cannot convert value of type ${typeof v}`);
}

/** Coerce only when the value is present; preserves `null`/`undefined` as-is. */
export function toNumberOrNull(
  v: unknown,
): number | null | undefined {
  if (v === null) return null;
  if (v === undefined) return undefined;
  return toNumber(v);
}
