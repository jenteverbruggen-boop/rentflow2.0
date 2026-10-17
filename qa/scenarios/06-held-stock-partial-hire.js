// Project 15 holds all 10 Cocktailtafelhoes; project 2 asks 4 overbooked, hires 2.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/`);
  const r = await page.evaluate(async () => {
    const post = async (u, b) => (await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).status;
    return [await post("/api/periods/38/materials", { materialId: 107, quantity: 10 }),
            await post("/api/periods/4/materials", { materialId: 107, quantity: 4, allowOverbook: true })];
  });
  check(r.every((s) => s < 300), `seed bookings failed: ${JSON.stringify(r)}`);
  await page.goto(`${BASE}/projects/2`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.waitForTimeout(1500);
  await shot("banner-held");
  const banner = page.locator("[role=alert]").first();
  check(/bezet door Wijnproeverij Kasteeltuin \(concept\)/.test(await banner.innerText()), "banner lacks 'bezet door Wijnproeverij Kasteeltuin (concept)'");
  check(await page.getByRole("button", { name: "Toewijzen" }).isDisabled(), "Toewijzen should be disabled");
  await banner.getByRole("button", { name: "Inhuren" }).first().click();
  const d = page.getByRole("dialog");
  await d.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Funrent" }).click();
  await d.getByRole("spinbutton").first().fill("2");
  await d.locator("input[type=number]").nth(1).fill("4");
  await d.getByRole("button", { name: "Inhuren" }).click();
  await page.waitForTimeout(1500);
  await shot("after-hire");
  check(/2 overboekt/.test(await page.locator("[role=alert]").first().innerText()), "banner lacks '2 overboekt' after partial hire");
};
