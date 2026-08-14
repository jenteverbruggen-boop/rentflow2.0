# Phase 3 — Invoices, business figures, planning granularity

> Read `00-README.md` first. Source decisions: `.plans/2026-08-po-feedback-round2.md` (Q23–Q25c, Q26–Q29, Q48, Q20, Q21).
> **v2 — one adversarial review round folded in (7 findings, 2 high-severity).**
> 10 items + 1 DDL commit, ~29 commits.
> **Gate to start:** phase 2 merged · ⛔ **`.plans/invoice-design.md` approved** (blocks J2b, and K1's invoiced series depends on J2b).

## Order

```
DDL-3 (alone, first: invoice models + chart seed data)
  ├─► J2b (invoices) ──────────────► K1 (stats: invoiced series needs invoices)
  │                                    ├─► K4 (payback)
  │                                    ├─► K2 (figures page) ──► K3 (dashboard tiles)
  ├─► I1 (view switcher) ──► I2 (period bucketing) ──► I3 (person view)
  └─► J3 (print CSS consolidation)     [after J2b's document exists]
```

**One worker owns the K chain** (K1 → K4 → K2 → K3): they share the stats contract. **One worker owns the I chain.** J2b is large enough to be its own worker and its own multi-session effort.

## Inherited obligations

1. **Every new route needs `requireModule(...)`** or N2.5's enumeration test fails. New routes here: `/api/stats` (**Cijfers**), `/api/invoices/*` (**Kosten/Facturen**).
2. **Every new money field goes into `src/lib/redact.ts`** and through Y1's serializer. Invoice totals and payback figures are commercial data: a role with `Kosten/Facturen: geen` must receive none of it, and `Cijfers` access alone must not become a side door to rates.
3. **N5 scoping:** `/api/stats` was registered as a forward entry in N5.4's enumeration test. An own-scoped user's figures must cover only their own bookings — or, if that makes no sense for a freelancer, deny `Cijfers` to scoped roles outright and say so. Decide in K1.1 and write it down.
4. **`prisma/seed.ts` belongs to the DDL-3 worker** — see DDL-3 below for why the chart seed data lands there and not in K2.
5. **`src/lib/pricing.ts`'s phase-3 owner is the J2b worker.** J2b.1 reuses and extends its cost maths, and K1/K4 may also want new exports — two workers in a "one owner per phase" critical file is exactly what `00-README.md` forbids. The K-chain worker therefore requests any `pricing.ts` addition from the J2b worker rather than editing it, or the two items are assigned to the same person.

---

## DDL-3 — invoice models and chart-grade seed data `lands alone, first`

**Branch:** `ddl3-invoices` · **one commit** (two if the seed volume makes review unwieldy — then `feat(db):` then `chore(seed):`)

**`feat(db): add invoice models`**

Exact model shape comes from `.plans/invoice-design.md` (approved before this starts). Both schemas + seed. The design doc's data-model section is authoritative; this brief only records the constraints it must satisfy:

- `Invoice` and `InvoiceLine`, with `number String @unique`, invoice/due dates, `status` (String + TS union + zod — **no Prisma enum**), snapshotted client identity (name, address, VAT) so a later client edit cannot rewrite a sent invoice, `creditNoteOfId` self-relation, and money as `Decimal` (PG) / `Float` (dev).
- **`InvoiceLine.vatRate` per line**, even though Q25a chose a single global setting — this is what makes per-line VAT a later config change rather than a migration.
- A numbering counter mechanism per the design doc (gapless, sequential, generated inside the finalising transaction).
- Settings keys for payment terms, bank account holder, invoice number format, invoice footer, and the BTW rate (Q25a/Q25b) — extend `SETTING_KEYS` in `src/lib/settings.ts:3-11`.
- `src/types/index.ts`: the client-side mirror for all of the above (hand-maintained, not generated).
- **Also required by K4 — snapshot the bundle component ratio.** `MaterialComponent` carries only `quantity` (`prisma/schema.prisma:205-214`) and component lines are booked at `dayPriceSnapshot: 0` (`src/lib/booking.ts:153-154`). K4's pro-rata split therefore has nothing historical to divide by, and deriving the weight from the **live** `Material.dayPrice` means any later price edit silently rewrites the payback attribution of every past booking. Add a `PeriodBundleBookingComponent { id, bundleBookingId, materialId, quantity, dayPriceAtBooking Decimal }` row written at booking time (extend `bookBundleMaterial` in `src/lib/booking.ts:120-160`), or an equivalent stored ratio on `PeriodBundleBooking`. Without this, K4 cannot be historically stable — and it must land in this migration because DDL-3 is the phase's only one.

**Chart-grade seed data ships in this commit too.** K2 cannot be judged against the current seed: 4 projects, 6 periods, **zero** `PeriodBundleBooking` and **zero** `PersonTravelCost` rows. Extend `prisma/seed.ts` to roughly **20 projects across 12 months, 40+ periods, travel costs on ~30% of person bookings, at least 2 booked bundles** (needed for K4's bundle-split path to be exercised at all), day rates in the existing €200–450 range, and a handful of invoices in mixed statuses. It lands here rather than in K2 because `seed.ts` has one owner per phase.

- **Verify:** `npm run db:dev:reset` succeeds and produces the described volumes; `docker compose run --rm app sh -c "npx prisma migrate deploy"` applies cleanly; existing data untouched.

---

## J2b — Real invoices `XL` `design doc first` `expect multiple sessions`

**Branch:** `j2b-invoices` · ⛔ **do not start without `.plans/invoice-design.md` approved**

Decided: RentFlow becomes the invoicing system (Q23) — numbered invoices, invoice/due dates, status, **frozen** amounts, credit notes, an overview page. Lines **grouped per period** (Q24). BTW from a setting but stored per line (Q25a). **Peppol-shaped but not Peppol-connected** (Q25c). Travel outside the subtotal, inside the total (Q22).

Current state: no invoice feature exists at all (`factuur|invoice` → zero hits in `src/`). The nearest artifact is the Kosten tab, and J2a (phase 2) already gave it a proper printable document with company and client details.

**J2b.1 — `feat(invoices): generate draft invoice lines from a project`**
- A pure library function: project + periods → grouped draft lines (people, materials, travel), reusing `src/lib/pricing.ts` rather than reimplementing any cost maths. Unit-tested against a seeded project. No persistence yet.

**J2b.2 — `feat(invoices): create and store draft invoices`**
- `POST /api/invoices` (from a project), `GET /api/invoices`, `GET /api/invoices/[id]` — module **Kosten/Facturen**. Drafts carry **no number** yet.

**J2b.3 — `feat(invoices): allocate gapless sequential numbers on finalisation`**
- Number assigned inside the transaction that moves `concept` → `verzonden`, per the design doc's counter mechanism. Never at draft time, never reused; deleting a draft must leave no hole.
- **Test concurrency explicitly against Postgres, not the SQLite dev DB.** A gapless counter needs row-level locking; SQLite serialises writes behind a file lock, so the same test is either a false green (no real race exercised) or a flaky red (`SQLITE_BUSY`). Use the compose Postgres, following the pattern in `src/lib/booking.integration.test.ts` for a real-database test.

**J2b.4 — `feat(invoices): freeze a sent invoice`**
- Enforce immutability **at the API**: once status leaves `concept`, lines and totals cannot change, and editing the underlying booking, rate or project must not alter the invoice. Test that directly — it is the entity's whole purpose.

**J2b.5 — `feat(invoices): credit notes`**
- A correction creates a linked credit note (`creditNoteOfId`); the original stays untouched. Define how totals and reporting treat the pair (K1 must not double-count).

**J2b.6 — `feat(invoices): overview page`**
- List with status/client filters, create-from-project flow, status transitions, credit-note action. Extract components — the 150-line limit applies.

**J2b.7 — `feat(invoices): printable invoice document`**
- Reuse `PrintLayout` + `DocumentHeader` and J2a's layout. Sections per period (Q24), travel lines below the subtotal, VAT summary per rate, payment terms, IBAN + account holder, footer.
- Keep document generation **behind a small interface** so a UBL/XML emitter can be added beside the PDF path later without touching the routes (Q25c).

**J2b.8 — `feat(settings): invoice settings`**
- Payment terms, bank account holder, number format, footer, BTW rate — wired into `src/components/settings-form.tsx` (163 lines today: extract rather than exceed 150).

**Out of scope, explicitly:** Peppol/UBL emission, access-point integration, delivery tracking, payment reconciliation, recurring invoices, multi-currency, dunning.

---

## K1 — Aggregation endpoint

**Branch:** `k1-stats-api` · **after J2b** · **owns the stats contract**

No stats endpoint exists among the 40 route files; no `.aggregate(`/`.groupBy(` anywhere. The dashboard counts client-side over full payloads (`src/app/(app)/page.tsx:41,47,53`). Y1 (phase 0) is a hard dependency — aggregating Decimals-as-strings produces silent nonsense.

**K1.1 — `feat(stats): aggregate business figures`**
- `GET /api/stats?from=&to=` — module **Cijfers: lezen**. Decided response shape (Q27 + Q29 — every revenue figure carries a booked **and** an invoiced value):
  ```ts
  { range: { from: string; to: string },
    revenueByMonth: { month: "2026-06"; bookedPeople: number; bookedMaterials: number;
                      bookedTravel: number; booked: number; invoiced: number }[],
    revenueByClient: { clientId: number; name: string; booked: number; invoiced: number }[],
    personUtilisation: { personId: number; name: string; bookedDays: number; bookedHours: number }[],
    topMaterials: { materialId: number; name: string; code: string | null; revenue: number }[] }
  ```
- Aggregate server-side. Prefer Prisma `groupBy` or month-bucketing in JS over a lean projection — **do not** hand-write date-truncation SQL, which differs between SQLite (dev) and Postgres (prod).
- **Attribution differs between the two series and the page must not imply otherwise:** booked revenue is attributed to the *period*, invoiced revenue to the *invoice's* month. They will not line up.
- **Decided rule for periods spanning a month boundary** (e.g. 2026-05-28 → 2026-06-03): **split the line pro-rata by calendar days in each month.** `periodDays` (`src/lib/pricing.ts:26-35`) only returns a count, so without an explicit rule an implementer would silently bucket everything by `startDate` and put six of seven days' revenue in the wrong month. If pro-rata proves impractical for the invoiced series (an invoice has one date), bucket invoices by invoice date and say so in the UI legend.
- Credit notes must not double-count (J2b.5).
- **Decide and document the N5 scoping answer here** (obligation 3 above).
- Exclude archived materials from `topMaterials` (M1.3's rule).
- **Verify:** every money value is a JSON number (not a string) against **Postgres**; unit tests on the aggregation helpers.

**K1.2 — `test(stats): cover aggregation against seeded data`**
- Assert against DDL-3's seeded volumes: month buckets, client totals, utilisation, and that an invoiced total matches the sum of its invoice lines.

---

## K4 — Material payback `new PO ask`

**Branch:** `k4-payback` · **after K1**

*"A fridge costs us 300, I rent it out at 10, it's rented 30 times — did I pay off the fridge, and what percentage?"* Two top-10 lists: best and worst paid off.

**K4.1 — `feat(stats): compute material payback`**
- New `src/lib/payback.ts`, unit-tested:
  - Earned = `Material.revenueBefore` + flat-booking revenue + **bundle share**.
  - Flat revenue from `PeriodStockItem` snapshots grouped via `stockItem.materialId` — the join is `groupKey` at `src/lib/grouping.ts:34-41`, and the bundle-exclusion filter K4 needs already exists as `materials.filter((m) => !m.bundleBookingId)` inside `groupMaterialAssignmentsNested` (`src/lib/grouping.ts:74`). **Do not reuse the unfiltered `groupMaterialAssignments`** — it would count bundled component lines (at €0) as flat revenue and then add the bundle share on top.
  - Cost basis = sum of per-unit `StockItem.costPrice` where set, else `Material.costPrice` × units owned.
  - `paybackPct = earned / costBasis`; **undefined when no cost price is known → the material is excluded, never shown as 0%**.
  - **Gross rental income only** — the PO dropped the overhead percentage.
- **Bundle attribution (Q48) — the part that is easy to get wrong:**
  - Component lines inside a set are snapshotted at **€0** — verified at `src/lib/booking.ts:153-154` (`dayPriceSnapshot: 0, bundleBookingId: bBooking.id`) — so payback **must not** read component revenue from `PeriodStockItem.dayPriceSnapshot` for bundled lines. It must reconstruct from the bundle booking. `bundleBookingId != null` is the correct discriminator.
  - For each `PeriodBundleBooking`: take `dayPriceSnapshot × quantity × days` and split across the components **pro-rata by the weight snapshotted at booking time** (DDL-3's `PeriodBundleBookingComponent.dayPriceAtBooking × quantity`). **Never use the live `Material.dayPrice`** — that would recompute historical attribution every time a price changes.
  - **No double counting:** flat revenue must exclude `bundleBookingId != null` lines (the `grouping.ts:74` filter) and the bundle share must come only from the bundle bookings. Assert both in one test over a period containing a flat booking and a set booking of the same material.
  - Verified exact against the PO's live data: `Cocktailtafel` €5 + `cocktailtafelhoes` €3 = the €8 set; the buffet set likewise. A €0 component (e.g. "aciet" in `Tap + aciet` €75, where the tap alone is €75) correctly receives nothing.
  - **Edge case:** if every component weight is 0 but the bundle has a price, split equally. Never divide by zero; never silently drop the revenue.
  - Without this, ~52 physical units (15 cocktailtafels + 15 hoezen, 11 buffettafels + 11 hoezen) read €0 forever — exactly the items the PO wants numbers on.
- **Payback ignores the date range** — it is lifetime-to-date by definition.
- **Verify:** cost price 300 + €330 of bookings → 110%; no cost price → absent, not 0%; a cocktailtafel rented only inside the €8 set accrues €5 per rental day; the all-weights-zero fallback; archived materials excluded.

**K4.2 — `feat(stats): expose payback via the stats API`**
- Add a `payback: { best: [...], worst: [...] }` section (or a sibling endpoint — either, but keep one module guard and one contract).

---

## K2 — Figures page

**Branch:** `k2-figures-page` · **after K1, K4** · skills: **`dataviz` (read before writing any chart code)**, `design`

**K2.1 — `feat(deps): add recharts and a chart wrapper`**
- No chart library is installed (`recharts`/`chart.js`/`d3`/`visx` absent from `package.json`; `chart.js` exists only transitively). No `src/components/ui/chart.tsx`.
- Add `recharts` plus a shadcn-style `src/components/ui/chart.tsx` wrapper. React 19 compatibility is fine on current versions — verified: `recharts@3.10.1` declares peer `react: ^16.8 || ^17 || ^18 || ^19`. Pin the version you install and record it in the commit body. **Note the convention exception:** `src/components/ui/` is normally never edited, but this file *is* the shadcn chart primitive — add it as generated shadcn output and do not hand-modify it afterwards. Say so in the commit body.

**K2.2 — `feat(cijfers): revenue charts with tables`**
- New `/cijfers` page (Q26) with a date-range control. Decided chart mapping: revenue per month → stacked bars (personeel/materiaal/reis) with the invoiced series as a line over them; revenue per client → horizontal bars, top 10 + "overige".
- **Every chart is paired with a table** — the PO asked for "diagrammen **en** tabellen".
- Empty and loading states; readable in light **and** dark; responsive; wide tables scroll in their own container.

**K2.3 — `feat(cijfers): utilisation and top materials`**
- Person utilisation → grouped bars per month; top 10 materials → horizontal bars. Each with its table.

**K2.4 — `feat(cijfers): payback lists`**
- The two ranked lists with progress bars to 100% (K4). Not a chart, and deliberately not the full sortable table (declined by the PO). Keep it visually separate from the range-filtered charts so nobody reads payback as "this month".

---

## K3 — Dashboard tiles

**Branch:** `k3-dashboard-tiles` · **after K1**

**K3.1 — `feat(dashboard): add headline figures`**
- Two or three money figures beside the existing count cards (`src/app/(app)/page.tsx`, 124 lines — extract if needed), each linking into `/cijfers`. Cards are already `Link`-wrapped (`:65-68`), so follow that pattern.
- Hide the money tiles for roles without `Cijfers: lezen` (use `usePermissions()` from N4.2) — the server already refuses, this is the affordance.
- Remember M1.3: the "Materialen" count must exclude archived.

---

## I1 — Day / week / month switcher

**Branch:** `i1-planning-views` · **after phase 0's Y3.2 split**

`src/app/(app)/planning/page.tsx` was 173 lines and was split in Y3.2. It is a hard-coded week view: `useState(new Date())` cursor (`:42`), `eachDayOfInterval(startOfWeek…endOfWeek, weekStartsOn: 1)` (`:49-52`), fixed `grid grid-cols-7` (`:94`). No `nuqs`; the house URL-state pattern is `useSearchParams()` + `router.replace()` (`src/app/(app)/projects/[id]/page.tsx:34-41`).

**I1.1 — `feat(planning): move the view and date into the URL`**
- `?view=day|week|month&date=YYYY-MM-DD`, replacing the local `useState` cursor. Vorige/Volgende/Vandaag step by the active unit. Shareable and reload-safe.

**I1.2 — `feat(planning): month view`**
- `startOfMonth`/`endOfMonth` with leading/trailing week padding, `weekStartsOn: 1`, `locale: nl` (match `:49-52,110`). Cells show a count that expands on click when a day holds more than fits (Q20).

**I1.3 — `feat(planning): day view as an hour timeline`**
- 08:00–24:00 axis with blocks positioned and sized by actual times (Q20). **This is the payoff surface for H1's per-assignment hours**, which is why I comes after phase 2.
- Decide and handle bookings starting before 08:00 or running past midnight — clamp with an indicator, never silently hide.

---

## I2 — Bucket by period, and show times

**Branch:** `i2-period-bucketing` · **after I1**

The grid places whole **projects** by `project.startDate/endDate` (`planning/page.tsx:54-59`), so it paints days where nothing is booked. Times exist in the data but are never formatted (`:78,79,110`; `planning-calendar-item.tsx:66-67`).

**I2.1 — `feat(api): filter projects by date range`**
- `GET /api/projects` takes **no `NextRequest` at all** today (`src/app/api/projects/route.ts:13`) and returns every project with the full nested tree — a month view multiplies that. Add `?from=&to=` plus a lean `include` for planning, or a dedicated planning endpoint.
- ⚠️ **`from`/`to` must be OPTIONAL with an unfiltered fallback.** Do **not** copy `materials/available/route.ts:20-24` wholesale — that route *requires* the params and 400s without them (`:24`). Three existing callers fetch `/api/projects` with no query string: `src/app/(app)/page.tsx:23` (dashboard stats + upcoming), `src/app/(app)/projects/page.tsx:16` (the projects table), and `src/app/(app)/planning/page.tsx:26` (planning itself, until I2.2 passes a range). Requiring the params breaks all three the moment this commit lands.
- Add a regression test asserting the **no-parameter** response shape is unchanged.

**I2.2 — `feat(planning): place periods, not projects, and show times`**
- Bucket by `Period`; render `HH:mm`.
- **Verify:** a Mon 18:00–23:00 period appears only on Monday with its times; a Mon–Fri project no longer paints days with no period; a month of a year's data loads without fetching every booking line.

---

## I3 — Person view

**Branch:** `i3-person-view` · **after I2**

**I3.1 — `feat(planning): toggle between project and person rows`**
- `?mode=project|person` alongside `view`/`date`. One row per person, their bookings across the range, hours from H1.
- Respect N5 scoping: an own-scoped user sees only their own row.
- Reuse I2.1's range-filtered endpoint — do not fetch all projects.

**I3.2 — `feat(planning): flag forced double bookings`**
- Overlapping blocks on a person's row, badged, using `overlapAck` from H2. This is where a deliberate double booking becomes visible at a glance, which was the point of showing it here.

---

## J3 — One shared print stylesheet

**Branch:** `j3-print-css` · **after J2b.7**

Two hand-maintained, already-diverged `@media print` blocks exist — `src/components/print/print-layout.tsx:6-34` and `src/components/project-costs-tab.tsx:29-49` — plus a third on the labels page. `src/app/globals.css` has none. J2a and J2b add more documents on top.

**J3.1 — `refactor(print): consolidate print styles`**
- One stylesheet serving pakbon, callsheet, kosten (J2a), invoice (J2b) and labels. Pure refactor: **verify each of the five documents still prints correctly** — print preview each one and say so in the commit body.

---

## Phase 3 exit report

1. Branch + commit list per item.
2. **Invoice numbering evidence:** the concurrency test result showing no duplicates and no gaps.
3. **Freezing evidence:** a sent invoice's totals before and after editing the underlying project.
4. **Payback evidence:** the cocktailtafel case — a component rented only inside a set showing its pro-rata share rather than €0.
5. Confirmation that `/api/stats` and `/api/invoices/*` carry module guards and that N2.5's enumeration test passes.
6. The N5 scoping decision for `Cijfers`, as implemented.
7. Which five print documents were verified after J3.
8. For the PO to check: create an invoice from a project, send it, edit the project, confirm the invoice did not change; open `/cijfers` and confirm the payback lists look plausible against real purchase prices.
