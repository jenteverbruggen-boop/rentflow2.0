// Picker shows "/huur" price basis; hire dialog cost prefill resets per supplier.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/projects/14`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.getByPlaceholder(/zoeken op naam of categorie/i).first().fill("Tentwarmer");
  await page.waitForTimeout(800);
  const picker = await page.locator("div.rounded", { hasText: "Tentwarmer QA" }).first().locator("p").first().innerText();
  check(/€\s25,00\/huur/.test(picker), `picker row: ${picker}`);
  const mat = await page.evaluate(async () => (await (await fetch("/api/materials")).json()).find((m) => m.name === "Cocktailtafelhoes"));
  await page.evaluate(async (id) => {
    const p = await (await fetch(`/api/materials/${id}`)).json();
    await fetch(`/api/materials/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, defaultSupplierId: 1, subhireUnitCost: 3.5 }) });
    await fetch("/api/periods/4/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: id, quantity: 9, allowOverbook: true }) });
  }, mat.id);
  await page.goto(`${BASE}/projects/2`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.waitForTimeout(1200);
  await page.locator("[role=alert]").first().getByRole("button", { name: "Inhuren" }).first().click();
  const d = page.getByRole("dialog");
  const cost = d.locator("input[type=number]").nth(1);
  const v0 = await cost.inputValue();
  await d.getByRole("combobox").first().click(); await page.getByRole("option", { name: "Rent-men" }).click();
  const v1 = await cost.inputValue();
  await d.getByRole("combobox").first().click(); await page.getByRole("option", { name: "Funrent" }).click();
  const v2 = await cost.inputValue();
  check(JSON.stringify([v0, v1, v2]) === JSON.stringify(["3.5", "", "3.5"]), `cost prefill ${JSON.stringify([v0, v1, v2])}`);
  await shot("hire-dialog");
};
