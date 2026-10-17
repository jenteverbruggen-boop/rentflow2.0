// Draft invoice for confirmed project 14 carries owned + hired lines at sale price.
module.exports = async ({ page, BASE, check }) => {
  await page.goto(`${BASE}/`);
  const r = await page.evaluate(async () => {
    const x = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: 14, invoiceRole: "standalone" }) });
    const j = await x.json();
    const id = j.id ?? j.invoice?.id;
    const inv = id ? await (await fetch(`/api/invoices/${id}`)).json() : j;
    return { status: x.status, lines: (inv.lines ?? []).filter((l) => /Generator|Cocktail/.test(l.description)).map((l) => `${l.description} q${l.quantity} à ${Number(l.unitPrice)} = ${Number(l.lineTotalExcl)}`) };
  });
  check(r.status < 300, `invoice create status ${r.status}`);
  check(r.lines.includes("Cocktailtafel q11 à 10 = 110"), `lines: ${JSON.stringify(r.lines)}`);
  check(r.lines.includes("Generator 20kVA q2 à 150 = 300"), `lines: ${JSON.stringify(r.lines)}`);
};
