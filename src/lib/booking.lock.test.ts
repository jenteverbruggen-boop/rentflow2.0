import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const executeSpy = vi.fn().mockResolvedValue(undefined);

describe("lockMaterials", () => {
  beforeEach(() => {
    executeSpy.mockClear();
  });

  it("no-op when DATABASE_URL is a file: URL (SQLite dev)", async () => {
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    const { lockMaterials } = await import("@/lib/booking");
    const tx = { $executeRawUnsafe: executeSpy };
    await lockMaterials(tx as never, [3, 1, 2]);
    expect(executeSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("emits pg_advisory_xact_lock in sorted order for Postgres URL", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost/db");
    vi.resetModules();
    const { lockMaterials } = await import("@/lib/booking");
    const calls: string[] = [];
    const pgTx = {
      $executeRawUnsafe: vi.fn().mockImplementation((sql: string) => {
        calls.push(sql);
        return Promise.resolve();
      }),
    };
    await lockMaterials(pgTx as never, [3, 1, 2]);
    expect(calls).toEqual([
      "SELECT pg_advisory_xact_lock(1234567, 1)",
      "SELECT pg_advisory_xact_lock(1234567, 2)",
      "SELECT pg_advisory_xact_lock(1234567, 3)",
    ]);
    vi.unstubAllEnvs();
  });
});
