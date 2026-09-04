import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { PersonLinkSuggestion } from "@/types";

function normalise(email: string | null): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Linking a user to a person is deliberately not a requirement, so this
 * never links anything by itself — it only surfaces the cases an admin
 * would almost certainly want to confirm.
 *
 * "Almost certainly" is kept narrow on purpose: a case-insensitive exact
 * e-mail match, and only when that address is unambiguous on both sides.
 * A wrong link is not cosmetic — a `scope: own` role filters its entire
 * view through `personId`, so mislinking would show one person another
 * person's bookings. Names are never compared: two people called "Marc
 * Maes" are a realistic roster, a shared mailbox is not.
 */
export async function findPersonLinkSuggestions(
  client: PrismaClient = defaultPrisma,
): Promise<PersonLinkSuggestion[]> {
  const [users, people] = await Promise.all([
    client.user.findMany({
      where: { personId: null },
      select: { id: true, name: true, email: true },
    }),
    client.person.findMany({
      where: { userAccount: null },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const peopleByEmail = new Map<string, { id: number; name: string }[]>();
  for (const person of people) {
    const key = normalise(person.email);
    if (!key) continue;
    const bucket = peopleByEmail.get(key);
    if (bucket) bucket.push(person);
    else peopleByEmail.set(key, [person]);
  }

  const userCountByEmail = new Map<string, number>();
  for (const user of users) {
    const key = normalise(user.email);
    if (key) userCountByEmail.set(key, (userCountByEmail.get(key) ?? 0) + 1);
  }

  const suggestions: PersonLinkSuggestion[] = [];
  for (const user of users) {
    const key = normalise(user.email);
    if (!key || userCountByEmail.get(key) !== 1) continue;
    const matches = peopleByEmail.get(key);
    if (matches?.length !== 1) continue;
    suggestions.push({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      personId: matches[0].id,
      personName: matches[0].name,
    });
  }
  return suggestions;
}
