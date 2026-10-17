// Ad-hoc hire item: second create with the same name -> 409 and a "reuse" action.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/projects/14`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.waitForTimeout(800);
  for (const attempt of [1, 2]) {
    await page.getByRole("button", { name: /Inhuur-item/ }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Naam *").fill("Generator 20kVA");
    await d.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Rent-men" }).click();
    await d.getByLabel("Aantal *").fill("1");
    await d.getByLabel("Verkoopprijs (€)").fill("150");
    await d.getByLabel("Inkoopprijs (€)").fill("90");
    await d.getByRole("button", { name: /inhuren|toevoegen|aanmaken/i }).last().click();
    await page.waitForTimeout(1500);
    await shot(`attempt-${attempt}`);
    if (attempt === 2) {
      const reuse = d.getByRole("button", { name: /bestaand item gebruiken/i });
      check((await reuse.count()) > 0, "'Bestaand item gebruiken' not offered on name clash");
      if (await reuse.count()) { await reuse.click(); await page.waitForTimeout(1500); }
    }
  }
  await shot("reuse");
  const text = await page.locator("main").innerText();
  check(/Generator 20kVA ×2/.test(text), "Generator 20kVA ×2 not shown after reuse");
};
module.exports.meta = { expectHttp: [409] };
