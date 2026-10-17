// A cancelled project can still be invoiced (project 13).
module.exports = async ({ page, BASE, check }) => {
  await page.goto(`${BASE}/`);
  const r = await page.evaluate(async () => {
    const p = await (await fetch("/api/projects/13")).json();
    const put = await fetch("/api/projects/13", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: p.name, client: p.client, clientId: p.clientId, location: p.location, locationId: p.locationId, status: "geannuleerd", notes: p.notes, startDate: p.startDate, endDate: p.endDate }) });
    const inv = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: 13, invoiceRole: "standalone" }) });
    return { cancel: put.status, invoice: inv.status, body: (await inv.text()).slice(0, 200) };
  });
  check(r.cancel === 200, `cancel status ${r.cancel}`);
  check(r.invoice === 201, `invoice status ${r.invoice} ${r.body}`);
};
