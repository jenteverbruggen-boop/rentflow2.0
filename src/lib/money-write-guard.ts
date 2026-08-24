import type { ResolvedAccess } from "@/lib/api-auth";
import { satisfies } from "@/lib/modules";
import { toNumber } from "@/lib/serialize";
import { moneyVisible } from "@/lib/redact";

const MONEY_WRITE_FIELDS = ["dayPrice", "setupCost", "bundlePriceOverride", "costPrice", "listPrice", "revenueBefore"] as const;

/**
 * Normalises one side of a money-field comparison — a raw request-body
 * value (`number | string | null | undefined`) or a persisted DB value
 * (`number | Prisma.Decimal | null | undefined`) — to a plain
 * `number | null` so a Decimal(150) compares equal to a submitted `150`,
 * not merely by object identity.
 *
 * Never throws: `toNumber` rejects genuinely unparseable input (e.g. a
 * body tampered with `dayPrice: "abc"`), and letting that escape here
 * would turn a permission check into an uncaught 500. `NaN` is returned
 * instead — `NaN !== NaN` in JS, so any comparison involving it always
 * reads as "differs", which fails *closed* (the write is rejected) on
 * malformed input rather than accidentally waving it through.
 */
function normalizeMoney(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  try {
    return toNumber(v);
  } catch {
    return NaN;
  }
}

/**
 * Generic per-field check: reject a request body that writes any of
 * `fields` unless the caller holds Kosten/Facturen: wijzigen.
 *
 * Two modes, selected by whether `current` is passed — and the
 * money-blind bypass (a caller for whom `moneyVisible(access)` is false,
 * per redact.ts) applies to only one of them:
 *
 * - `current` omitted (undefined) — legacy strict-presence check: any
 *   `fields` key present in `body` is rejected, for every caller without
 *   :wijzigen regardless of money visibility. Correct for the booking
 *   PATCH endpoints (periods/[id]/{materials,people}/[assignmentId]):
 *   they only ever send a field when the user actively edits it via a
 *   dedicated, Kosten/Facturen-gated control (BookingDiscountPopover,
 *   LinePricePopover) — so presence alone means "attempted write" there
 *   for a money-blind caller exactly as much as a money-visible one, and
 *   those two routes have no `moneyFieldsToIgnore`-style write-side
 *   stripping to fall back on, so bypassing the reject would let the
 *   value through with nothing left to stop it being written.
 * - `current` passed (an object, or `null` for "nothing persisted yet") —
 *   diff-aware check: a `fields` key present in `body` is only rejected
 *   when it actually *differs* from `current[field]` (or from
 *   `defaults[field]` — falling back to `null` — when `current` is
 *   `null` or lacks that key). `findRejectedMoneyWrite` below always
 *   uses this mode. Every money-bearing form calling into it
 *   (PersonForm, MaterialForm, FunctionFormDialog) resubmits its money
 *   inputs on every save, redacted to `0`/`null` for a money-blind
 *   caller — so for that caller the submitted value is always a
 *   redaction artefact, never a genuine change, and the diff is skipped
 *   entirely. Only half the fix: "not rejected" isn't "safe to write
 *   as-is" — every diff-aware write site must also use
 *   `moneyFieldsToIgnore` below to keep the artefact out of the write.
 */
export function findRejectedField(
  body: Record<string, unknown>,
  access: ResolvedAccess,
  fields: readonly string[],
  current?: Record<string, unknown> | null,
  defaults: Record<string, unknown> = {},
): string | null {
  const held = access.permissions.kosten_facturen ?? "geen";
  if (satisfies(held, "wijzigen")) return null;
  for (const field of fields) {
    if (body[field] === undefined) continue;
    // Legacy strict-presence mode: no money-blind bypass here (see the
    // doc comment above) — presence is a real attempted write regardless
    // of money visibility, and there is no write-side stripping to fall
    // back on for these callers.
    if (current === undefined) return field;
    // Diff-aware mode: skip the diff for a money-blind caller (doc
    // comment above) — moneyFieldsToIgnore keeps it off the write.
    if (!moneyVisible(access)) continue;
    const baseline = current && field in current ? current[field] : defaults[field] ?? null;
    if (normalizeMoney(body[field]) !== normalizeMoney(baseline)) return field;
  }
  return null;
}

// dayPrice's own schema default is 0 (Person.dayPrice / Material.dayPrice
// both `@default(0)`), not null — a freshly-created record with the
// form's own untouched default of 0 must compare equal to "nothing set",
// not to null. setupCost/bundlePriceOverride/dayRate/hourRate all default
// to null already (findRejectedField's `?? null` fallback), so only
// dayPrice needs an explicit entry here.
const MONEY_WRITE_DEFAULTS: Record<string, unknown> = { dayPrice: 0 };

/**
 * For write endpoints (people/[id], materials/[id]): reject a request
 * body that attempts to *change* a money field without Kosten/Facturen:
 * wijzigen.
 *
 * Every money-bearing form here (PersonForm, MaterialForm) is a
 * full-record form — it always submits `dayPrice`, `setupCost`, etc.
 * whether or not the user touched them — so a presence-only check would
 * block a caller with e.g. `personen: wijzigen` but not
 * `kosten_facturen: wijzigen` from saving *any* edit to a person, not
 * just a money edit. Fixed by comparing the submitted value against what
 * is already true — the persisted row via `current` for an update, or
 * the field's own schema default when `current` is omitted/`null` (a
 * create) — and rejecting only an actual change. Always passes an
 * explicit `current` (never `undefined`) so this never falls back to
 * `findRejectedField`'s legacy strict-presence mode.
 *
 * A money-blind caller never had a true value to echo in the first
 * place — see `findRejectedField`'s diff-aware bypass above, and
 * `moneyFieldsToIgnore` below for the matching write-side half.
 */
export function findRejectedMoneyWrite(
  body: Record<string, unknown>,
  access: ResolvedAccess,
  current?: Record<string, unknown> | null,
): string | null {
  return findRejectedField(body, access, MONEY_WRITE_FIELDS, current ?? null, MONEY_WRITE_DEFAULTS);
}

/**
 * The write-side half of the money-blind fix (see `findRejectedField`'s
 * doc comment for the read/reject-side half). Returns the subset of
 * `fields` a write endpoint must leave out of its Prisma `data` entirely
 * — never assign from `body`, regardless of what it says — because the
 * caller cannot see money at all.
 *
 * Omission, not "write the default": for an UPDATE, Prisma only touches
 * columns present as keys in `data`, so leaving a key out means the
 * persisted value survives untouched — the caller's redacted `0`/`null`
 * must not overwrite a real `450`. For a CREATE nothing is persisted
 * yet, so omitting the key and letting the column's own schema default
 * apply is exactly the outcome a money-blind caller's meaningless input
 * should produce anyway.
 *
 * Empty `Set` when `moneyVisible(access)` is true: that caller remains
 * governed solely by findRejectedMoneyWrite/findRejectedField.
 */
export function moneyFieldsToIgnore(
  access: ResolvedAccess,
  fields: readonly string[],
): Set<string> {
  if (moneyVisible(access)) return new Set();
  return new Set(fields);
}
