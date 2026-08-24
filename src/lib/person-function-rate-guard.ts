import type { ResolvedAccess } from "@/lib/api-auth";
import { findRejectedField, moneyFieldsToIgnore } from "@/lib/money-write-guard";

export const RATE_FIELDS = ["dayRate", "hourRate"] as const;

export interface FunctionRateInput {
  functionId: number;
  dayRate?: number | null;
  hourRate?: number | null;
}

/**
 * Diff-aware Kosten/Facturen guard for a person's per-function rate
 * overrides (PersonFunction.dayRate/hourRate) — the same shape as
 * findRejectedMoneyWrite, but applied per assignment row rather than to
 * one flat body, since each function chip carries its own rate pair.
 * `currentByFunctionId` should hold only the row's *existing* persisted
 * rates (a brand-new assignment on this save has no entry, and diffs
 * against `null` — findRejectedField's create-time default, matching
 * PersonFunction's own schema default for both columns).
 *
 * This closes a gap that predates the money-blind fix entirely: POST/PUT
 * /api/people never checked these two fields at all, only the top-level
 * dayPrice — a caller without Kosten/Facturen: wijzigen could set an
 * arbitrary per-function rate override with no guard whatsoever.
 */
export function findRejectedFunctionRate(
  functions: FunctionRateInput[],
  access: ResolvedAccess,
  currentByFunctionId: Map<number, { dayRate: unknown; hourRate: unknown }>,
): string | null {
  for (const f of functions) {
    const current = currentByFunctionId.get(f.functionId) ?? null;
    const rejected = findRejectedField(
      { dayRate: f.dayRate, hourRate: f.hourRate },
      access,
      RATE_FIELDS,
      current,
    );
    if (rejected) return rejected;
  }
  return null;
}

/**
 * The write-side counterpart: the subset of {dayRate, hourRate} to
 * actually assign for one function row's create/update data, given the
 * caller's money visibility — see moneyFieldsToIgnore's doc comment.
 * Includes a field the caller may write (with its own `?? null`
 * default); omits a field the caller cannot see at all so an UPDATE
 * leaves it untouched and a CREATE falls back to PersonFunction's own
 * null default.
 */
export function personFunctionRateData(
  f: FunctionRateInput,
  access: ResolvedAccess,
): Record<string, unknown> {
  const ignore = moneyFieldsToIgnore(access, RATE_FIELDS);
  const data: Record<string, unknown> = {};
  if (!ignore.has("dayRate")) data.dayRate = f.dayRate ?? null;
  if (!ignore.has("hourRate")) data.hourRate = f.hourRate ?? null;
  return data;
}
