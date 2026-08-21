import { prisma } from "@/lib/prisma";

interface PersonLinkOk {
  personId: number | null;
}

interface PersonLinkError {
  error: string;
}

/**
 * Validate a `personId` assignment against the Person table (F3 follow-up
 * — the schema/API side of "link a User to a Person" landed in round 1,
 * but nothing ever validated the target existed before this: an
 * unvalidated `personId` for a Person that doesn't exist hit the FK
 * constraint and surfaced as a raw 500, not a `badRequest`).
 *
 * `null` explicitly unlinks — mirrors `resolveRoleAssignment`'s "undefined
 * means leave untouched" contract, so a PATCH that omits `personId`
 * entirely never touches the existing link.
 *
 * Returns null when personId is not present in the input (caller should
 * leave the field untouched).
 */
export async function resolvePersonLink(input: {
  personId?: unknown;
}): Promise<PersonLinkOk | PersonLinkError | null> {
  if (input.personId === undefined) return null;
  if (input.personId === null) return { personId: null };
  const personId = Number(input.personId);
  if (!Number.isInteger(personId)) {
    return { error: "personId is ongeldig" };
  }
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) return { error: "Deze persoon bestaat niet" };
  return { personId: person.id };
}
