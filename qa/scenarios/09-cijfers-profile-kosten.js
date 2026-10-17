// Smoke: cijfers, profile theme switch (persists across pages), kosten tab render.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/cijfers`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await shot("cijfers");
  check((await page.locator("main").innerText()).trim().length > 0, "cijfers page empty");
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: /licht/i }).or(page.getByRole("button", { name: /licht/i })).first().click();
  await page.waitForTimeout(1000);
  const cls1 = await page.evaluate(() => document.documentElement.className);
  check(!/\bdark\b/.test(cls1), `profile: html still dark after choosing licht (${cls1})`);
  await page.goto(`${BASE}/projects/14`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Kosten" }).click();
  await page.waitForTimeout(1000);
  await shot("kosten");
  const cls2 = await page.evaluate(() => document.documentElement.className);
  check(!/\bdark\b/.test(cls2), `theme not persisted on other page (${cls2})`);
  check((await page.locator("main").innerText()).trim().length > 0, "kosten tab empty");
};
