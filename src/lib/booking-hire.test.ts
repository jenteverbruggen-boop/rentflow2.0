import { describe, it, expect } from "vitest";
import { resolveBookingHires } from "@/lib/booking-hire";

const child = (id: number, over: object = {}) => ({
  subhireOnly: false, defaultSupplierId: null, subhireCostBasis: "per_huur", subhireUnitCost: 1.5, ...over,
  childId: id,
});
const prisma = { supplier: { count: async () => 99 } } as never;

function set(components: ReturnType<typeof child>[]) {
  return {
    isBundle: true, subhireOnly: false, defaultSupplierId: null, subhireCostBasis: "per_huur", subhireUnitCost: null,
    components: components.map((c) => ({ childId: c.childId, child: c })),
  };
}

describe("resolveBookingHires for sets (A2)", () => {
  it("hires every non-inhuur-only component from the request's supplier at the component's own prices", async () => {
    const m = set([child(1), child(2, { subhireUnitCost: 3 })]);
    const { hires } = await resolveBookingHires(prisma, m as never, { supplierId: 7, unitCost: 99, basis: "per_dag" }, true);
    expect(hires.componentHire.get(1)).toMatchObject({ supplierId: 7, unitCost: 1.5, basis: "per_huur" });
    expect(hires.componentHire.get(2)).toMatchObject({ supplierId: 7, unitCost: 3 });
    expect(hires.hiresIn).toBe(true);
  });

  it("an inhuur-only component is hired from its default supplier and does not skip the pre-check", async () => {
    const m = set([child(1), child(2, { subhireOnly: true, defaultSupplierId: 5 })]);
    const { hires } = await resolveBookingHires(prisma, m as never, undefined, true);
    expect(hires.componentHire.get(1)).toBeNull();
    expect(hires.componentHire.get(2)).toMatchObject({ supplierId: 5 });
    expect(hires.hiresIn).toBe(false);
  });
});
