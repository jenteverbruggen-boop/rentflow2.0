import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stockItem: { findMany: vi.fn() },
    periodStockItem: { findMany: vi.fn() },
    periodPerson: { findMany: vi.fn() },
  },
}));

import {
  findAvailableStockItems,
  checkPersonAvailability,
} from "@/lib/availability";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const STOCK_ITEM = { id: 1, unitNumber: 1, identifier: null };

describe("availability — strict boundary (B7 Q16)", () => {
  beforeEach(() => {
    mockPrisma.stockItem.findMany.mockResolvedValue([STOCK_ITEM]);
    mockPrisma.periodStockItem.findMany.mockResolvedValue([]);
    mockPrisma.periodPerson.findMany.mockResolvedValue([]);
  });

  it("back-to-back periods should NOT conflict (end 12:00 / start 12:00)", async () => {
    mockPrisma.periodStockItem.findMany.mockImplementation(
      ({
        where,
      }: {
        where: {
          period: {
            AND: { startDate?: { lt: Date }; endDate?: { gt: Date } }[];
          };
        };
      }) => {
        const [startCond, endCond] = where.period.AND;
        const existingEnd = new Date("2026-05-14T12:00:00Z");
        const existingStart = new Date("2026-05-10T08:00:00Z");
        const newStart = startCond.startDate?.lt;
        const newEnd = endCond.endDate?.gt;
        if (!newStart || !newEnd) return [];
        const overlaps = existingStart < newStart && existingEnd > newEnd;
        return overlaps ? [{ stockItemId: 1 }] : [];
      },
    );

    const from = new Date("2026-05-14T12:00:00Z");
    const to = new Date("2026-05-16T17:00:00Z");
    const result = await findAvailableStockItems(1, { from, to });
    expect(result.available).toHaveLength(1);
  });

  it("1-minute overlap should conflict", async () => {
    mockPrisma.periodStockItem.findMany.mockResolvedValue([{ stockItemId: 1 }]);
    const from = new Date("2026-05-14T11:59:00Z");
    const to = new Date("2026-05-16T17:00:00Z");
    const result = await findAvailableStockItems(1, { from, to });
    expect(result.available).toHaveLength(0);
    expect(result.bookedElsewhere).toContain(1);
  });
});

// H1.1 — checkPersonAvailability now compares against effectiveWindow()
// (the assignment's own startAt/endAt when set, else the period's),
// not the period's window directly. The Prisma-level query still does
// a coarse period-overlap pre-filter (mocked below exactly as before —
// a period-level AND clause); the fixtures return candidate rows with
// no startAt/endAt (undefined), so effectiveWindow falls back to the
// period's own dates, reproducing the pre-H1 behavior exactly. This is
// the null-window regression case H1.4 also covers explicitly.
describe("checkPersonAvailability — strict boundary", () => {
  it("returns no conflict when back-to-back", async () => {
    mockPrisma.periodPerson.findMany.mockResolvedValue([]);
    const result = await checkPersonAvailability(1, {
      from: new Date("2026-05-14T12:00:00Z"),
      to: new Date("2026-05-16T17:00:00Z"),
    });
    expect(result.blockingProject).toBeUndefined();
  });
});

describe("checkPersonAvailability — same-day non-overlapping windows (H3)", () => {
  // Reproduces the PO's exact scenario: a person is booked 08:00-17:00 on
  // project A (a single-day period). Before H3, both split editors sent
  // date-only strings (from === to), producing a zero-width window that
  // matched nothing regardless of the query — everyone read "Beschikbaar".
  beforeEach(() => {
    mockPrisma.periodPerson.findMany.mockImplementation(
      ({
        where,
      }: {
        where: {
          period: {
            AND: { startDate?: { lt: Date }; endDate?: { gt: Date } }[];
          };
        };
      }) => {
        const [startCond, endCond] = where.period.AND;
        const existingStart = new Date("2026-06-01T08:00:00Z");
        const existingEnd = new Date("2026-06-01T17:00:00Z");
        const queryEnd = startCond.startDate?.lt;
        const queryStart = endCond.endDate?.gt;
        if (!queryStart || !queryEnd) return [];
        const overlaps = existingStart < queryEnd && existingEnd > queryStart;
        return overlaps
          ? [
              {
                id: 99,
                startAt: null,
                endAt: null,
                period: {
                  startDate: existingStart,
                  endDate: existingEnd,
                  project: { id: 7, name: "Project A" },
                },
              },
            ]
          : [];
      },
    );
  });

  it("18:00-23:00 the same day does not conflict with an 08:00-17:00 booking", async () => {
    const result = await checkPersonAvailability(1, {
      from: new Date("2026-06-01T18:00:00Z"),
      to: new Date("2026-06-01T23:00:00Z"),
    });
    expect(result.blockingProject).toBeUndefined();
  });

  it("14:00-20:00 the same day conflicts with an 08:00-17:00 booking", async () => {
    const result = await checkPersonAvailability(1, {
      from: new Date("2026-06-01T14:00:00Z"),
      to: new Date("2026-06-01T20:00:00Z"),
    });
    expect(result.blockingProject?.name).toBe("Project A");
  });
});
