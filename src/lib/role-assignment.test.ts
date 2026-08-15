import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolveRoleAssignment } from "./role-assignment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("resolveRoleAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when neither role nor roleId is present", async () => {
    const result = await resolveRoleAssignment({});
    expect(result).toBeNull();
  });

  it("resolves a valid roleId pointing at a system role", async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 2,
      key: "PLANNER",
      isSystem: true,
    });
    const result = await resolveRoleAssignment({ roleId: 2 });
    expect(result).toEqual({ role: "PLANNER", roleId: 2 });
  });

  it("rejects a roleId that does not exist", async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);
    const result = await resolveRoleAssignment({ roleId: 999 });
    expect(result).toEqual({ error: expect.any(String) });
  });

  it("rejects a roleId pointing at a custom (non-system) role", async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 5,
      key: "FREELANCER",
      isSystem: false,
    });
    const result = await resolveRoleAssignment({ roleId: 5 });
    expect(result).toEqual({ error: expect.any(String) });
  });

  it("rejects a non-integer roleId without querying the database", async () => {
    const result = await resolveRoleAssignment({ roleId: "not-a-number" });
    expect(result).toEqual({ error: expect.any(String) });
    expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
  });

  it("resolves a valid legacy role string, case-insensitively", async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 1,
      key: "ADMIN",
      isSystem: true,
    });
    const result = await resolveRoleAssignment({ role: "admin" });
    expect(result).toEqual({ role: "ADMIN", roleId: 1 });
    expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
      where: { key: "ADMIN" },
    });
  });

  it("rejects an unknown legacy role string", async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);
    const result = await resolveRoleAssignment({ role: "bogus" });
    expect(result).toEqual({ error: expect.any(String) });
  });

  it("prefers roleId over role when both are present", async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 3,
      key: "VIEWER",
      isSystem: true,
    });
    const result = await resolveRoleAssignment({ role: "ADMIN", roleId: 3 });
    expect(result).toEqual({ role: "VIEWER", roleId: 3 });
    expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
    });
  });
});
