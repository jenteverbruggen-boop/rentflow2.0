// Book 12 Cocktailtafel (10 in stock) with hire-in, plus the inhuur-only Tentwarmer, in confirmed project 14.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/projects/14`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.waitForTimeout(800);
  const search = page.getByPlaceholder(/zoeken op naam of categorie/i).first();
  await search.fill("Cocktailtafel");
  await page.waitForTimeout(600);
  const row = page.locator("div.rounded", { hasText: "/10 vrij" }).filter({ hasText: /^Cocktailtafel/ }).first();
  await row.getByRole("spinbutton").fill("12");
  await row.getByRole("combobox").click();
  await page.getByRole("option", { name: /inhuren bij Funrent/ }).click();
  await row.getByRole("button").last().click();
  await page.waitForTimeout(1500);
  await shot("after-book");
  await search.fill("Tentwarmer");
  await page.waitForTimeout(600);
  const tw = page.locator("div.rounded", { hasText: "Tentwarmer QA" }).first();
  await tw.getByRole("spinbutton").fill("3");
  await tw.getByRole("button").last().click();
  await page.waitForTimeout(1500);
  await shot("after-tentwarmer");
  const text = await page.locator("main").innerText();
  check(/Cocktailtafel ×12/.test(text), "Cocktailtafel ×12 not shown after booking");
  check(/Tentwarmer QA ×3/.test(text), "Tentwarmer QA ×3 not shown after booking");
  check(/ingehuurd/.test(text), "no 'ingehuurd' text after booking");
};
