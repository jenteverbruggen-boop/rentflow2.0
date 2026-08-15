import { describe, it, expect } from "vitest";
import { scopeFilter } from "./scope-filter";

describe("scopeFilter (N5.2)", () => {
  it("is a no-op (undefined) for scope: all", () => {
    expect(scopeFilter({ scope: "all", personId: 7 })).toBeUndefined();
    expect(scopeFilter({ scope: "all", personId: null })).toBeUndefined();
  });

  it("filters to projects the caller is booked on via any period, for scope: own", () => {
    expect(scopeFilter({ scope: "own", personId: 7 })).toEqual({
      periods: { some: { people: { some: { personId: 7 } } } },
    });
  });

  it("never falls back to no filter when personId is null — uses an impossible id instead", () => {
    const result = scopeFilter({ scope: "own", personId: null });
    expect(result).not.toBeUndefined();
    expect(result).toEqual({
      periods: { some: { people: { some: { personId: -1 } } } },
    });
  });
});
