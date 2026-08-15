import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: vi.fn(),
}));

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { requireModule } from "./api-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCookies = cookies as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockVerifyToken = verifyToken as any;

function mockAuthenticatedAs(userId: number) {
  mockCookies.mockResolvedValue({
    get: () => ({ value: "faketoken" }),
  });
  mockVerifyToken.mockReturnValue({ id: userId, email: "u@test.dev", name: "U" });
}

function roleRow(scope: string, perms: Record<string, string>) {
  return {
    personId: null,
    roleRel: {
      scope,
      permissions: Object.entries(perms).map(([module, access]) => ({
        module,
        access,
      })),
    },
  };
}

describe("requireModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves and allows when the held level satisfies the required level", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue(
      roleRow("all", { planning: "wijzigen" }),
    );
    const access = await requireModule("planning", "lezen");
    expect(access.scope).toBe("all");
  });

  it("throws when the held level does not satisfy the required level", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue(
      roleRow("all", { planning: "lezen" }),
    );
    await expect(requireModule("planning", "wijzigen")).rejects.toThrow();
  });

  it("fails closed for an unknown/unassigned module", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue(roleRow("all", {}));
    await expect(requireModule("planning", "lezen")).rejects.toThrow();
  });

  it("fails closed when the user has no role row (roleId: null)", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue({
      personId: null,
      roleRel: null,
    });
    await expect(requireModule("planning", "lezen")).rejects.toThrow();
  });

  it("fails closed when the user row itself does not exist", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(requireModule("planning", "lezen")).rejects.toThrow();
  });

  it("re-resolves on every call — a downgrade between two calls blocks the second, with no re-login", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValueOnce(
      roleRow("all", { planning: "wijzigen" }),
    );
    await expect(requireModule("planning", "wijzigen")).resolves.toBeTruthy();

    // Simulate the role being downgraded directly in the DB between calls
    // — no new token is issued, mockVerifyToken keeps returning the same
    // payload as before.
    mockPrisma.user.findUnique.mockResolvedValueOnce(
      roleRow("all", { planning: "lezen" }),
    );
    await expect(requireModule("planning", "wijzigen")).rejects.toThrow();
  });

  it("each level satisfies those below it (reusing modules.ts's ordering)", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue(
      roleRow("all", { materialen: "verwijderen" }),
    );
    await expect(requireModule("materialen", "lezen")).resolves.toBeTruthy();
    await expect(requireModule("materialen", "wijzigen")).resolves.toBeTruthy();
    await expect(
      requireModule("materialen", "verwijderen"),
    ).resolves.toBeTruthy();
  });
});
