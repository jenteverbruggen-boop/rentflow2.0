import { describe, it, expect } from "vitest";
import { resolveBookingSubhire } from "@/lib/subhire-defaults";

const material = (over = {}) => ({
  subhireOnly: false, defaultSupplierId: 3, subhireCostBasis: "per_dag", subhireUnitCost: "2.5", ...over,
});

describe("resolveBookingSubhire (C3)", () => {
  it("an ordinary material is only hired in when a supplier is named", () => {
    expect(resolveBookingSubhire(material(), undefined, true)).toBeNull();
    expect(resolveBookingSubhire(material(), { supplierId: 9 }, true)).toEqual({
      supplierId: 9, basis: "per_dag", unitCost: 2.5, costOverride: null,
    });
  });

  it("an inhuur-only material is always hired in, from its default supplier", () => {
    expect(resolveBookingSubhire(material({ subhireOnly: true }), undefined, false)).toMatchObject({ supplierId: 3 });
    // …even if the request names someone else: the default supplier is the rule.
    expect(resolveBookingSubhire(material({ subhireOnly: true }), { supplierId: 9 }, true)).toMatchObject({ supplierId: 3 });
  });

  it("an inhuur-only material without a default supplier can't be resolved", () => {
    expect(resolveBookingSubhire(material({ subhireOnly: true, defaultSupplierId: null }), undefined, true)).toBeNull();
  });

  it("prices from the request only for a caller who may set costs", () => {
    const request = { supplierId: 9, basis: "per_huur" as const, unitCost: 7, costOverride: 40 };
    expect(resolveBookingSubhire(material(), request, true)).toEqual({ supplierId: 9, basis: "per_huur", unitCost: 7, costOverride: 40 });
    expect(resolveBookingSubhire(material(), request, false)).toEqual({ supplierId: 9, basis: "per_dag", unitCost: 2.5, costOverride: null });
  });

  it("no default price means unknown (null), not 0", () => {
    expect(resolveBookingSubhire(material({ subhireUnitCost: null }), { supplierId: 9 }, true)).toMatchObject({ unitCost: null });
  });
});
