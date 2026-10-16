import { type IcsEvent } from "@/lib/ics";

/**
 * A period entered through the form carries real hours — period-form.tsx
 * binds a `datetime-local` input and defaults to 08:00–17:00 — so its
 * stored UTC instant is already the right moment and `…Z` renders
 * correctly everywhere. Legacy and imported periods instead encode a
 * whole-day window as bare midnight-UTC boundaries
 * (`2026-06-01T00:00:00Z` → `2026-06-06T23:59:59Z`), and serialising
 * *those* as timestamps is what made a Brussels client show "1 Jun 02:00
 * → 7 Jun 01:59" for a 1–6 June period. Recognising that shape and
 * emitting a whole-day event fixes the skew without reinterpreting any
 * period that states a genuine time.
 */
function isUtcMidnight(date: Date): boolean {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

/** `23:59:59` — the other shape a whole-day end boundary takes. */
function isUtcLastSecondOfDay(date: Date): boolean {
  return date.getUTCHours() === 23 && date.getUTCMinutes() === 59 && date.getUTCSeconds() === 59;
}

type LocationRel = { name: string; address?: string | null; postalCode?: string | null; city?: string | null };

/** "Zaal Ommegang, Markt 1, 9000 Gent" — name, street, then postcode + city,
 * skipping whatever is empty. */
function formatLocation(rel: LocationRel): string {
  const town = [rel.postalCode, rel.city].filter(Boolean).join(" ");
  return [rel.name, rel.address, town].filter(Boolean).join(", ");
}

export function eventFromPeriod(period: {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  updatedAt: Date;
  project: { name: string; location: string | null; locationRel: LocationRel | null };
}, assignment?: { startAt: Date | null; endAt: Date | null; function?: { name: string } | null },
  /** Personal feed only: a full address and the period's material list. */
  extras?: { materialLines?: string[]; fullAddress?: boolean }): IcsEvent {
  // H1 — use the assignment's own hours when set, else the period window.
  const start = assignment?.startAt ?? period.startDate;
  const end = assignment?.endAt ?? period.endDate;
  // The end boundary is read as the inclusive last day of a whole-day
  // window — a "tot 31 juli" period covers the 31st.
  const allDay = isUtcMidnight(start) && (isUtcMidnight(end) || isUtcLastSecondOfDay(end));
  const rel = period.project.locationRel;
  const location =
    extras?.fullAddress && rel ? formatLocation(rel) : (rel?.name ?? period.project.location);
  const descriptionParts = [`Project: ${period.project.name}`, `Periode: ${period.name}`];
  if (assignment?.function?.name) descriptionParts.push(`Functie: ${assignment.function.name}`);
  if (extras?.materialLines?.length) {
    descriptionParts.push("", "Materiaal:", ...extras.materialLines.map((l) => `- ${l}`));
  }
  return {
    uid: `period-${period.id}@rentflow.app`,
    // Derived from Period.updatedAt (O1.1) — neither Period nor Project
    // carries a small sequential revision counter, so the timestamp
    // (seconds since epoch) stands in; it only needs to increase on
    // every edit, which it does by construction.
    sequence: Math.floor(period.updatedAt.getTime() / 1000),
    summary: `${period.project.name} - ${period.name}`,
    location,
    description: descriptionParts.join("\n"),
    start,
    end,
    allDay,
  };
}
