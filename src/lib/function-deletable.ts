/**
 * Pure "can this Function be hard-deleted?" decision, extracted out of
 * `DELETE /api/functions/[id]` so it is unit-testable without a database.
 *
 * The old guard only checked `_count.people` (PersonFunction rows) and
 * ignored `PeriodPerson.assignments` entirely. `PeriodPerson.functionId`
 * has no `onDelete` specified in schema.prisma (schema.prisma:327), so
 * Prisma defaults to `SetNull` — a hard delete that slipped past the old
 * guard would silently null out the function on every historical
 * (possibly already-invoiced) booking that referenced it. A function is
 * only ever safe to hard-delete when NOTHING references it: zero
 * PersonFunction rows, zero PeriodPerson assignments, and zero
 * ClientFunctionRate rows. Anything else must be archived instead.
 */
export interface FunctionUsage {
  people: number;
  assignments: number;
  clientRates: number;
}

/** True only when the function is referenced nowhere at all. */
export function canHardDeleteFunction(usage: FunctionUsage): boolean {
  return usage.people === 0 && usage.assignments === 0 && usage.clientRates === 0;
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Dutch, user-facing 409 message naming the actual counts that block a
 * hard delete, and pointing the user at archiving instead. Only
 * meaningful when `canHardDeleteFunction(usage)` is false.
 */
export function functionDeleteBlockedMessage(usage: FunctionUsage): string {
  const parts: string[] = [];
  if (usage.people > 0) parts.push(pluralize(usage.people, "persoon", "personen"));
  if (usage.assignments > 0) parts.push(pluralize(usage.assignments, "boeking", "boekingen"));
  if (usage.clientRates > 0) parts.push(pluralize(usage.clientRates, "klanttarief", "klanttarieven"));
  return (
    `Functie kan niet verwijderd worden: gekoppeld aan ${parts.join(", ")}. ` +
    `Archiveer de functie in plaats daarvan.`
  );
}
