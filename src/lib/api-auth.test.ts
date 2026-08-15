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

  // N5.1 — scope: own is read-only, and this override wins even against a
  // deliberately wide-open matrix (own-data-scoping-design.md:74-80).
  it("scope: own allows lezen when the matrix grants it", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue(
      roleRow("own", { projecten: "verwijderen" }),
    );
    await expect(requireModule("projecten", "lezen")).resolves.toBeTruthy();
  });

  it("scope: own blocks wijzigen even when the matrix grants verwijderen", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue(
      roleRow("own", { projecten: "verwijderen" }),
    );
    await expect(requireModule("projecten", "wijzigen")).rejects.toThrow();
  });

  it("scope: own blocks verwijderen even when the matrix grants verwijderen", async () => {
    mockAuthenticatedAs(1);
    mockPrisma.user.findUnique.mockResolvedValue(
      roleRow("own", { projecten: "verwijderen" }),
    );
    await expect(requireModule("projecten", "verwijderen")).rejects.toThrow();
  });
});

describe("permission resolution end to end (N1.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAs(1);
  });

  it("the fully-open seed (C1) grants everything", async () => {
    const ALL_MODULES = [
      "projecten", "planning", "personen", "materialen", "klanten",
      "locaties", "kosten_facturen", "cijfers", "gebruikers", "instellingen",
    ];
    const perms = Object.fromEntries(ALL_MODULES.map((m) => [m, "verwijderen"]));
    mockPrisma.user.findUnique.mockResolvedValue(roleRow("all", perms));
    for (const m of ALL_MODULES) {
      await expect(
        requireModule(m as never, "verwijderen"),
      ).resolves.toBeTruthy();
    }
  });

  it("a role downgraded to lezen blocks writes on the next call", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(
      roleRow("all", { projecten: "wijzigen" }),
    );
    await expect(requireModule("projecten", "wijzigen")).resolves.toBeTruthy();

    // Same token throughout — the role row is mutated directly, no re-login.
    mockPrisma.user.findUnique.mockResolvedValueOnce(
      roleRow("all", { projecten: "lezen" }),
    );
    await expect(requireModule("projecten", "wijzigen")).rejects.toThrow();
    // Reads still work at the downgraded level.
    mockPrisma.user.findUnique.mockResolvedValueOnce(
      roleRow("all", { projecten: "lezen" }),
    );
    await expect(requireModule("projecten", "lezen")).resolves.toBeTruthy();
  });

  it("geen blocks reads", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      roleRow("all", { kosten_facturen: "geen" }),
    );
    await expect(requireModule("kosten_facturen", "lezen")).rejects.toThrow();
  });

  it("a custom role (not ADMIN/PLANNER/VIEWER) behaves exactly like a system role", async () => {
    // A genuinely new role, not one of the three seeded system keys —
    // requireModule must not treat isSystem as relevant at all. Confirmed
    // by construction: resolveAccess never selects isSystem from the DB,
    // so a custom role's permissions are honoured identically.
    mockPrisma.user.findUnique.mockResolvedValue(
      roleRow("all", { klanten: "wijzigen" }),
    );
    const access = await requireModule("klanten", "wijzigen");
    expect(access.scope).toBe("all");
    await expect(requireModule("klanten", "verwijderen")).rejects.toThrow();
  });
});
