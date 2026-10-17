// "−" on an assigned row, trash on all units, ad-hoc dialog opens.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/projects/14`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.waitForTimeout(800);
  const assigned = (name) => page.locator("div.rounded", { hasText: name }).filter({ has: page.getByTitle(/unit verwijderen/i) }).last();
  await assigned("Cocktailtafel").getByTitle(/unit verwijderen/i).click();
  await page.waitForTimeout(1500);
  await shot("after-minus");
  check((await page.locator("text=/Cocktailtafel ×11/").count()) > 0, "Cocktailtafel ×11 missing after minus");
  const hired = await page.locator("text=/ingehuurd/").allInnerTexts();
  check(hired.some((t) => /1 ingehuurd/.test(t)), `no '1 ingehuurd': ${JSON.stringify(hired)}`);
  await assigned("Tentwarmer QA").getByTitle(/alle units verwijderen/i).click();
  await page.waitForTimeout(1500);
  await shot("after-trash");
  const warn = await page.locator("text=/af te bellen/").allInnerTexts();
  check(warn.some((t) => /Vergeet Funrent niet af te bellen/.test(t)), `warning missing: ${JSON.stringify(warn)}`);
  check((await page.locator("text=/Tentwarmer QA ×/").count()) === 0, "Tentwarmer still assigned after trash");
  await page.getByRole("button", { name: /Inhuur-item/ }).click();
  check(await page.getByRole("dialog").isVisible(), "ad-hoc dialog did not open");
  await shot("adhoc-dialog");
};
