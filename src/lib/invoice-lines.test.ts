import { describe, it, expect } from "vitest";
import { generateDraftInvoiceLines } from "@/lib/invoice-lines";
import { personLineCost, lineCost, periodDays } from "@/lib/pricing";
import type { Period, PeriodStockItem, PeriodPerson, PeriodBundleBooking } from "@/types";

function makeStockItem(snapshot: number, setup = 0): PeriodStockItem {
  return {
    id: 1, periodId: 1, stockItemId: 1, dayPriceSnapshot: snapshot,
    setupCostSnapshot: setup, discountPct: null, discountAmount: null, bundleBookingId: null,
    stockItem: {
      id: 1, materialId: 1, unitNumber: 1, identifier: null, notes: null, costPrice: null,
      material: {
        id: 1, name: "Tent", category: null, categoryId: null, code: null, notes: null,
        dayPrice: snapshot, setupCost: null, isBundle: false, bundlePriceOverride: null,
        archived: false, costPrice: null, listPrice: null, revenueBefore: null,
      },
    },
  };
}

function makePerson(name: string, snapshot: number, travelCosts: { unitCost: number; quantity: number }[] = []): PeriodPerson {
  return {
    id: 1, periodId: 1, personId: 1, functionId: null, role: null,
    startAt: null, endAt: null, overlapAck: false, billingUnit: "dag",
    rateSnapshot: null, dayPriceSnapshot: snapshot, discountPct: null, discountAmount: null,
    travelCosts: travelCosts.map((t, i) => ({ id: i + 1, periodPersonId: 1, label: null, ...t })),
    person: {
      id: 1, name, role: null, email: null, phone: null, address: null,
      postalCode: null, city: null, country: null, dayPrice: snapshot,
    },
  };
}

function makeBundleBooking(dayPriceSnapshot: number, quantity = 1): PeriodBundleBooking {
  return { id: 1, periodId: 1, materialId: 1, quantity, dayPriceSnapshot, material: { id: 1, name: "Set" } as never };
}

function makePeriod(name: string, start: string, end: string, opts?: {
  materials?: PeriodStockItem[]; people?: PeriodPerson[]; bundleBookings?: PeriodBundleBooking[];
}): Period {
  return {
    id: 1, projectId: 1, name, startDate: start, endDate: end,
    materials: opts?.materials ?? [], people: opts?.people ?? [], bundleBookings: opts?.bundleBookings ?? [],
  };
}

describe("generateDraftInvoiceLines — standalone/final grouping (J2b.1)", () => {
  it("groups people, materials, bundles and travel per period, using pricing.ts verbatim", () => {
    const period = makePeriod("Opbouw", "2026-05-01", "2026-05-02", {
      people: [makePerson("Jan", 200, [{ unitCost: 50, quantity: 1 }])],
      materials: [makeStockItem(100)],
      bundleBookings: [makeBundleBooking(8, 2)],
    });
    const lines = generateDraftInvoiceLines([period], { invoiceRole: "standalone", vatRate: 21, projectLabel: "Test" });

    const days = periodDays(period);
    const personLine = lines.find((l) => l.kind === "person")!;
    expect(personLine.lineTotalExcl).toBe(personLineCost(period.people[0], days));
    const materialLine = lines.find((l) => l.kind === "material")!;
    expect(materialLine.unitPrice).toBe(lineCost(100, days, {}));
    const bundleLine = lines.find((l) => l.kind === "bundle")!;
    expect(bundleLine.lineTotalExcl).toBe(8 * days * 2);
    const travelLine = lines.find((l) => l.kind === "travel")!;
    expect(travelLine.lineTotalExcl).toBe(50);
    expect(lines.every((l) => l.vatRate === 21)).toBe(true);
    expect(lines.every((l) => l.section === "Opbouw")).toBe(true);
  });

  it("adds a separate op-/afbouw line when a material group's setup cost is non-zero", () => {
    const period = makePeriod("Event", "2026-05-01", "2026-05-01", { materials: [makeStockItem(100, 30)] });
    const lines = generateDraftInvoiceLines([period], { invoiceRole: "standalone", vatRate: 21, projectLabel: "Test" });
    expect(lines.filter((l) => l.kind === "material")).toHaveLength(2);
    expect(lines.find((l) => l.description.startsWith("Op-/afbouw"))?.lineTotalExcl).toBe(30);
  });

  it("sorts periods by startDate before assigning sortOrder", () => {
    const later = makePeriod("Later", "2026-06-01", "2026-06-01", { people: [makePerson("A", 100)] });
    const earlier = makePeriod("Earlier", "2026-05-01", "2026-05-01", { people: [makePerson("B", 100)] });
    const lines = generateDraftInvoiceLines([later, earlier], { invoiceRole: "standalone", vatRate: 21, projectLabel: "Test" });
    expect(lines[0].section).toBe("Earlier");
    expect(lines[1].section).toBe("Later");
  });
});

describe("generateDraftInvoiceLines — deposit role", () => {
  it("percentage deposit: unitPrice derived from projectCostSummary(periods).total", () => {
    const period = makePeriod("Event", "2026-05-01", "2026-05-01", { people: [makePerson("A", 1000)] });
    const lines = generateDraftInvoiceLines([period], {
      invoiceRole: "deposit", vatRate: 21, depositType: "percentage", depositValue: 30, projectLabel: "Zomerfestival",
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe("deposit");
    expect(lines[0].unitPrice).toBe(300); // 30% of 1000
    expect(lines[0].description).toBe("Voorschot 30% van projecttotaal (Zomerfestival)");
  });

  it("fixed deposit: unitPrice is the entered excl-VAT amount directly", () => {
    const lines = generateDraftInvoiceLines([], {
      invoiceRole: "deposit", vatRate: 21, depositType: "fixed", depositValue: 500, projectLabel: "Zomerfestival",
    });
    expect(lines[0].unitPrice).toBe(500);
    expect(lines[0].description).toBe("Voorschot (Zomerfestival)");
  });
});

describe("generateDraftInvoiceLines — final role deduction lines (design doc §4.2)", () => {
  it("reproduces the worked example's deduction line exactly, copying the deposit's own frozen VAT rate", () => {
    const period = makePeriod("Festivaldagen", "2026-06-01", "2026-06-01", { people: [makePerson("A", 100)] });
    const lines = generateDraftInvoiceLines([period], {
      invoiceRole: "final", vatRate: 21, projectLabel: "Zomerfestival",
      priorDeposits: [{ number: "2026-0001", invoiceDate: "01/06/2026", netExcl: 1110, vatRate: 21 }],
    });
    const deduction = lines.find((l) => l.kind === "deduction")!;
    expect(deduction.unitPrice).toBe(-1110);
    expect(deduction.lineTotalExcl).toBe(-1110);
    expect(deduction.vatRate).toBe(21); // the deposit's own rate, never today's setting
    expect(deduction.description).toBe("Reeds gefactureerd: voorschotfactuur 2026-0001 (01/06/2026)");
    expect(deduction.sortOrder).toBe(lines.length - 1);
  });

  it("one deduction line per prior deposit", () => {
    const lines = generateDraftInvoiceLines([], {
      invoiceRole: "final", vatRate: 21, projectLabel: "Test",
      priorDeposits: [
        { number: "2026-0001", invoiceDate: "01/05/2026", netExcl: 500, vatRate: 21 },
        { number: "2026-0002", invoiceDate: "01/06/2026", netExcl: 300, vatRate: 21 },
      ],
    });
    expect(lines.filter((l) => l.kind === "deduction")).toHaveLength(2);
  });
});
