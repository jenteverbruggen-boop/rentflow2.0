// Runs every qa/scenarios/NN-*.js in order, each in a fresh browser context.
// Exit 1 on: a failed check, a thrown error, any pageerror, any HTTP 5xx, any
// undeclared HTTP 4xx. A scenario declares expected 4xx via
// `module.exports.meta = { expectHttp: [409] }` (and `user: "free"|"plan"`).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { openSession, BASE } = require("./lib.js");

const USERS = {
  admin: { user: "admin@rentflow.dev", pass: "admin123" },
  free: { user: "free@qa.dev", pass: "qa-pass-123" },
  plan: { user: "plan@qa.dev", pass: "qa-pass-123" },
};
const only = process.argv[2];
const files = fs.readdirSync(path.join(here, "scenarios")).filter((f) => /^\d+-.*\.js$/.test(f)).sort()
  .filter((f) => !only || f.includes(only));

console.log(`QA base: ${BASE}`);
const rows = [];
for (const file of files) {
  const mod = require(path.join(here, "scenarios", file));
  const meta = mod.meta ?? {};
  const who = meta.user ?? "admin";
  const s = await openSession({ ...USERS[who], name: who, label: file.replace(/\.js$/, "") });
  const problems = [];
  try {
    await mod({ page: s.page, BASE: s.BASE, shot: s.shot, check: s.check });
  } catch (e) {
    problems.push(`threw: ${e.message.split("\n")[0]}`);
    await s.shot("error");
  }
  await s.page.waitForTimeout(300);
  const expected = new Set(meta.expectHttp ?? []);
  problems.push(...s.failures.map((m) => `check: ${m}`));
  problems.push(...s.events.pageerrors.map((m) => `pageerror: ${m}`));
  problems.push(...s.events.http5xx.map((e) => `HTTP ${e.status}: ${e.text}`));
  problems.push(...s.events.http4xx.filter((e) => !expected.has(e.status)).map((e) => `unexpected HTTP ${e.status}: ${e.text}`));
  await s.browser.close();
  rows.push({ file, ok: problems.length === 0, problems });
}

console.log("\nScenario".padEnd(40) + "Result");
console.log("-".repeat(48));
for (const r of rows) console.log(r.file.padEnd(39) + (r.ok ? "PASS" : "FAIL"));
for (const r of rows.filter((x) => !x.ok)) {
  console.log(`\n${r.file}:`);
  for (const p of r.problems) console.log(`  - ${p}`);
}
const failed = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);
process.exit(failed ? 1 : 0);
