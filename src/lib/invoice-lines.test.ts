import { describe, it, expect } from "vitest";
import { generateDraftInvoiceLines } from "@/lib/invoice-lines";
import { personLineCost, lineCost, periodDays, projectCostSummary } from "@/lib/pricing";
import type { Period, PeriodStockItem, PeriodPerson, PeriodBundleBooking, PeriodMaterialShortage } from "@/types";

function makeStockItem(snapshot: number, setup = 0): PeriodStockItem {
  return {
    id: 1, periodId: 1, stockItemId: 1, dayPriceSnapshot: snapshot,
    setupCostSnapshot: setup, discountPct: null, discountAmount: null, bundleBookingId: null, shippedAt: null, returnedAt: null,
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
    id: 1, periodId: 1, personId: 1, functionId: null,
    startAt: null, endAt: null, overlapAck: false, billingUnit: "dag",
    rateSnapshot: null, dayPriceSnapshot: snapshot, discountPct: null, discountAmount: null,
    travelCosts: travelCosts.map((t, i) => ({ id: i + 1, periodPersonId: 1, label: null, ...t })),
    person: {
      id: 1, name, email: null, phone: null, address: null,
      postalCode: null, city: null, country: null, dayPrice: snapshot,
    },
  };
}

function makeBundleBooking(dayPriceSnapshot: number, quantity = 1): PeriodBundleBooking {
  return { id: 1, periodId: 1, materialId: 1, quantity, dayPriceSnapshot, material: { id: 1, name: "Set" } as never };
}

function makeShortage(quantity: number, snapshot: number, setup = 0): PeriodMaterialShortage {
  const material = makeStockItem(snapshot).stockItem.material;
  return {
    id: 1, periodId: 1, materialId: 1, quantity, bundleBookingId: null, dayPriceSnapshot: snapshot,
    setupCostSnapshot: setup, discountPct: null, discountAmount: null, material,
  } as PeriodMaterialShortage;
}

function makePeriod(name: string, start: string, end: string, opts?: {
  materials?: PeriodStockItem[]; people?: PeriodPerson[]; bundleBookings?: PeriodBundleBooking[];
  shortages?: PeriodMaterialShortage[];
}): Period {
  return {
    id: 1, projectId: 1, name, startDate: start, endDate: end, updatedAt: start,
    materials: opts?.materials ?? [], people: opts?.people ?? [], bundleBookings: opts?.bundleBookings ?? [],
    shortages: opts?.shortages ?? [],
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
  // H6 — an invoice line must not claim a quantity its own total
  // contradicts.
  it("a day-selected person is invoiced for the selected days, not the period length", () => {
    const person = makePerson("Bob", 200);
    person.days = [
      { id: 1, periodPersonId: 1, startAt: "2026-06-01T08:00:00Z", endAt: "2026-06-01T17:00:00Z" },
      { id: 2, periodPersonId: 1, startAt: "2026-06-03T08:00:00Z", endAt: "2026-06-03T17:00:00Z" },
    ];
    const period = makePeriod("Week", "2026-06-01", "2026-06-05", { people: [person] });
    const lines = generateDraftInvoiceLines([period], {
      invoiceRole: "standalone", vatRate: 21, projectLabel: "Test",
    });
    const personLine = lines.find((l) => l.kind === "person")!;
    expect(personLine.quantity).toBe(2);
    expect(personLine.unit).toBe("dag");
    expect(personLine.lineTotalExcl).toBe(400);
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

describe("generateDraftInvoiceLines — overbooked units and set components (G1)", () => {
  const gen = (period: Period) =>
    generateDraftInvoiceLines([period], { invoiceRole: "standalone", vatRate: 21, projectLabel: "Test" });

  it("bills overbooked units like owned ones: 2 owned + 3 overbooked of one material is one line of 5", () => {
    const period = makePeriod("Event", "2026-05-01", "2026-05-01", {
      materials: [makeStockItem(100), makeStockItem(100)],
      shortages: [makeShortage(3, 100)],
    });
    const lines = gen(period).filter((l) => l.kind === "material");
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(5);
    expect(lines[0].lineTotalExcl).toBe(5 * lineCost(100, periodDays(period), {}));
  });

  it("an overbooked material with no stock at all still gets a line", () => {
    const period = makePeriod("Event", "2026-05-01", "2026-05-01", { shortages: [makeShortage(4, 25)] });
    expect(gen(period).find((l) => l.kind === "material")).toMatchObject({ quantity: 4, description: "Tent" });
  });

  it("the setup line includes the overbooked units' setup cost", () => {
    const period = makePeriod("Event", "2026-05-01", "2026-05-01", {
      materials: [makeStockItem(100, 10), makeStockItem(100, 10)],
      shortages: [makeShortage(3, 100, 10)],
    });
    const setup = gen(period).find((l) => l.description.startsWith("Op-/afbouw"))!;
    expect(setup.lineTotalExcl).toBe(50);
  });

  it("units that belong to a booked set are not listed on their own (they're €0, the set prices them)", () => {
    const component = { ...makeStockItem(0), bundleBookingId: 1 };
    const period = makePeriod("Event", "2026-05-01", "2026-05-01", {
      materials: [component, component],
      bundleBookings: [makeBundleBooking(80, 1)],
    });
    const lines = gen(period);
    expect(lines.filter((l) => l.kind === "material")).toHaveLength(0);
    expect(lines.filter((l) => l.kind === "bundle")).toHaveLength(1);
  });

  it("an invoice's total matches the project's cost summary for a period with shortages", () => {
    const period = makePeriod("Event", "2026-05-01", "2026-05-02", {
      materials: [makeStockItem(100, 5)],
      shortages: [makeShortage(2, 100, 5)],
      bundleBookings: [makeBundleBooking(40, 1)],
    });
    const lines = gen(period);
    const sum = Math.round(lines.reduce((s, l) => s + l.lineTotalExcl, 0) * 100) / 100;
    expect(sum).toBe(projectCostSummary([period]).total);
  });
});
