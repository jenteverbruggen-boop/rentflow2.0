import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const executeSpy = vi.fn().mockResolvedValue(undefined);

// Mirrors booking.lock.test.ts's coverage of lockMaterials — proves
// lockPeople() uses its own advisory-lock key (1234568, materials use
// 1234567) so the two locks can never collide.
describe("lockPeople", () => {
  beforeEach(() => {
    executeSpy.mockClear();
  });

  it("no-op when DATABASE_URL is a file: URL (SQLite dev)", async () => {
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    const { lockPeople } = await import("@/lib/person-booking");
    const tx = { $executeRawUnsafe: executeSpy };
    await lockPeople(tx as never, [3, 1, 2]);
    expect(executeSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("emits pg_advisory_xact_lock with its own key, in sorted order, for Postgres URL", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost/db");
    vi.resetModules();
    const { lockPeople } = await import("@/lib/person-booking");
    const calls: string[] = [];
    const pgTx = {
      $executeRawUnsafe: vi.fn().mockImplementation((sql: string) => {
        calls.push(sql);
        return Promise.resolve();
      }),
    };
    await lockPeople(pgTx as never, [3, 1, 2]);
    expect(calls).toEqual([
      "SELECT pg_advisory_xact_lock(1234568, 1)",
      "SELECT pg_advisory_xact_lock(1234568, 2)",
      "SELECT pg_advisory_xact_lock(1234568, 3)",
    ]);
    vi.unstubAllEnvs();
  });
});
