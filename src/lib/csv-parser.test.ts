import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvLine, detectCsvDelimiter } from "@/lib/csv-parser";

describe("detectCsvDelimiter (B4, round 3 PO feedback)", () => {
  it("picks comma when the header line has more commas than semicolons", () => {
    expect(detectCsvDelimiter("name,contactName,email")).toBe(",");
  });

  it("picks semicolon when the header line has more semicolons than commas", () => {
    expect(detectCsvDelimiter("naam;contactpersoon;email")).toBe(";");
  });

  it("defaults to comma on a tie (e.g. a single-column header with neither)", () => {
    expect(detectCsvDelimiter("name")).toBe(",");
  });

  it("ignores delimiter characters inside quoted spans", () => {
    // 3 real semicolons vs. 1 real comma outside quotes -> semicolon wins,
    // even though the quoted field itself contains a comma.
    expect(detectCsvDelimiter('"Naam, in database";Adres;Postcode;Plaats')).toBe(";");
  });
});

describe("parseCsvLine — delimiter parameter", () => {
  it("still defaults to comma when no delimiter is passed (back-compat)", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("splits on semicolon when passed explicitly", () => {
    expect(parseCsvLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
  });

  it("keeps a quoted field containing the active delimiter intact", () => {
    expect(parseCsvLine('"Kerkstraat 1; 9000 Gent";BE0123456789', ";")).toEqual([
      "Kerkstraat 1; 9000 Gent",
      "BE0123456789",
    ]);
  });

  it("keeps a quoted field containing a comma intact under the comma delimiter", () => {
    expect(parseCsvLine('"Doe, John",30')).toEqual(["Doe, John", "30"]);
  });
});

describe("parseCsv — end-to-end delimiter sniffing", () => {
  it("parses a comma-delimited file exactly as before (regression)", () => {
    const csv = "name,code,dayPrice\nTent,0501-001,95\n";
    expect(parseCsv(csv)).toEqual([{ name: "Tent", code: "0501-001", dayPrice: "95" }]);
  });

  it("parses a semicolon-delimited nl-BE export", () => {
    const csv = "naam;postcode;plaats\nAcme BV;9000;Gent\n";
    expect(parseCsv(csv)).toEqual([{ naam: "Acme BV", postcode: "9000", plaats: "Gent" }]);
  });

  it("parses a semicolon-delimited file whose fields contain commas (decimal separators)", () => {
    const csv = "naam;omzet\nAcme BV;1234,56\n";
    expect(parseCsv(csv)).toEqual([{ naam: "Acme BV", omzet: "1234,56" }]);
  });

  it("parses a quoted comma-containing address inside a semicolon-delimited file", () => {
    const csv = 'naam;adres;postcode\nAcme BV;"Kerkstraat 1, bus 2";9000\n';
    expect(parseCsv(csv)).toEqual([{ naam: "Acme BV", adres: "Kerkstraat 1, bus 2", postcode: "9000" }]);
  });
});
