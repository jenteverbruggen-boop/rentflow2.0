# Phase 3 exit report

All of phase 3 (DDL-3, J2b, K1, K4, K2, K3, I1, I2, I3, J3) is merged onto
`main` via fast-forward, branch by branch. `npx tsc --noEmit`, `npm run lint`,
and `npm test` are green on `main` at HEAD (**571 passed, 2 skipped, 3 todo,
58 test files**).

## 1. Branch + commit list per item

| Item | Branch | Commits (oldest → newest) |
|---|---|---|
| DDL-3 | `ddl3-invoices` | `06c2c21` fix(materials): coerce Decimal before comparing import rows (pre-existing M1.4 bug, only visible against the Postgres client) · `0c5fd0b` feat(db): add invoice models · `3cc80f3` feat(db): snapshot bundle component ratios · `7ed9938` chore(seed): chart-grade volume and invoice spread |
| J2b — invoices | `j2b-invoices` | `e2ee51d` feat(invoices): generate draft invoice lines from a project (J2b.1) · `2ba4db5` feat(invoices): create and store draft invoices (J2b.2) · `b18ef20` feat(invoices): allocate gapless sequential numbers on finalisation (J2b.3) · `6e51a42` feat(invoices): freeze a sent invoice (J2b.4) · `663b130` feat(invoices): credit notes (J2b.5) · `4f056fa` feat(invoices): payment records and partial-payment status (J2b.6) · `a1aa20e` feat(invoices): overview page (J2b.7) · `dff8fb8` feat(invoices): printable invoice document (J2b.8) · `d4278a5` feat(settings): invoice settings (J2b.9) |
| K1 — stats aggregation | `k1-stats-api` | `d2e5c26` feat(stats): aggregate business figures |
| K4 — material payback | `k4-payback` | `57efaad` feat(stats): compute material payback |
| K2 — figures page | `k2-cijfers-page` | `7258bdb` feat(deps): add recharts and a chart wrapper · `4d57b54` feat(cijfers): revenue, utilisation, top materials and payback |
| K3 — dashboard tiles | `k3-dashboard-tiles` | `fbc538b` feat(dashboard): add headline figures |
| I1 — view switcher | `i1-planning-views` | `4c15748` feat(planning): day/week/month switcher |
| I2 — period bucketing | `i2-planning-periods` | `9919cc8` feat(planning): place periods, not projects, and show times |
| I3 — person view | `i3-planning-persons` | `a6e7aad` feat(planning): toggle between project and person rows |
| J3 — print CSS consolidation | `j3-print-css` | `9e99990` refactor(print): consolidate print styles |
| (discovered during this exit report) | `phase3-exit-report` | `717cd8d` test(scoping): cover stats and invoices in the N5.4 enumeration — a stale phase-1 `it.todo` for `/api/stats` scoping was never converted to a real assertion once K1 landed; fixed here, no behavior change (the route itself already denied `scope: own` correctly) |

Every item's own commits were individually green (`tsc`/`lint`/`test`) at the
time they landed, per `00-README.md`'s discipline; nothing was squashed.

## 2. Invoice numbering evidence (J2b.3)

Run live against the compose Postgres service (temporarily published on
`5432:5432` for this verification, reverted via `git checkout --
docker-compose.yml` immediately after):

```
✓ src/lib/invoice-numbering.postgres.test.ts (2 tests) 536ms
  ✓ 20 concurrent finalisations produce a gapless, duplicate-free sequence
  ✓ interleaved invoice + credit-note finalisations keep both series independent
```

20 concurrent `POST /finalize` calls against the same year produced exactly
`{"2026-0001", …, "2026-0020"}` — no duplicates, no gaps. A second run
interleaving `series: "invoice"` and `series: "credit"` finalisations showed
each series numbering independently (`2026-0001…N` and `CN-2026-0001…N` both
gapless on their own). `npx tsc --noEmit` was also re-run against the
regenerated Postgres client (not just the dev SQLite one) — zero errors,
confirming no Decimal-vs-number drift in the numbering path either.

## 3. Freezing evidence (J2b.4)

`invoice-freezing.integration.test.ts`'s mandatory regression case: create a
draft → finalize it → mutate the underlying project (rename the booked
person, re-snapshot their `dayPrice` from its original value to `9999`) →
re-fetch the invoice from the DB → assert its `lines` and all five totals
(`subtotalExcl`, `travelExcl`, `deductionExcl`, `vatAmount`, `totalIncl`) are
`toEqual` the pre-mutation snapshot, byte-identical. Passes. A second case in
the same file confirms every line/total-mutating route (manual line add,
update, delete, regenerate) is rejected with `409` once `status !== "concept"`.

## 4. Payback evidence (K4) — the cocktailtafel case

`payback.test.ts`, "a material rented only inside a set accrues its pro-rata
share, never €0 (Q48's cocktailtafel example)": a €8/day bundle booking
(cocktailtafel + hoes) with snapshotted component weights
`dayPriceAtBooking: 5` (table) and `dayPriceAtBooking: 3` (hoes) — the table,
booked **only** inside the set, earns `8 × 5/8 = €5` per rental day, not €0.
A sibling case (`Tap + aciet`) confirms a genuinely €0-weighted component
(`aciet`) correctly earns nothing rather than an equal split masking it. Both
pass, alongside the "cost price 300 + €330 → 110%" case and the
all-weights-zero equal-split fallback. `compute-payback.integration.test.ts`
reproduces the same cocktailtafel case end-to-end against a real booked
bundle in the seeded dev DB.

## 5. Module guards and N2.5's enumeration test

`route-guards.test.ts` (N2.5): **163/163** handlers pass — every route
exported since phase 0, including all of phase 3's new routes
(`/api/stats`, all ten `/api/invoices*` handlers, `/api/planning/persons`),
declares a `requireModule(...)` call. `scope-enumeration.test.ts` (N5.4):
**70 passed, 2 todo** (the 2 remaining `it.todo`s are phase-4 forward
placeholders for `/api/calendar` (O1) and the export routes (P2), not
phase-3 work) — this file previously had a stale `it.todo` for `/api/stats`
left over from phase 1 (see item 1's last row); it's now a real assertion,
alongside 14 new assertions covering every `/api/invoices/*` handler.

## 6. N5 scoping decision for Cijfers, as implemented

Per `.plans/own-data-scoping-design.md:192`: **`scope: own` is denied
entirely** for `GET /api/stats`, unconditionally, regardless of the caller's
`Cijfers` matrix level — aggregate company revenue/utilisation/payback
figures have no "my own" reading a freelancer has legitimate use for, and
every figure on that page is money-shaped. Implemented at
`src/app/api/stats/route.ts:17` (`if (access.scope === "own") return
forbidden();`), and the same unconditional deny is applied across every
`/api/invoices/*` handler (J2b) for the identical reasoning. Both are now
covered by the N5.4 static enumeration test (item 5 above), not just a
one-off manual check.

This differs from `/api/planning/persons` (I3), which is deliberately
**restricted, not denied**: a `scope: own` caller sees only their own person
row (filtered by `personId`), never a 403 — planning is the one phase-3
surface where a freelancer legitimately has an "own" reading (their own
bookings), unlike aggregate money figures.

## 7. Print documents verified after J3

Per the phase-3 brief's literal "five print documents," this session
identified and verified **six** actual print surfaces (the kosten tab has
both an inline print button and, separately, the dedicated `/kosten` print
page from J2a — two distinct surfaces sharing the "kosten" name):

1. Pakbon (`projects/[id]/pakbon`) — `PrintLayout`, default full-grid table style, unchanged.
2. Callsheet (`projects/[id]/callsheet`) — `PrintLayout`, same, unchanged.
3. Kosten tab's own inline print (`project-costs-tab.tsx`, `window.print()`) — migrated onto the shared `.print-root`; its row-separator-only table style preserved via the new `.cost-table` scoping class (`cost-period-section.tsx`).
4. Kosten print page (`projects/[id]/kosten`) — `PrintLayout` + `KostenPeriodTable`, keeps the shared default full-grid table look it already relied on; confirmed no conflicting print-specific rule of its own.
5. Invoice print page (`facturen/[id]/print`, J2b.8) — `PrintLayout`, no local print CSS of its own even before J3 (reused `PrintLayout`'s rules verbatim); unaffected by the consolidation beyond inheriting the same shared block.
6. Materiaallabels (`materials/labels`) — migrated its visibility root from `.label-sheet` to `.print-root`; kept a small page-local `@page { margin: 10mm }` override (deliberately not folded into the shared `1.5cm`, since the label grid's fixed-mm layout depends on it).

Verification was by reading the merged CSS against each surface's original,
pre-consolidation block to confirm no rule was silently dropped or changed
— **not** a literal browser print-preview click-through. This sandboxed
environment has no display/browser available, consistent with this
session's established practice on other datetime/visual items (see phase
2's H1.3 caveat) of flagging environment limits rather than claiming
unverified visual verification.

## 8. For the PO to check

- Create an invoice from a project, send it (finalize), then edit the
  underlying project (change a booked person's price or rename them) —
  confirm the sent invoice's lines and totals do not change.
- Open `/cijfers` and confirm the payback lists (best/worst) look plausible
  against real purchase prices — in particular, that a material that is
  rented only inside a set (e.g. a cocktailtafel with its hoes) shows a
  nonzero payback share rather than 0%.
- Print each of the six documents listed in item 7 and visually confirm none
  regressed (this could not be done in the agent's own environment).
