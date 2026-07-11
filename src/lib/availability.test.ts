import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stockItem: { findMany: vi.fn() },
    periodStockItem: { findMany: vi.fn() },
    periodPerson: { findFirst: vi.fn() },
  },
}));

import { findAvailableStockItems, checkPersonAvailability } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const STOCK_ITEM = { id: 1, unitNumber: 1, identifier: null };

describe("availability — strict boundary (B7 Q16)", () => {
  beforeEach(() => {
    mockPrisma.stockItem.findMany.mockResolvedValue([STOCK_ITEM]);
    mockPrisma.periodStockItem.findMany.mockResolvedValue([]);
    mockPrisma.periodPerson.findFirst.mockResolvedValue(null);
  });

  it("back-to-back periods should NOT conflict (end 12:00 / start 12:00)", async () => {
    mockPrisma.periodStockItem.findMany.mockImplementation(({ where }: { where: { period: { AND: { startDate?: { lt: Date }; endDate?: { gt: Date } }[] } } }) => {
      const [startCond, endCond] = where.period.AND;
      const existingEnd = new Date("2026-05-14T12:00:00Z");
      const existingStart = new Date("2026-05-10T08:00:00Z");
      const newStart = startCond.startDate?.lt;
      const newEnd = endCond.endDate?.gt;
      if (!newStart || !newEnd) return [];
      const overlaps = existingStart < newStart && existingEnd > newEnd;
      return overlaps ? [{ stockItemId: 1 }] : [];
    });

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

describe("checkPersonAvailability — strict boundary", () => {
  it("returns no conflict when back-to-back", async () => {
    mockPrisma.periodPerson.findFirst.mockResolvedValue(null);
    const result = await checkPersonAvailability(1, {
      from: new Date("2026-05-14T12:00:00Z"),
      to: new Date("2026-05-16T17:00:00Z"),
    });
    expect(result.blockingProject).toBeUndefined();
  });
});
