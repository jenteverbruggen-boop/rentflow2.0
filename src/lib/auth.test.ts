import { describe, it, expect, vi } from "vitest";

// auth.ts imports env.ts, which validates required env vars at module
// load (and throws otherwise) — mocked away since this test only
// exercises isSecureRequest, unrelated to JWT_SECRET. `vi.mock` calls
// (unlike plain statements) are hoisted above all imports by vitest's
// own transform, so this reliably runs before auth.ts is evaluated.
vi.mock("@/lib/env", () => ({
  env: { DATABASE_URL: "file:/tmp/auth-test.db", JWT_SECRET: "test-secret-at-least-16-chars" },
  JWT_SECRET_BYTES: new TextEncoder().encode("test-secret-at-least-16-chars"),
}));

import { isSecureRequest } from "@/lib/auth";

function makeReq(headers: Record<string, string>, protocol: string) {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    nextUrl: { protocol },
  };
}

describe("isSecureRequest (login-doesn't-work-on-my-phone fix)", () => {
  it("is false for a plain HTTP request with no reverse proxy in front", () => {
    // The actual bug shape: docker-compose ships with no TLS-terminating
    // reverse proxy, so a production deployment reached directly (e.g.
    // http://<lan-ip>:3000 from a phone on the same network) is genuinely
    // plain HTTP — this must resolve to `false`, or the Secure cookie
    // gets silently dropped by the browser.
    expect(isSecureRequest(makeReq({}, "http:"))).toBe(false);
  });

  it("is true for a genuinely HTTPS request with no reverse proxy", () => {
    expect(isSecureRequest(makeReq({}, "https:"))).toBe(true);
  });

  it("trusts X-Forwarded-Proto: https from a TLS-terminating reverse proxy over plain-HTTP internal traffic", () => {
    expect(isSecureRequest(makeReq({ "x-forwarded-proto": "https" }, "http:"))).toBe(true);
  });

  it("trusts X-Forwarded-Proto: http even if the request object itself claims https", () => {
    expect(isSecureRequest(makeReq({ "x-forwarded-proto": "http" }, "https:"))).toBe(false);
  });

  it("takes only the first value of a comma-separated X-Forwarded-Proto chain", () => {
    expect(isSecureRequest(makeReq({ "x-forwarded-proto": "https, http" }, "http:"))).toBe(true);
  });
});
