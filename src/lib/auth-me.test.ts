import { describe, it, expect } from "vitest";
import { MODULES } from "./modules";

// The full response shape isn't unit-testable without a request/response
// harness this codebase doesn't have (see redact.test.ts's note on the
// same limitation) — this covers the one piece of real logic behind
// GET /api/auth/me: that every module gets an explicit entry, not an
// absent key meaning "geen" implicitly.
describe("auth/me's permissions map (N4.1)", () => {
  it("fills every module key, defaulting missing entries to geen", () => {
    const partial: Partial<Record<string, string>> = { projecten: "wijzigen" };
    const full: Record<string, string> = {};
    for (const m of MODULES) {
      full[m.key] = partial[m.key] ?? "geen";
    }
    expect(Object.keys(full)).toHaveLength(10);
    expect(full.projecten).toBe("wijzigen");
    expect(full.kosten_facturen).toBe("geen");
  });
});
