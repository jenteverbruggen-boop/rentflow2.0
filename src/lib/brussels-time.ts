/**
 * Construct the UTC instant for a given wall-clock hour/minute on a date, in
 * the Europe/Brussels timezone — without a timezone library (Node ships
 * full ICU, so Intl.DateTimeFormat already knows Brussels' CET/CEST rules).
 *
 * Needed because the server has no reliable "local" timezone of its own
 * (it may run in UTC regardless of where the PO's users physically are —
 * per the project's Time rule, never assume the server sits at local
 * midnight). `dateOnly` is expected to be a UTC-midnight Date representing
 * just a calendar date (e.g. how project.startDate/endDate are stored),
 * not a real moment in time.
 */
export function brusselsWallClockToUtc(
  dateOnly: Date,
  hour: number,
  minute: number,
): Date {
  const y = dateOnly.getUTCFullYear();
  const m = dateOnly.getUTCMonth();
  const d = dateOnly.getUTCDate();

  // Guess the instant as if hour/minute were already UTC, then measure how
  // far Brussels' local clock actually is from UTC at that guess — DST
  // means this offset is +1h (CET) or +2h (CEST) depending on the date.
  const guessUtc = new Date(Date.UTC(y, m, d, hour, minute));
  const offsetMinutes = brusselsOffsetMinutes(guessUtc);
  return new Date(guessUtc.getTime() - offsetMinutes * 60_000);
}

function brusselsOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Brussels",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - date.getTime()) / 60_000;
}
