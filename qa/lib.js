// Session helper for the QA suite. Never point QA_BASE at production.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.QA_BASE || "http://localhost:3100";
const OUT = path.join(__dirname, ".out");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN = { user: "admin@rentflow.dev", pass: "admin123" };

async function openSession({ user = ADMIN.user, pass = ADMIN.pass, name = "admin", label = "scenario" } = {}) {
  const stateFile = path.join(OUT, `state-${name}.json`);
  const launch = process.env.QA_CHROMIUM ? { executablePath: process.env.QA_CHROMIUM } : {};
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    ...(fs.existsSync(stateFile) ? { storageState: stateFile } : {}),
  });
  const page = await ctx.newPage();
  const events = { pageerrors: [], http5xx: [], http4xx: [], console: [] };
  page.on("console", (m) => m.type() === "error" && events.console.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => events.pageerrors.push(e.message.slice(0, 300)));
  page.on("response", async (r) => {
    if (!r.url().includes("/api/") || r.status() < 400) return;
    let body = "";
    try { body = (await r.text()).slice(0, 200); } catch {}
    const e = { status: r.status(), text: `${r.request().method()} ${r.url().replace(BASE, "")} ${body}` };
    (r.status() >= 500 ? events.http5xx : events.http4xx).push(e);
  });
  await page.goto(`${BASE}/`);
  if (page.url().includes("/login")) {
    await page.getByLabel(/e-?mail/i).fill(user);
    await page.getByLabel(/wachtwoord/i).fill(pass);
    await page.getByRole("button", { name: /inloggen|aanmelden/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await ctx.storageState({ path: stateFile });
  }
  const failures = [];
  const check = (cond, message) => { if (!cond) failures.push(message); return !!cond; };
  const shot = async (n) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, `${label}-${n}.png`), fullPage: true }).catch(() => {});
  };
  return { browser, page, events, failures, check, shot, BASE };
}

module.exports = { openSession, BASE, OUT };
