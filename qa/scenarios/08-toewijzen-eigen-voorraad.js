// Toewijzen assigns the overbooked units, "Eigen voorraad gebruiken" swaps hired -> stock, reopen 15.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/projects/2`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Toewijzen" }).click();
  await page.waitForTimeout(1500);
  check((await page.locator("text=/2 overboekte unit\\(s\\) toegewezen/").count()) > 0, "'2 overboekte unit(s) toegewezen' not shown");
  await page.getByRole("button", { name: /eigen voorraad gebruiken/i }).click();
  await page.waitForTimeout(1500);
  await shot("after-to-stock");
  const msgs = await page.locator("text=/af te bellen/").allInnerTexts();
  check(msgs.some((t) => /Vergeet Funrent niet af te bellen \(2× Cocktailtafelhoes\)/.test(t)), `notice missing: ${JSON.stringify(msgs)}`);
  await page.goto(`${BASE}/projects/15`);
  await page.waitForLoadState("networkidle");
  await page.getByText("geannuleerd", { exact: true }).first().click();
  await page.getByRole("menuitem", { name: /^concept/i }).or(page.getByRole("option", { name: /^concept/i })).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.waitForTimeout(1500);
  await shot("p15-reopened");
  const banner = await page.locator("[role=alert]").first().innerText().catch(() => "");
  check(/6 nu vrij/.test(banner) && /bezet door Sunset Beach Fest \(concept\)/.test(banner), `reopened banner: ${banner.slice(0, 300)}`);
};
