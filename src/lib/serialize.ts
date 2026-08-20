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

/**
 * Structural check for a `Prisma.Decimal` (decimal.js) instance.
 *
 * This used to check `v.constructor.name === "Decimal"`, which broke in
 * production only: when the generated Prisma client's own module graph
 * gets bundled together with anything else that also defines a class
 * named `Decimal` (as happens here — reproduced by bundling
 * src/generated/prisma with esbuild, mirroring what Turbopack does at
 * `next build` time), the bundler renames the collision to `Decimal2`
 * to keep the two distinct in one scope. `v.constructor.name` then reads
 * "Decimal2", the string check fails, and every Decimal value looks like
 * a plain, un-convertible object — silently 500ing every route that
 * serializes real (non-null) money data. Dev/CI never caught this: the
 * SQLite dev schema types money fields `Float` (plain numbers), so this
 * branch is only ever exercised against genuine Postgres Decimal values,
 * and only once real (not just seeded-null) data flows through it.
 *
 * Checking decimal.js's actual instance shape instead — sign/exponent/
 * digits (`s`/`e`/`d`) plus its `toFixed` API — survives renaming, since
 * none of that depends on the class's printable name.
 */
function isDecimalish(v: unknown): v is Decimalish {
  if (typeof v !== "object" || v === null) return false;
  const d = v as {
    toString?: unknown;
    toFixed?: unknown;
    s?: unknown;
    e?: unknown;
    d?: unknown;
  };
  return (
    typeof d.toString === "function" &&
    typeof d.toFixed === "function" &&
    typeof d.s === "number" &&
    typeof d.e === "number" &&
    Array.isArray(d.d)
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
