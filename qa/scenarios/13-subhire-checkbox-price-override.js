// Inhuur-only checkbox needs a default supplier; project price override reprices owned + hired rows.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/`);
  const id = await page.evaluate(async () => {
    const x = await fetch("/api/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Checkbox QA", dayPrice: 10, initialStock: 0 }) });
    return (await x.json()).id;
  });
  await page.goto(`${BASE}/materials`);
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder(/zoeken/i).first().fill("Checkbox QA");
  await page.waitForTimeout(500);
  await page.getByText("Checkbox QA").first().click();
  await page.waitForTimeout(600);
  await page.getByLabel(/Enkel inhuur \(nooit/).click();
  await page.waitForTimeout(1000);
  check(/standaardleverancier nodig/.test(await page.locator("main").innerText()), "no 'standaardleverancier nodig' without supplier");
  await page.getByRole("combobox").filter({ hasText: /Geen/ }).first().click();
  await page.getByRole("option", { name: "Funrent" }).click();
  await page.waitForTimeout(800);
  await page.getByLabel(/Enkel inhuur \(nooit/).click();
  await page.waitForTimeout(1000);
  const m = await page.evaluate(async (i) => (await (await fetch("/api/materials")).json()).find((x) => x.id === i), id);
  check(m.subhireOnly === true, `subhireOnly ${m.subhireOnly} after ticking with supplier`);
  await shot("checkbox");
  const o = await page.evaluate(async () => {
    const mats = await (await fetch("/api/materials")).json();
    const ct = mats.find((x) => x.name === "Cocktailtafel" && Number(x.dayPrice) === 5);
    const put = await fetch(`/api/projects/14/prices/material/${ct.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayPrice: 7 }) });
    const body = await put.json();
    const p = await (await fetch("/api/projects/14")).json();
    const ev = p.periods.find((x) => x.name === "Event");
    return {
      status: put.status,
      bad: Object.entries(body.material).filter(([k, v]) => /Price|Cost|revenue/.test(k) && !/Basis$/.test(k) && v !== null && typeof v !== "number").map(([k, v]) => `${k}:${typeof v}`),
      stock: [...new Set(ev.materials.filter((a) => a.stockItem?.materialId === ct.id).map((a) => Number(a.dayPriceSnapshot)))],
      hired: ev.shortages.filter((s) => s.materialId === ct.id && s.supplierId != null).map((s) => Number(s.dayPriceSnapshot)),
    };
  });
  check(o.status === 200, `override status ${o.status}`);
  check(o.bad.length === 0, `non-number money fields: ${o.bad}`);
  check(o.stock.length === 1 && o.stock[0] === 7, `stock snapshots ${JSON.stringify(o.stock)}`);
  check(o.hired.length > 0 && o.hired.every((v) => v === 7), `hired snapshots ${JSON.stringify(o.hired)}`);
};
module.exports.meta = { expectHttp: [400] };
