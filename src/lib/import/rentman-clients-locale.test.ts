import { describe, it, expect } from "vitest";
import { detectEntityFormat } from "@/lib/import/format-detection";
import { normalizeRentmanClientsLocale, looksLikeRentmanClientExport } from "@/lib/import/rentman-clients-locale";
import { clientAdapter } from "@/lib/import/adapters/client";

describe("looksLikeRentmanClientExport (B4, round 3 PO feedback)", () => {
  it("recognises a guessed Dutch relations export by its headers", () => {
    expect(looksLikeRentmanClientExport(["Naam", "Btw-nummer", "Postcode"])).toBe(true);
  });

  it("is case-insensitive, whitespace-tolerant and diacritic-tolerant", () => {
    expect(looksLikeRentmanClientExport(["  NAAM  ", "Contactpersoon"])).toBe(true);
    expect(looksLikeRentmanClientExport(["Emailadres", "Woonplaats"])).toBe(true);
  });

  it("does not fire on RentFlow's own camelCase export headers", () => {
    expect(looksLikeRentmanClientExport(["name", "contactName", "email", "vatNumber"])).toBe(false);
  });

  it("does not fire on a single coincidental match", () => {
    expect(looksLikeRentmanClientExport(["Stad"])).toBe(false);
  });
});

describe("normalizeRentmanClientsLocale", () => {
  it("translates a guessed Dutch header set to the canonical names", () => {
    const headers = ["Naam", "Contactpersoon", "E-mailadres", "Telefoon", "Adres", "Postcode", "Plaats", "Btw-nummer"];
    const row = {
      Naam: "Acme BV",
      Contactpersoon: "Jan Janssens",
      "E-mailadres": "info@acme.be",
      Telefoon: "012345678",
      Adres: "Kerkstraat 1",
      Postcode: "9000",
      Plaats: "Gent",
      "Btw-nummer": "BE0123456789",
    };
    const { headers: canonical, rows } = normalizeRentmanClientsLocale(headers, [row]);
    expect(canonical).toEqual(["Name", "Contact person", "Email", "Phone", "Address", "Postal code", "City", "VAT number"]);
    expect(rows[0]).toEqual({
      Name: "Acme BV",
      "Contact person": "Jan Janssens",
      Email: "info@acme.be",
      Phone: "012345678",
      Address: "Kerkstraat 1",
      "Postal code": "9000",
      City: "Gent",
      "VAT number": "BE0123456789",
    });
  });

  it("is a no-op on RentFlow's own lower-camel headers", () => {
    const headers = ["name", "contactName", "email", "vatNumber"];
    const row = { name: "Acme BV", contactName: "Jan", email: "info@acme.be", vatNumber: "BE0123456789" };
    const result = normalizeRentmanClientsLocale(headers, [row]);
    expect(result.headers).toEqual(headers);
    expect(result.rows).toEqual([row]);
  });

  it("end-to-end: the translated headers are detected as rentman-clients and parse into a ParsedClientRow", () => {
    const headers = ["Naam", "Btw-nummer", "Postcode", "Plaats"];
    const row = { Naam: "Acme BV", "Btw-nummer": "BE0123456789", Postcode: "9000", Plaats: "Gent" };
    const { headers: canonical, rows } = normalizeRentmanClientsLocale(headers, [row]);
    const format = detectEntityFormat(canonical, clientAdapter.acceptedFormats, clientAdapter.requiredHeaders);
    expect(format).toBe("rentman-clients");

    const { parsed, errors } = clientAdapter.parseRows(rows, format);
    expect(errors).toHaveLength(0);
    expect(parsed[0]).toMatchObject({ id: null, name: "Acme BV", vatNumber: "BE0123456789", postalCode: "9000", city: "Gent" });
  });
});
