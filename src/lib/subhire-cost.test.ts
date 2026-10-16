import { describe, it, expect } from "vitest";
import { subhireTotal } from "@/lib/subhire-cost";

describe("subhireTotal (C3)", () => {
  it("per rental: units × unit price, regardless of days", () => {
    expect(subhireTotal({ quantity: 4, subhireCostBasis: "per_huur", subhireUnitCost: 12.5 }, 6)).toBe(50);
  });
  it("per day: units × unit price × days", () => {
    expect(subhireTotal({ quantity: 4, subhireCostBasis: "per_dag", subhireUnitCost: 2 }, 3)).toBe(24);
  });
  it("an override wins over both, even 0", () => {
    expect(subhireTotal({ quantity: 4, subhireCostBasis: "per_dag", subhireUnitCost: 2, subhireCostOverride: 18 }, 3)).toBe(18);
    expect(subhireTotal({ quantity: 4, subhireUnitCost: 2, subhireCostOverride: 0 }, 3)).toBe(0);
  });
  it("no cost entered means unknown, not 0", () => {
    expect(subhireTotal({ quantity: 4, subhireCostBasis: "per_dag" }, 3)).toBeNull();
  });
  it("accepts Postgres-style string decimals and a zero-day period", () => {
    expect(subhireTotal({ quantity: 2, subhireCostBasis: "per_dag", subhireUnitCost: "1.25" }, 0)).toBe(2.5);
  });
});
