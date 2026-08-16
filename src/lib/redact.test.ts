import { describe, it, expect } from "vitest";
import {
  redactMoney,
  moneyVisible,
  findRejectedMoneyWrite,
  findRejectedField,
} from "./redact";
import type { ResolvedAccess } from "@/lib/api-auth";

function access(kostenLevel: string): ResolvedAccess {
  return {
    id: 1,
    personId: null,
    scope: "all",
    permissions: { kosten_facturen: kostenLevel as never },
  };
}

// N5.1b — same shape, but scope: own, used to prove the override fires
// even against a deliberately wide-open matrix (verwijderen), not just
// the geen case a sensible default would also happen to satisfy.
function scopedAccess(kostenLevel: string): ResolvedAccess {
  return {
    id: 1,
    personId: null,
    scope: "own",
    permissions: { kosten_facturen: kostenLevel as never },
  };
}

// A fixture tree with every money field from the inventory table
// populated (including a bundle booking and a travel cost), built as a
// plain object rather than via Prisma — this is the exact shape
// serializeProject()/route handlers hand to redactMoney().
function moneyFixture() {
  return {
    id: 1,
    name: "Test project",
    periods: [
      {
        id: 1,
        materials: [
          {
            id: 1,
            dayPriceSnapshot: 150,
            setupCostSnapshot: 20,
            discountPct: 10,
            discountAmount: null,
            stockItem: {
              id: 1,
              material: {
                id: 1,
                name: "Tent",
                dayPrice: 150,
                setupCost: 20,
                bundlePriceOverride: null,
                bundleStock: { completeSets: 3, componentSum: 450 },
                setPrice: 450,
              },
            },
          },
        ],
        people: [
          {
            id: 1,
            dayPriceSnapshot: 300,
            discountPct: null,
            discountAmount: 50,
            rateSnapshot: 45,
            person: { id: 1, name: "Alice", dayPrice: 300 },
            function: { id: 1, name: "Electrician", dayRate: 320, hourRate: 45 },
            travelCosts: [{ id: 1, label: "Transport", unitCost: 30, quantity: 4 }],
          },
        ],
        bundleBookings: [
          {
            id: 1,
            dayPriceSnapshot: 500,
            material: {
              id: 2,
              name: "Set A",
              dayPrice: null,
              setupCost: null,
              bundlePriceOverride: 500,
              components: [{ child: { id: 3, name: "Component", dayPrice: 80 } }],
            },
          },
        ],
      },
    ],
    materialPrices: [{ id: 1, materialId: 1, dayPrice: 140, material: { id: 1, dayPrice: 150 } }],
    personPrices: [{ id: 1, personId: 1, dayPrice: 280, person: { id: 1, dayPrice: 300 } }],
  };
}

// Every money key the inventory table lists — a recursive scan, not a
// hand-written per-field assertion list, so a field added later without
// a matching redaction rule fails this test instead of silently passing.
const MONEY_KEYS = [
  "dayPrice", "dayPriceSnapshot", "setupCost", "setupCostSnapshot",
  "bundlePriceOverride", "discountPct", "discountAmount", "unitCost",
  "basePrice", "setPrice", "costPrice", "listPrice", "revenueBefore",
  "dayRate", "hourRate", "rateSnapshot",
  // J2b (phase 3): Invoice/InvoiceLine/Payment money fields.
  "subtotalExcl", "travelExcl", "deductionExcl", "vatAmount", "totalIncl",
  "depositPercentage", "depositBasisExcl", "unitPrice", "lineTotalExcl", "amount",
];
const ARRAY_KEYS = ["materialPrices", "personPrices", "travelCosts"];
const OBJECT_KEYS = ["bundleStock"];
const BOOLEAN_KEYS = ["hasOverride"];

function assertNoMoneyLeaks(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoMoneyLeaks(v, `${path}[${i}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const here = `${path}.${key}`;
      if (ARRAY_KEYS.includes(key)) {
        expect(v, `${here} should be an empty array`).toEqual([]);
      } else if (OBJECT_KEYS.includes(key)) {
        expect(v, `${here} should be undefined`).toBeUndefined();
      } else if (MONEY_KEYS.includes(key)) {
        expect(v, `${here} should be null`).toBeNull();
      } else if (BOOLEAN_KEYS.includes(key)) {
        expect(v, `${here} should be false`).toBe(false);
      } else {
        assertNoMoneyLeaks(v, here);
      }
    }
  }
}

describe("redactMoney", () => {
  it("is a no-op when the caller has Kosten/Facturen access", () => {
    const project = moneyFixture();
    const result = redactMoney(project, access("lezen"));
    expect(result).toEqual(project);
  });

  it("strips every money field for a caller with Kosten/Facturen: geen", () => {
    const project = moneyFixture();
    const result = redactMoney(project, access("geen"));
    assertNoMoneyLeaks(result);
  });

  it("strips every money field for a caller with no kosten_facturen permission at all", () => {
    const project = moneyFixture();
    const noAccess: ResolvedAccess = {
      id: 1,
      personId: null,
      scope: "all",
      permissions: {},
    };
    assertNoMoneyLeaks(redactMoney(project, noAccess));
  });

  it("preserves non-money fields (names, quantities, ids) unredacted", () => {
    const project = moneyFixture();
    const result = redactMoney(project, access("geen")) as typeof project;
    expect(result.periods[0].materials[0].stockItem.material.name).toBe("Tent");
    expect(result.periods[0].people[0].person.name).toBe("Alice");
  });

  // N5.1b — scope: own overrides even a fully-open Kosten/Facturen:
  // verwijderen. A test that only checked scope + Kosten:geen would pass
  // even if this override did nothing at all (own-data-scoping-design.md:229).
  it("strips every money field for scope: own even against Kosten/Facturen: verwijderen", () => {
    const project = moneyFixture();
    const result = redactMoney(project, scopedAccess("verwijderen"));
    assertNoMoneyLeaks(result);
  });

  // J2b (phase 3) — declared in SCALAR_DENYLIST for any future embed
  // (redactMoney() itself, not requireModule, is what this test
  // exercises; the /api/invoices* routes never call it directly since
  // their own guard already is the money gate).
  it("strips Invoice/InvoiceLine/Payment money fields when embedded elsewhere", () => {
    const embed = {
      invoices: [
        {
          subtotalExcl: 1110, travelExcl: 0, deductionExcl: 0,
          vatAmount: 233.1, totalIncl: 1343.1,
          depositPercentage: 30, depositBasisExcl: 3700,
          lines: [{ unitPrice: 1110, lineTotalExcl: 1110 }],
          payments: [{ amount: 900 }],
        },
      ],
    };
    const result = redactMoney(embed, access("geen"));
    assertNoMoneyLeaks(result);
  });
});

describe("moneyVisible", () => {
  it("true for lezen/wijzigen/verwijderen, false for geen or unset", () => {
    expect(moneyVisible(access("lezen"))).toBe(true);
    expect(moneyVisible(access("wijzigen"))).toBe(true);
    expect(moneyVisible(access("verwijderen"))).toBe(true);
    expect(moneyVisible(access("geen"))).toBe(false);
    expect(
      moneyVisible({ id: 1, personId: null, scope: "all", permissions: {} }),
    ).toBe(false);
  });

  it("false for scope: own regardless of the caller's kosten_facturen level (N5.1b)", () => {
    expect(moneyVisible(scopedAccess("verwijderen"))).toBe(false);
    expect(moneyVisible(scopedAccess("lezen"))).toBe(false);
    expect(moneyVisible(scopedAccess("geen"))).toBe(false);
  });
});

describe("findRejectedMoneyWrite", () => {
  it("rejects a dayPrice write without Kosten/Facturen: wijzigen", () => {
    expect(findRejectedMoneyWrite({ dayPrice: 100 }, access("lezen"))).toBe(
      "dayPrice",
    );
  });

  it("allows a dayPrice write with Kosten/Facturen: wijzigen", () => {
    expect(findRejectedMoneyWrite({ dayPrice: 100 }, access("wijzigen"))).toBeNull();
  });

  it("allows a write with no money fields present, regardless of access", () => {
    expect(findRejectedMoneyWrite({ name: "New name" }, access("geen"))).toBeNull();
  });
});

describe("findRejectedField (booking PATCH field-level checks, N2.2)", () => {
  const PERSON_KOSTEN_FIELDS = ["discountPct", "discountAmount"] as const;
  const MATERIAL_KOSTEN_FIELDS = ["discountPct", "discountAmount", "resnapshotPrice"] as const;

  it("a caller without Kosten access can still edit role on a person booking", () => {
    expect(
      findRejectedField({ role: "Regisseur" }, access("lezen"), PERSON_KOSTEN_FIELDS),
    ).toBeNull();
  });

  it("the same caller is rejected for discountPct on a person booking", () => {
    expect(
      findRejectedField({ role: "Regisseur", discountPct: 10 }, access("lezen"), PERSON_KOSTEN_FIELDS),
    ).toBe("discountPct");
  });

  it("a material booking PATCH also rejects resnapshotPrice without Kosten access", () => {
    expect(
      findRejectedField({ resnapshotPrice: true }, access("lezen"), MATERIAL_KOSTEN_FIELDS),
    ).toBe("resnapshotPrice");
  });

  it("a material booking PATCH with Kosten/Facturen: wijzigen allows all three fields", () => {
    expect(
      findRejectedField(
        { discountPct: 5, discountAmount: 10, resnapshotPrice: true },
        access("wijzigen"),
        MATERIAL_KOSTEN_FIELDS,
      ),
    ).toBeNull();
  });
});
