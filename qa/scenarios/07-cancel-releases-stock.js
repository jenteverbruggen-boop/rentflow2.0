// Cancelling project 15 releases its held units; project 2 sees them free.
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/projects/15`);
  await page.waitForLoadState("networkidle");
  await page.getByText("concept", { exact: true }).first().click();
  await page.getByRole("menuitem", { name: /geannuleerd/i }).or(page.getByRole("option", { name: /geannuleerd/i })).first().click();
  await page.waitForTimeout(1500);
  await shot("cancel-dialog");
  const dlg = await page.getByRole("dialog").or(page.getByRole("alertdialog")).first().innerText().catch(() => "none");
  check(/13 unit\(s\) vrijgegeven/.test(dlg), `release dialog: ${dlg.slice(0, 200)}`);
  await page.goto(`${BASE}/projects/2`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Materialen" }).click();
  await page.waitForTimeout(1500);
  const banner = await page.locator("[role=alert]").first().innerText();
  check(/2 nu vrij/.test(banner), `banner lacks '2 nu vrij': ${banner.slice(0, 200)}`);
  check(/Eigen voorraad gebruiken/i.test(banner) || (await page.getByRole("button", { name: /eigen voorraad gebruiken/i }).count()) > 0, "'Eigen voorraad gebruiken' not visible");
  await shot("project2-after-cancel");
};
