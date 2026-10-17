import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({ verifyToken: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { requireAuth } from "./api-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findUnique = prisma.user.findUnique as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const verify = verifyToken as any;

describe("requireAuth token revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue({ value: "t" });
    verify.mockReturnValue({ id: 1, email: "a@b.c", name: "A", tv: 2 });
  });

  it("accepts a token whose tv matches the row", async () => {
    findUnique.mockResolvedValue({ tokenVersion: 2 });
    await expect(requireAuth()).resolves.toMatchObject({ id: 1 });
  });

  it("rejects a token issued before a tokenVersion bump and drops the cookie", async () => {
    findUnique.mockResolvedValue({ tokenVersion: 3 });
    await expect(requireAuth()).rejects.toThrow("Unauthorized");
    expect(cookieStore.delete).toHaveBeenCalledWith("rentflow_token");
  });

  it("rejects when the user no longer exists", async () => {
    findUnique.mockResolvedValue(null);
    await expect(requireAuth()).rejects.toThrow("Unauthorized");
  });
});
