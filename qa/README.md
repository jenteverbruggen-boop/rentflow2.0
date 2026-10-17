# QA click-through suite

Playwright scenarios that drive the real UI of a production-mode build against a
fresh, seeded SQLite database. Covers: suppliers, inhuur-only materials, hire-in
bookings, held stock / partial hire / release on cancel, Toewijzen and "Eigen
voorraad gebruiken", draft invoice lines, price overrides, and a permission leak
scan for a scope-own freelancer (`free`) and a planner without money access (`plan`).

## Run

```bash
npx playwright install chromium     # once (or set QA_CHROMIUM=/path/to/chrome)
npm run qa
```

`npm run qa` (`qa/qa.sh`) runs `qa/serve.sh` (fresh `qa/.out/qa.db`, seed, `npm run build`,
standalone server on `127.0.0.1:3100`), waits for it, runs `qa/run.mjs`, stops the server and
exits with the runner's code. Server log: `qa/.out/server.log`; screenshots: `qa/.out/shots/`.
Run one scenario against a running server: `QA_BASE=http://127.0.0.1:3100 node qa/run.mjs 06`.

It exits 1 on a failed `check`, a thrown error, any `pageerror`, any HTTP 5xx, or any HTTP 4xx
the scenario did not declare.

## Safety

Never targets production: it builds and serves its own instance with its own DB and random
`JWT_SECRET`, never touches `prisma/dev.db` or your dev server on :3000, and refuses to start
if port 3100 is taken. Do not point `QA_BASE` at a real environment: scenarios write data.

## Seed-id dependency and ordering

Scenarios share one database and run in filename order on a FRESH seed (`prisma/seed.ts`).
They rely on seed ids: project 14 (bevestigd, period 35 "Event"), project 15 (concept, period 38),
project 2 (concept, period 4), project 13, material Cocktailtafelhoes (id 107, 10 units),
Cocktailtafel (dayPrice 5, 10 units), supplier id 1 = Funrent (created by scenario 01).
If the seed changes, update the scenarios.

## Add a scenario

Create `qa/scenarios/NN-name.js` (next number; later scenarios see earlier state):

```js
module.exports = async ({ page, BASE, shot, check }) => {
  await page.goto(`${BASE}/materials`);
  check(await page.getByText("Cocktailtafel").count() > 0, "Cocktailtafel not listed");
  await shot("list");                       // qa/.out/shots/NN-name-list.png
};
// optional: expected 4xx statuses, and which user ("admin" default, "free", "plan")
module.exports.meta = { expectHttp: [409], user: "admin" };
```
