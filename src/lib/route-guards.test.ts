import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const API_ROOT = path.join(process.cwd(), "src", "app", "api");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * Exemption list — exactly these, each with its reason. No other route,
 * however special-looking, gets silently added (N2.5). settings/logo is
 * deliberately NOT here (subtlety 3): it's excluded from the proxy.ts
 * matcher, but that's unrelated to this route's own requireModule() call.
 */
const EXEMPT = [
  { file: "auth/login/route.ts", reason: "must work pre-auth" },
  { file: "auth/logout/route.ts", reason: "must work pre-auth" },
  { file: "auth/register/route.ts", reason: "stub, returns notFound()" },
  {
    file: "auth/password/route.ts",
    reason: "self-service — acts only on the caller's own account, gated by requireAuth + current password",
  },
  {
    file: "auth/logout-all/route.ts",
    reason: "self-service — revokes only the caller's own sessions, gated by requireAuth",
  },
  {
    file: "auth/me/route.ts",
    reason: "forward (N4.1) — the discovery endpoint a client calls before knowing its permissions; gating it is circular",
  },
];
/** A single handler of an otherwise module-gated file that is deliberately
 * open to any signed-in user. The file's other handlers are still checked. */
const EXEMPT_HANDLERS = [
  {
    file: "settings/company/route.ts",
    method: "GET",
    reason: "print headers must render for roles without instellingen access; only whitelisted company/payment keys",
  },
  {
    file: "settings/logo/route.ts",
    method: "GET",
    reason: "every print document shows the logo; writing it stays gated on instellingen",
  },
];
const EXEMPT_CALENDAR_PREFIX = "calendar/"; // forward (O1, phase 4)

function findRouteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      findRouteFiles(full, out);
    } else if (entry === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

/** Every exported HTTP-method function's own text (not the whole file) —
 * so a check against one handler can't be satisfied by a requireModule()
 * call that actually lives in a sibling handler. */
function extractHandlers(sourceText: string, fileName: string) {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const handlers: { method: string; body: string }[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      HTTP_METHODS.includes(node.name.text) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      handlers.push({
        method: node.name.text,
        body: node.body ? node.body.getText(source) : "",
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return handlers;
}

const routeFiles = findRouteFiles(API_ROOT);

describe("every route handler declares a module guard (N2.5)", () => {
  it(`found route files under src/app/api (sanity check: ${routeFiles.length} files)`, () => {
    expect(routeFiles.length).toBeGreaterThan(30);
  });

  for (const file of routeFiles) {
    const relPath = path.relative(API_ROOT, file).replace(/\\/g, "/");

    if (relPath.startsWith(EXEMPT_CALENDAR_PREFIX)) {
      it(`${relPath}: exempt (calendar feed, forward O1)`, () => {
        expect(true).toBe(true);
      });
      continue;
    }

    const exemption = EXEMPT.find((e) => e.file === relPath);
    if (exemption) {
      it(`${relPath}: exempt (${exemption.reason})`, () => {
        expect(true).toBe(true);
      });
      continue;
    }

    const source = readFileSync(file, "utf-8");
    const handlers = extractHandlers(source, file);

    it(`${relPath}: has at least one exported HTTP handler`, () => {
      expect(handlers.length).toBeGreaterThan(0);
    });

    for (const handler of handlers) {
      const handlerExemption = EXEMPT_HANDLERS.find(
        (e) => e.file === relPath && e.method === handler.method,
      );
      if (handlerExemption) {
        it(`${relPath}: ${handler.method} exempt (${handlerExemption.reason})`, () => {
          expect(handler.body.includes("requireAuth(")).toBe(true);
        });
        continue;
      }
      it(`${relPath}: ${handler.method} calls requireModule`, () => {
        expect(
          handler.body.includes("requireModule("),
          `${relPath}: ${handler.method} is missing a requireModule guard`,
        ).toBe(true);
      });
    }
  }
});
