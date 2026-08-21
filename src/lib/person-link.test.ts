import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    person: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolvePersonLink } from "./person-link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("resolvePersonLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when personId is not present", async () => {
    const result = await resolvePersonLink({});
    expect(result).toBeNull();
  });

  it("resolves null to an explicit unlink, without querying the database", async () => {
    const result = await resolvePersonLink({ personId: null });
    expect(result).toEqual({ personId: null });
    expect(mockPrisma.person.findUnique).not.toHaveBeenCalled();
  });

  it("resolves a personId pointing at a real person", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: 7, name: "Alice" });
    const result = await resolvePersonLink({ personId: 7 });
    expect(result).toEqual({ personId: 7 });
    expect(mockPrisma.person.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("rejects a personId that does not exist, instead of hitting the FK constraint", async () => {
    mockPrisma.person.findUnique.mockResolvedValue(null);
    const result = await resolvePersonLink({ personId: 999 });
    expect(result).toEqual({ error: expect.any(String) });
  });

  it("rejects a non-integer personId without querying the database", async () => {
    const result = await resolvePersonLink({ personId: "not-a-number" });
    expect(result).toEqual({ error: expect.any(String) });
    expect(mockPrisma.person.findUnique).not.toHaveBeenCalled();
  });
});
