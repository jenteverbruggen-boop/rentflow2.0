import { describe, it, expect } from "vitest";
import { findRejectedFunctionRate, personFunctionRateData } from "./person-function-rate-guard";
import type { ResolvedAccess } from "@/lib/api-auth";

function access(kostenLevel: string, scope: ResolvedAccess["scope"] = "all"): ResolvedAccess {
  return {
    id: 1,
    personId: null,
    scope,
    permissions: { kosten_facturen: kostenLevel as never },
  };
}

describe("findRejectedFunctionRate", () => {
  it("rejects a genuine rate change on a kept row without Kosten/Facturen: wijzigen (money-visible caller)", () => {
    const current = new Map([[1, { dayRate: 320, hourRate: null }]]);
    expect(
      findRejectedFunctionRate([{ functionId: 1, dayRate: 400 }], access("lezen"), current),
    ).toBe("dayRate");
  });

  it("allows an unchanged echo on a kept row (money-visible caller)", () => {
    const current = new Map([[1, { dayRate: 320, hourRate: null }]]);
    expect(
      findRejectedFunctionRate([{ functionId: 1, dayRate: 320, hourRate: null }], access("lezen"), current),
    ).toBeNull();
  });

  it("rejects a genuine rate on a newly-added row (no current entry) without Kosten access", () => {
    expect(
      findRejectedFunctionRate([{ functionId: 2, dayRate: 250 }], access("lezen"), new Map()),
    ).toBe("dayRate");
  });

  it("allows an omitted/null rate on a newly-added row without Kosten access", () => {
    expect(
      findRejectedFunctionRate([{ functionId: 2, dayRate: null }], access("lezen"), new Map()),
    ).toBeNull();
  });

  it("allows any rate with Kosten/Facturen: wijzigen", () => {
    const current = new Map([[1, { dayRate: 320, hourRate: null }]]);
    expect(
      findRejectedFunctionRate([{ functionId: 1, dayRate: 999 }], access("wijzigen"), current),
    ).toBeNull();
  });

  // The money-blind case this task fixes: PersonForm's chips resubmit
  // every assigned function's rate on every save, redacted to null for
  // a caller who can't see money at all — that must never be treated as
  // an attempted change, for a kept row or a newly-added one.
  it("never rejects a money-blind caller's rate, kept row or new row", () => {
    const current = new Map([[1, { dayRate: 320, hourRate: null }]]);
    expect(
      findRejectedFunctionRate([{ functionId: 1, dayRate: 0 }], access("geen"), current),
    ).toBeNull();
    expect(
      findRejectedFunctionRate([{ functionId: 2, dayRate: 999 }], access("geen"), new Map()),
    ).toBeNull();
  });

  it("checks every row in the array, not just the first", () => {
    const current = new Map([
      [1, { dayRate: 320, hourRate: null }],
      [2, { dayRate: 100, hourRate: null }],
    ]);
    expect(
      findRejectedFunctionRate(
        [
          { functionId: 1, dayRate: 320 },
          { functionId: 2, dayRate: 150 },
        ],
        access("lezen"),
        current,
      ),
    ).toBe("dayRate");
  });
});

describe("personFunctionRateData", () => {
  it("includes both rate fields (with their own null default) for a money-visible caller", () => {
    expect(personFunctionRateData({ functionId: 1, dayRate: 50 }, access("wijzigen"))).toEqual({
      dayRate: 50,
      hourRate: null,
    });
  });

  it("omits both rate fields entirely for a money-blind caller — never writes the redacted echo", () => {
    expect(personFunctionRateData({ functionId: 1, dayRate: 0, hourRate: 0 }, access("geen"))).toEqual({});
  });

  it("omits both rate fields for scope: own even with kosten_facturen: wijzigen granted", () => {
    expect(
      personFunctionRateData({ functionId: 1, dayRate: 50 }, access("wijzigen", "own")),
    ).toEqual({});
  });
});
