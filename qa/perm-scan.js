// Leak scan for a restricted user: every successful API JSON response and the
// rendered text of the inhuur screens are checked for money / other-project leaks.
const MONEY_KEYS = ["subhireUnitCost", "subhireCostOverride", "costPrice", "listPrice", "revenueBefore", "dayPriceAtBooking"];

async function leakScan({ page, BASE, shot, check }, who) {
  const leaks = new Set();
  const scan = (obj, url, trail = "") => {
    if (Array.isArray(obj)) return obj.forEach((v, i) => scan(v, url, `${trail}[${i}]`));
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (MONEY_KEYS.includes(k) && v != null && v !== 0) leaks.add(`API money ${url} ${trail}.${k}=${v}`);
      if (who === "free" && k === "dayPriceSnapshot" && v != null && v !== 0) leaks.add(`API price (scope own) ${url} ${trail}.${k}=${v}`);
      if (who === "free" && (k === "supplier" || k === "supplierId" || k === "holders") && v != null && !(Array.isArray(v) && v.every((h) => !h.name))) leaks.add(`API ${k} (scope own) ${url} ${trail}`);
      scan(v, url, `${trail}.${k}`);
    }
  };
  page.on("response", async (r) => {
    if (!r.url().includes("/api/") || r.status() >= 400) return;
    try { scan(await r.json(), r.url().replace(BASE, "")); } catch {}
  });
  const visit = async (url, tab, name) => {
    await page.goto(`${BASE}${url}`);
    await page.waitForLoadState("networkidle");
    if (tab) {
      const t = page.getByRole("tab", { name: tab });
      // These roles legitimately lack some tabs: skip, not a finding.
      if (!(await t.count())) return;
      await t.click();
    }
    await page.waitForTimeout(1200);
    const text = await page.locator("main").innerText().catch(() => "");
    if (/inkoop\s*€|marge\s*€|Inkoop inhuur|Marge inhuur/i.test(text)) leaks.add(`UI money text on ${url} ${tab ?? ""}`);
    if (who === "free" && /bezet door [A-Z]/.test(text)) leaks.add(`UI other-project name on ${url}`);
    if (who === "free" && /via (Funrent|Rent-men)/.test(text)) leaks.add(`UI supplier name on ${url}`);
    await shot(name);
  };
  for (const id of [14, 2, 15]) {
    await visit(`/projects/${id}`, "Materialen", `p${id}-mat`);
    await visit(`/projects/${id}`, "Kosten", `p${id}-kosten`);
  }
  await visit("/materials", null, "materials");
  await visit("/leveranciers", null, "leveranciers");
  await visit("/cijfers", null, "cijfers");
  await visit("/", null, "dashboard");
  check(leaks.size === 0, `[${who}] leaks:\n    ${[...leaks].join("\n    ")}`);
}
module.exports = { leakScan };
