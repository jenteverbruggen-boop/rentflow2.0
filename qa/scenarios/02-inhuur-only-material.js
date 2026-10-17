// Inhuur-only material: create via UI, stock items are refused (409).
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/materials`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /nieuw materiaal/i }).first().click();
  const d = page.getByRole("dialog");
  await d.getByLabel(/naam/i).first().fill("Tentwarmer QA");
  await d.locator("input[name=dayPrice]").fill("25");
  await d.getByText(/enkel inhuur/i).click();
  await d.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Funrent" }).click();
  await d.locator("input[type=number]").nth(2).fill("15");
  await d.getByRole("button", { name: "Aanmaken" }).click();
  await page.waitForTimeout(1200);
  await shot("created");
  const r = await page.evaluate(async () => {
    const list = await (await fetch("/api/materials")).json();
    const m = list.find((x) => x.name === "Tentwarmer QA");
    const add = await fetch(`/api/materials/${m.id}/stock-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    return { dayPrice: m.dayPrice, priceBasis: m.priceBasis, subhireOnly: m.subhireOnly, subhireUnitCost: m.subhireUnitCost, add: add.status };
  });
  check(Number(r.dayPrice) === 25, `dayPrice ${r.dayPrice}`);
  check(r.priceBasis === "per_huur", `priceBasis ${r.priceBasis}`);
  check(r.subhireOnly === true, `subhireOnly ${r.subhireOnly}`);
  check(Number(r.subhireUnitCost) === 15, `subhireUnitCost ${r.subhireUnitCost}`);
  check(r.add === 409, `stock add status ${r.add}`);
};
module.exports.meta = { expectHttp: [409] };
