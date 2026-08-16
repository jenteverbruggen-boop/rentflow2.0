import { periodDays } from "@/lib/pricing";
import type { Period } from "@/types";

export interface PersonUtilisationEntry {
  personId: number;
  name: string;
  bookedDays: number;
  bookedHours: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** K1.1 — day-billed assignments (or any assignment with no custom
 * hours window, H1's Q19 fallback) count toward `bookedDays`; an
 * hourly assignment with a real startAt/endAt window counts its actual
 * hours toward `bookedHours` instead — mirrors personLineCost's own
 * billing-unit branch (pricing.ts), never recomputed differently here. */
export function aggregatePersonUtilisation(periods: Period[]): PersonUtilisationEntry[] {
  const byPerson = new Map<number, PersonUtilisationEntry>();

  for (const period of periods) {
    const days = periodDays(period);
    for (const pp of period.people) {
      const entry = byPerson.get(pp.personId) ?? {
        personId: pp.personId, name: pp.person.name, bookedDays: 0, bookedHours: 0,
      };
      const hourly = pp.billingUnit === "uur" && pp.startAt && pp.endAt;
      if (hourly) {
        const hours = (new Date(pp.endAt as string).getTime() - new Date(pp.startAt as string).getTime()) / 3_600_000;
        entry.bookedHours += hours;
      } else {
        entry.bookedDays += days;
      }
      byPerson.set(pp.personId, entry);
    }
  }

  return [...byPerson.values()]
    .map((e) => ({ ...e, bookedDays: round(e.bookedDays), bookedHours: round(e.bookedHours) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
