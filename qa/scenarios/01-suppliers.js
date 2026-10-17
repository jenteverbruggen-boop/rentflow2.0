// Create the two suppliers Funrent and Rent-men through the UI.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/leveranciers`);
  await page.waitForLoadState("networkidle");
  for (const name of ["Funrent", "Rent-men"]) {
    await page.getByRole("button", { name: /nieuw|toevoegen|leverancier/i }).first().click();
    await page.getByRole("dialog").getByLabel(/naam/i).first().fill(name);
    await page.getByRole("dialog").getByRole("button", { name: /opslaan|toevoegen|aanmaken/i }).click();
    await page.waitForTimeout(800);
  }
  await shot("filled");
  const list = await page.evaluate(async () => (await (await fetch("/api/suppliers")).json()).map((s) => s.name));
  check(list.includes("Funrent") && list.includes("Rent-men"), `suppliers missing, got ${JSON.stringify(list)}`);
};
