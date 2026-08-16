import { describe, it, expect } from "vitest";
import { formatInvoiceNumber, brusselsYear } from "@/lib/invoice-numbering";

describe("formatInvoiceNumber (J2b.3)", () => {
  it("applies the default template", () => {
    expect(formatInvoiceNumber("{year}-{seq:04d}", "invoice", 2026, 1)).toBe("2026-0001");
  });

  it("pads to the requested width", () => {
    expect(formatInvoiceNumber("{year}-{seq:04d}", "invoice", 2026, 42)).toBe("2026-0042");
  });

  it("a credit note gets CN- prepended to the same template's output, never a second setting", () => {
    expect(formatInvoiceNumber("{year}-{seq:04d}", "credit", 2026, 1)).toBe("CN-2026-0001");
  });

  it("a plain {seq} with no padding works too", () => {
    expect(formatInvoiceNumber("{year}/{seq}", "invoice", 2026, 7)).toBe("2026/7");
  });
});

describe("brusselsYear (J2b.3)", () => {
  it("reads the Brussels-local calendar year regardless of the instant's own UTC date", () => {
    // 2025-12-31T23:30:00Z is already 2026-01-01 00:30 CET in Brussels.
    expect(brusselsYear(new Date("2025-12-31T23:30:00Z"))).toBe(2026);
  });

  it("a mid-year instant needs no timezone crossing to get the obvious answer", () => {
    expect(brusselsYear(new Date("2026-06-15T12:00:00Z"))).toBe(2026);
  });
});
