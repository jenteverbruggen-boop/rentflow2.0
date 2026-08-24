import { describe, it, expect } from "vitest";
import { canHardDeleteFunction, functionDeleteBlockedMessage } from "./function-deletable";

describe("canHardDeleteFunction", () => {
  it("allows a hard delete when the function is used nowhere", () => {
    expect(canHardDeleteFunction({ people: 0, assignments: 0, clientRates: 0 })).toBe(true);
  });

  it("blocks a hard delete when it is assigned to at least one person", () => {
    expect(canHardDeleteFunction({ people: 1, assignments: 0, clientRates: 0 })).toBe(false);
  });

  // The critical case the old guard missed entirely: PersonFunction count
  // (people) could be 0 while PeriodPerson.functionId (assignments) still
  // points at the function — historical/invoiced bookings, not current
  // crew assignments. Hard-deleting here would SetNull those bookings.
  it("blocks a hard delete when there are booking assignments even with zero people", () => {
    expect(canHardDeleteFunction({ people: 0, assignments: 1, clientRates: 0 })).toBe(false);
  });

  it("blocks a hard delete when a client rate references it", () => {
    expect(canHardDeleteFunction({ people: 0, assignments: 0, clientRates: 1 })).toBe(false);
  });

  it("blocks a hard delete when all three usages are non-zero", () => {
    expect(canHardDeleteFunction({ people: 2, assignments: 3, clientRates: 1 })).toBe(false);
  });
});

describe("functionDeleteBlockedMessage", () => {
  it("names a single blocking usage with correct Dutch singular", () => {
    const msg = functionDeleteBlockedMessage({ people: 1, assignments: 0, clientRates: 0 });
    expect(msg).toContain("1 persoon");
    expect(msg).not.toContain("personen");
    expect(msg).toContain("Archiveer");
  });

  it("names multiple blocking usages with correct Dutch plurals", () => {
    const msg = functionDeleteBlockedMessage({ people: 2, assignments: 5, clientRates: 1 });
    expect(msg).toContain("2 personen");
    expect(msg).toContain("5 boekingen");
    expect(msg).toContain("1 klanttarief");
  });

  it("only names assignments when that is the sole blocker", () => {
    const msg = functionDeleteBlockedMessage({ people: 0, assignments: 3, clientRates: 0 });
    expect(msg).toContain("3 boekingen");
    expect(msg).not.toContain("persoon");
    expect(msg).not.toContain("klanttarie");
  });
});
