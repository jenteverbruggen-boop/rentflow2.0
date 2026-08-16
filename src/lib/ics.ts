/**
 * O1.2 — a minimal, hand-rolled RFC 5545 iCalendar generator. Nothing in
 * the repo emits iCalendar today and no library is installed; the format
 * is line-oriented text and one VEVENT per period is modest enough to
 * hand-roll rather than add a dependency for.
 */

export interface IcsEvent {
  /** Stable per period (RFC 5545 §3.8.4.7) — never regenerate per poll. */
  uid: string;
  /** Monotonically increasing per revision (RFC 5545 requirement). */
  sequence: number;
  summary: string;
  location?: string | null;
  description?: string | null;
  /** UTC start/end. */
  start: Date;
  end: Date;
}

/**
 * RFC 5545 §3.1 — no content line may exceed 75 **octets** (byte length,
 * not character count — a multi-byte UTF-8 character counts as its byte
 * length). A longer line is folded by inserting CRLF followed by a single
 * space; the reader unfolds by stripping `CRLF + one whitespace`.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.byteLength <= 75) return line;

  const chunks: string[] = [];
  let offset = 0;
  let limit = 75;
  while (offset < bytes.byteLength) {
    // Never split a multi-byte UTF-8 sequence in the middle — back off
    // the chunk boundary until it lands on a byte that isn't a
    // continuation byte (top two bits `10`).
    let end = Math.min(offset + limit, bytes.byteLength);
    while (end < bytes.byteLength && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(bytes.subarray(offset, end).toString("utf8"));
    offset = end;
    limit = 74; // continuation lines are folded with one leading space
  }
  return chunks.join("\r\n ");
}

/** RFC 5545 §3.3.11 — comma, semicolon and backslash are escaped; a
 * literal newline inside a text value is the two characters `\n`, not a
 * real line break (a real CRLF here would itself need folding and would
 * corrupt the field). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const VTIMEZONE_BRUSSELS = `BEGIN:VTIMEZONE
TZID:Europe/Brussels
X-LIC-LOCATION:Europe/Brussels
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

/** Builds a full VCALENDAR document — CRLF-terminated, folded at 75
 * octets, every line, per RFC 5545 §3.1. `now` is passed in (never
 * `new Date()`/`Date.now()` internally) so callers control DTSTAMP. */
export function buildIcsCalendar(events: IcsEvent[], now: Date): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RentFlow//Calendar Feed//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE_BRUSSELS.split("\n"),
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${formatUtc(now)}`,
      `DTSTART:${formatUtc(event.start)}`,
      `DTEND:${formatUtc(event.end)}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    lines.push(`SEQUENCE:${event.sequence}`, "STATUS:CONFIRMED", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
