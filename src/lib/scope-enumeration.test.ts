import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * N5.4 — static enumeration test walking own-data-scoping-design.md §5's
 * surface inventory, mirroring route-guards.test.ts's (N2.5) technique:
 * parse each handler's own body, not the whole file, so a check that
 * actually lives in a sibling handler can't accidentally satisfy this.
 *
 * This test does NOT invoke the handlers (no request/response harness
 * exists in this codebase, see redact.test.ts's/auth-me.test.ts's own
 * notes on the same limitation) — it proves the required source-level
 * pattern is present in the right place. The behavior those patterns
 * produce (scopeFilter's shape, moneyVisible's override, requireModule's
 * read-only rule) is covered by dedicated unit tests elsewhere
 * (scope-filter.test.ts, redact.test.ts, api-auth.test.ts) and by
 * scope-enumeration.integration.test.ts's real-DB round trip.
 */

const API_ROOT = path.join(process.cwd(), "src", "app", "api");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function extractHandlers(sourceText: string, fileName: string) {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const handlers: { method: string; body: string }[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      HTTP_METHODS.includes(node.name.text) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      handlers.push({ method: node.name.text, body: node.body ? node.body.getText(source) : "" });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return handlers;
}

function handlersOf(relPath: string) {
  const file = path.join(API_ROOT, relPath);
  return extractHandlers(readFileSync(file, "utf-8"), file);
}

function handler(relPath: string, method: string) {
  const found = handlersOf(relPath).find((h) => h.method === method);
  if (!found) throw new Error(`${relPath}: no exported ${method} found`);
  return found.body;
}

describe("bucket (a) — scopeFilter applied to project ownership reads", () => {
  it.each([
    ["projects/route.ts", "GET"],
    ["projects/[id]/route.ts", "GET"],
  ])("%s %s calls scopeFilter", (file, method) => {
    expect(handler(file, method)).toContain("scopeFilter(");
  });
});

describe("bucket (c) — standalone catalogues deny scope: own outright", () => {
  it.each([
    ["people/route.ts", "GET"],
    ["people/route.ts", "POST"],
    ["people/[id]/route.ts", "PUT"],
    ["people/[id]/route.ts", "DELETE"],
    ["materials/route.ts", "GET"],
    ["materials/route.ts", "POST"],
    ["materials/[id]/route.ts", "GET"],
    ["materials/[id]/route.ts", "PUT"],
    ["materials/[id]/route.ts", "DELETE"],
    ["materials/[id]/stock-items/route.ts", "GET"],
    ["materials/[id]/stock-items/route.ts", "POST"],
    ["materials/[id]/components/route.ts", "GET"],
    ["materials/[id]/components/route.ts", "POST"],
    ["clients/route.ts", "GET"],
    ["clients/route.ts", "POST"],
    ["clients/[id]/route.ts", "GET"],
    ["clients/[id]/route.ts", "PUT"],
    ["clients/[id]/route.ts", "DELETE"],
    ["locations/route.ts", "GET"],
    ["locations/route.ts", "POST"],
    ["locations/[id]/route.ts", "GET"],
    ["locations/[id]/route.ts", "PUT"],
    ["locations/[id]/route.ts", "DELETE"],
    ["categories/route.ts", "GET"],
    ["categories/route.ts", "POST"],
    ["categories/[id]/route.ts", "PUT"],
    ["categories/[id]/route.ts", "DELETE"],
    ["functions/route.ts", "GET"],
    ["functions/route.ts", "POST"],
    ["functions/[id]/route.ts", "PUT"],
    ["functions/[id]/route.ts", "DELETE"],
    ["people/available/route.ts", "GET"],
    ["materials/available/route.ts", "GET"],
  ])("%s %s denies scope: own", (file, method) => {
    expect(handler(file, method)).toContain('access.scope === "own"');
  });
});

describe("Kosten/Facturen money routes with no partial-keep deny scope: own even at lezen", () => {
  it("periods/[id]/people/[assignmentId]/travel/route.ts GET denies scope: own", () => {
    expect(
      handler("periods/[id]/people/[assignmentId]/travel/route.ts", "GET"),
    ).toContain('access.scope === "own"');
  });
});

describe("person documents — ownership check, not a blanket deny (resolved 2026-08-15)", () => {
  it("people/[id]/documents/route.ts GET checks personId ownership, not a blanket scope deny", () => {
    const body = handler("people/[id]/documents/route.ts", "GET");
    expect(body).toContain("access.personId !==");
    expect(body).not.toContain('access.scope === "own") return forbidden()');
  });

  it("documents/[id]/route.ts GET checks personId ownership, not a blanket scope deny", () => {
    const body = handler("documents/[id]/route.ts", "GET");
    expect(body).toContain("access.personId !==");
    expect(body).not.toContain('access.scope === "own") return forbidden()');
  });
});

describe("write-only routes — no new scoping code, covered by requireModule's centralised read-only rule (N5.1)", () => {
  // These have no GET at all; each exported handler still requires a
  // non-lezen level, which api-auth.test.ts already proves scope: own
  // can never satisfy. Listed here so the surface inventory stays
  // complete and reviewable, per own-data-scoping-design.md §7 — not to
  // re-test requireModule's behavior a second time.
  it.each([
    ["projects/[id]/periods/route.ts", "POST"],
    ["periods/[id]/route.ts", "PATCH"],
    ["periods/[id]/route.ts", "DELETE"],
    ["periods/[id]/people/route.ts", "POST"],
    ["periods/[id]/people/[assignmentId]/route.ts", "PATCH"],
    ["periods/[id]/people/[assignmentId]/route.ts", "DELETE"],
    ["periods/[id]/materials/route.ts", "POST"],
    ["periods/[id]/materials/[assignmentId]/route.ts", "PATCH"],
    ["periods/[id]/materials/[assignmentId]/route.ts", "DELETE"],
    ["periods/[id]/bundles/[bundleId]/route.ts", "DELETE"],
    ["projects/[id]/prices/material/[materialId]/route.ts", "PUT"],
    ["projects/[id]/prices/material/[materialId]/route.ts", "DELETE"],
    ["projects/[id]/prices/person/[personId]/route.ts", "PUT"],
    ["projects/[id]/prices/person/[personId]/route.ts", "DELETE"],
    ["periods/[id]/people/[assignmentId]/travel/route.ts", "POST"],
    ["periods/[id]/people/[assignmentId]/travel/[travelId]/route.ts", "PATCH"],
    ["periods/[id]/people/[assignmentId]/travel/[travelId]/route.ts", "DELETE"],
  ])("%s %s requires a non-lezen requireModule level", (file, method) => {
    const body = handler(file, method);
    expect(body).toMatch(/requireModule\([^)]*"(wijzigen|verwijderen)"/);
  });
});

describe("forward placeholders — not yet built, must not be forgotten when they land", () => {
  it.todo("GET /api/stats (K1, phase 3) denies scope: own regardless of matrix");
  it.todo("/api/calendar/ company feed (O1, phase 4) refuses scope: own, re-checked per request");
  it.todo("every export route (P2, phase 4) — bucket-a exports scopeFilter'd, bucket-c exports 403");
});
