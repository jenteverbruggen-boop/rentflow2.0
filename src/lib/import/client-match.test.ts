import { describe, it, expect } from "vitest";
import {
  resolveClientMatchKey,
  resolveClientMatchField,
  indexExistingClientsByMatchKey,
  findExistingClientMatch,
  type ClientMatchable,
} from "@/lib/import/client-match";

function row(overrides: Partial<ClientMatchable> = {}): ClientMatchable {
  return { id: null, name: "Acme BV", email: null, vatNumber: null, ...overrides };
}

describe("resolveClientMatchKey / resolveClientMatchField — fallback chain (B4, round 3 PO feedback)", () => {
  it("uses id when present, regardless of other fields", () => {
    const r = row({ id: 5, vatNumber: "BE0123456789", email: "info@acme.be" });
    expect(resolveClientMatchKey(r)).toBe(5);
    expect(resolveClientMatchField(r)).toBe("id");
  });

  it("falls back to normalized VAT number when id is absent", () => {
    const r = row({ vatNumber: "BE 0123.456.789", email: "info@acme.be" });
    expect(resolveClientMatchKey(r)).toBe("vatNumber:BE0123456789");
    expect(resolveClientMatchField(r)).toBe("vatNumber");
  });

  it("falls back to normalized email when id and VAT are both absent", () => {
    const r = row({ email: "  Info@Acme.BE  " });
    expect(resolveClientMatchKey(r)).toBe("email:info@acme.be");
    expect(resolveClientMatchField(r)).toBe("email");
  });

  it("falls back to normalized name when id, VAT and email are all absent", () => {
    const r = row({ name: "  Acme   BV " });
    expect(resolveClientMatchKey(r)).toBe("name:acme bv");
    expect(resolveClientMatchField(r)).toBe("name");
  });
});

describe("indexExistingClientsByMatchKey / findExistingClientMatch", () => {
  const existing: ClientMatchable[] = [
    { id: 1, name: "Acme BV", email: "info@acme.be", vatNumber: "BE0123456789" },
    { id: 2, name: "Other NV", email: null, vatNumber: null },
  ];

  it("indexes an existing client under id, vat, email and name simultaneously", () => {
    const indexed = indexExistingClientsByMatchKey(existing);
    expect(indexed.get(1)?.name).toBe("Acme BV");
    expect(indexed.get("vatNumber:BE0123456789")?.name).toBe("Acme BV");
    expect(indexed.get("email:info@acme.be")?.name).toBe("Acme BV");
    expect(indexed.get("name:acme bv")?.name).toBe("Acme BV");
  });

  it("findExistingClientMatch matches a foreign row with no id via VAT number", () => {
    const incoming = row({ vatNumber: "be 0123 456 789", name: "Acme (import)" });
    const match = findExistingClientMatch(incoming, existing);
    expect(match?.id).toBe(1);
  });

  it("findExistingClientMatch matches via email when VAT is absent", () => {
    const incoming = row({ email: "INFO@ACME.BE" });
    const match = findExistingClientMatch(incoming, existing);
    expect(match?.id).toBe(1);
  });

  it("findExistingClientMatch matches via name as the last resort", () => {
    const incoming = row({ name: "acme bv" });
    const match = findExistingClientMatch(incoming, existing);
    expect(match?.id).toBe(1);
  });

  it("findExistingClientMatch returns null when nothing matches", () => {
    const incoming = row({ name: "Brand New Client" });
    const match = findExistingClientMatch(incoming, existing);
    expect(match).toBeNull();
  });

  // This is the actual user-facing bug from the round-3 report: a
  // foreign export never carries our internal id, so `matchKey` used to
  // be `row.id` alone — always null for such a file — and
  // pipeline.ts drops null keys from its lookup, so *every* row of
  // *every* re-import classified as "new". Re-importing the same
  // foreign file twice must classify the second pass as an update, not
  // a duplicate create.
  it("re-importing the same id-less foreign row a second time is an update, not a duplicate create", () => {
    const firstImportRow = row({ vatNumber: "BE 0123.456.789", name: "Acme BV", email: "info@acme.be" });
    // First import: nothing in the DB yet.
    const beforeAnyImport: ClientMatchable[] = [];
    expect(findExistingClientMatch(firstImportRow, beforeAnyImport)).toBeNull();

    // Simulate that first import having created the client.
    const afterFirstImport: ClientMatchable[] = [{ id: 1, name: "Acme BV", email: "info@acme.be", vatNumber: "BE0123456789" }];

    // Re-importing the exact same file (same row, no id) must now match
    // the client the first import created, not create a duplicate.
    const secondImportRow = row({ vatNumber: "BE 0123.456.789", name: "Acme BV", email: "info@acme.be" });
    const match = findExistingClientMatch(secondImportRow, afterFirstImport);
    expect(match?.id).toBe(1);
  });
});
