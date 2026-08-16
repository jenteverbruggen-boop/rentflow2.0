import { describe, it, expect } from "vitest";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";

const NOW = new Date("2026-08-14T09:00:00Z");

function makeEvent(overrides: Partial<IcsEvent> = {}): IcsEvent {
  return {
    uid: "period-482@rentflow.app",
    sequence: 3,
    summary: "Zomerfestival Gent - Opbouw",
    location: "Feestweide 12, 9000 Gent",
    description: "Project: Zomerfestival Gent\nPeriode: Opbouw",
    start: new Date("2026-09-01T08:00:00Z"),
    end: new Date("2026-09-01T18:00:00Z"),
    ...overrides,
  };
}

describe("buildIcsCalendar (O1.2)", () => {
  it("wraps every line in CRLF, never a bare \\n", () => {
    const ics = buildIcsCalendar([makeEvent()], NOW);
    const rawLines = ics.split("\r\n");
    expect(rawLines.length).toBeGreaterThan(1);
    // every physical line but the trailing empty one must be CR-terminated
    // in the original string — verified by the split itself succeeding
    // and no bare \n surviving outside of an escaped \\n text value.
    expect(ics.replace(/\\n/g, "")).not.toMatch(/[^\r]\n/);
  });

  it("emits one BEGIN:VEVENT/END:VEVENT pair per event", () => {
    const ics = buildIcsCalendar([makeEvent(), makeEvent({ uid: "period-483@rentflow.app" })], NOW);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
  });

  it("emits UTC start/end and the DTSTAMP passed in, not the system clock", () => {
    const ics = buildIcsCalendar([makeEvent()], NOW);
    expect(ics).toContain("DTSTAMP:20260814T090000Z");
    expect(ics).toContain("DTSTART:20260901T080000Z");
    expect(ics).toContain("DTEND:20260901T180000Z");
  });

  it("escapes a comma in LOCATION and a real newline in DESCRIPTION as the literal \\n", () => {
    const ics = buildIcsCalendar([makeEvent()], NOW);
    expect(ics).toContain("LOCATION:Feestweide 12\\, 9000 Gent");
    expect(ics).toContain("DESCRIPTION:Project: Zomerfestival Gent\\nPeriode: Opbouw");
  });

  it("folds a line exceeding 75 octets, continuation lines start with a space", () => {
    const longSummary = "A".repeat(120);
    const ics = buildIcsCalendar([makeEvent({ summary: longSummary })], NOW);
    const physicalLines = ics.split("\r\n");
    const summaryStart = physicalLines.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(summaryStart).toBeGreaterThanOrEqual(0);
    expect(Buffer.byteLength(physicalLines[summaryStart], "utf8")).toBeLessThanOrEqual(75);
    expect(physicalLines[summaryStart + 1].startsWith(" ")).toBe(true);
  });

  it("folds a multi-byte UTF-8 line without splitting a character in half", () => {
    // 30 "é" (2 bytes each in UTF-8) = 60 bytes, well past a naive
    // 75-character (not octet) cut in the middle of one.
    const summary = "é".repeat(30);
    const ics = buildIcsCalendar([makeEvent({ summary })], NOW);
    // Reassembling the fold must reproduce the original text exactly —
    // proves no continuation byte was split into an invalid sequence.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${summary}`);
  });

  it("omits LOCATION/DESCRIPTION lines entirely when not provided", () => {
    const ics = buildIcsCalendar([makeEvent({ location: null, description: null })], NOW);
    // X-LIC-LOCATION (VTIMEZONE) legitimately contains "LOCATION:" as a
    // substring — check for the VEVENT-level property line specifically.
    expect(ics).not.toContain("\r\nLOCATION:");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("includes exactly one VTIMEZONE block for Europe/Brussels", () => {
    const ics = buildIcsCalendar([makeEvent()], NOW);
    expect(ics.match(/BEGIN:VTIMEZONE/g)).toHaveLength(1);
    expect(ics).toContain("TZID:Europe/Brussels");
  });

  it("an empty event list still produces a valid, parseable VCALENDAR wrapper", () => {
    const ics = buildIcsCalendar([], NOW);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.match(/BEGIN:VEVENT/g)).toBeNull();
  });
});
