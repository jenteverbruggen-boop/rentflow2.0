// Idempotently creates QA roles + users: FREELANCER_QA (scope own) and PLANNER_NOMONEY (scope all, no Kosten/Cijfers).
// PUT /api/permissions replaces the WHOLE matrix, so other roles' rows are re-sent unchanged.
module.exports = async ({ page, BASE, check }) => {
  await page.goto(`${BASE}/`);
  const out = await page.evaluate(async () => {
    const j = async (u, m = "GET", b) => {
      const r = await fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: b && JSON.stringify(b) });
      return { s: r.status, d: await r.json().catch(() => null) };
    };
    const mods = ["projecten", "planning", "personen", "materialen", "klanten", "locaties", "kosten_facturen", "cijfers", "gebruikers", "instellingen", "notities"];
    const roles = (await j("/api/roles")).d;
    const ensureRole = async (key, label, scope) => {
      const role = roles.find((r) => r.key === key) ?? (await j("/api/roles", "POST", { key, label })).d;
      await j(`/api/roles/${role.id}`, "PUT", { scope });
      return role.id;
    };
    const free = await ensureRole("FREELANCER_QA", "Freelancer QA", "own");
    const plan = await ensureRole("PLANNER_NOMONEY", "Planner zonder geld", "all");
    const levels = {
      [free]: { projecten: "lezen", planning: "wijzigen", materialen: "lezen", notities: "wijzigen" },
      [plan]: { projecten: "verwijderen", planning: "verwijderen", personen: "lezen", materialen: "wijzigen", klanten: "lezen", locaties: "lezen", notities: "wijzigen" },
    };
    const current = (await j("/api/permissions")).d.filter((p) => p.roleId !== free && p.roleId !== plan);
    const mine = [free, plan].flatMap((roleId) => mods.map((module) => ({ roleId, module, access: levels[roleId][module] ?? "geen" })));
    const perm = await j("/api/permissions", "PUT", { permissions: [...current, ...mine] });
    const p14 = (await j("/api/projects/14")).d;
    const personId = p14.periods.flatMap((pe) => pe.people ?? pe.persons ?? []).map((x) => x.personId ?? x.person?.id).find(Boolean);
    const users = (await j("/api/users")).d ?? [];
    const ensureUser = async (email, name, roleId, extra) =>
      users.some((u) => u.email === email) ? 200 : (await j("/api/users", "POST", { email, name, password: "qa-pass-123", roleId, ...extra })).s;
    return { perm: perm.s, u1: await ensureUser("free@qa.dev", "Freelancer QA", free, { personId }), u2: await ensureUser("plan@qa.dev", "Planner QA", plan) };
  });
  check(out.perm === 200, `permissions PUT ${out.perm}`);
  check(out.u1 < 300 && out.u2 < 300, `user create ${out.u1}/${out.u2}`);
};
