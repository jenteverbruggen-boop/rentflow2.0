import { describe, it, expect } from "vitest";
import { findRejectedMoneyWrite } from "@/lib/money-write-guard";
import type { ResolvedAccess } from "@/lib/api-auth";

const access = (level: string): ResolvedAccess => ({ id: 1, personId: null, scope: "all", permissions: { kosten_facturen: level as never } });

describe("priceBasis in the money write guard", () => {
  it("refuses a change without money-write, for money-blind callers too", () => {
    for (const level of ["lezen", "geen"]) {
      expect(findRejectedMoneyWrite({ priceBasis: "per_huur" }, access(level), { priceBasis: "per_dag" })).toBe("priceBasis");
    }
  });
  it("allows an unchanged echo and a caller with money-write", () => {
    expect(findRejectedMoneyWrite({ priceBasis: "per_dag" }, access("lezen"), { priceBasis: "per_dag" })).toBeNull();
    expect(findRejectedMoneyWrite({ priceBasis: "per_huur" }, access("wijzigen"), { priceBasis: "per_dag" })).toBeNull();
  });
  it("on create the default is per_dag, per_huur for an inhuur-only item", () => {
    expect(findRejectedMoneyWrite({ priceBasis: "per_dag" }, access("geen"))).toBeNull();
    expect(findRejectedMoneyWrite({ priceBasis: "per_huur" }, access("geen"))).toBe("priceBasis");
    expect(findRejectedMoneyWrite({ priceBasis: "per_huur", subhireOnly: true }, access("geen"))).toBeNull();
  });
});
