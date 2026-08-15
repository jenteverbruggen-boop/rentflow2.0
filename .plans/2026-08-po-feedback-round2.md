# PO Feedback Roadmap — Round 2 (August 2026)

> Source: product-owner feedback (Dutch, 10 items), transformed into actionable work items for AI workers.
> Status: **v4 — READY TO EXECUTE.** One adversarial review round + a complete question round (2026-08-14) incorporated; all decisions recorded in the table below. No blocking questions remain (round-1 Q8 turned out to be moot — E5 shipped as A4 sheets). Four items need a design doc approved before code: J2b, N5, P3, O2. Commit-level task briefs live in `.plans/tasks-round2/`.
> Predecessor: `.plans/2026-07-po-feedback-roadmap.md` (round 1, largely shipped). Note its **E5 "⛔ blocked on Q8" line is stale** — E5 shipped as A4 label sheets in `bce0716`.
> All current-state facts were verified against the codebase on 2026-08-14 (8 parallel recon passes + manual verification of every load-bearing claim).
> **PO files received** (2026-08-14): `.plans/Export_Equipment_20260814.xlsx` ("normal") and `.plans/Export_Equipment_20260814 (1).xlsx` ("advanced") — analysed in workstream **M**. These answer Q34.

## PO feedback → workstream index

| # | PO quote (nl) | Workstream | Phase |
|---|---|---|---|
| 8 | "bij de instellingen de rollen kunnen aanpassen … freelancer niet alle toegang … module per module aan/uit" | **N** — Custom roles, module matrix, own-data scoping | **1 (PO: first)** |
| 1 | "dubbele boeking … op mezelf of de uren beter kunnen specifiëren … maandag dag-project, 's avonds nog iets anders" | **H** — Time-accurate people bookings | 0 (partial) + 2 |
| 3 | "facturen moeten nog iets properder" | **J** — Cost document → full invoicing | 2 (J2a) + 3 (J2b) |
| 5 | "de reiskosten komen er niet op de juiste manier door op de factuur … moet gewoon een lijn zijn en niet in het subtotaal bijgeteld" | **J1** — Travel line fix | 0 |
| 7 | "in de materialen zou een upload moeten kunnen gebeuren" | **M** — Material import (files received) | 2 |
| 6 | "per persoon meer opties om te kiezen welke functie … welke dag of uur prijs … misschien per klant koppelen … kies prg → enkel prg functies" | **L** — Functions, rates, client rate cards | 2 (L1/L2) + 3 (L3) |
| 4 | "diagrammen en tabellen voor de cijfers van de zaak" **+ new: material payback** | **K** — Business figures + payback | 3 |
| 2 | "in planning de keuze hebben tussen per dag per week of per maand" | **I** — Planning granularity + person view | 3 |
| 9 | "een integratie met google calendar" | **O** — ICS feeds | 4 |
| 10 | "een integratie met de server; bestanden automatische backup, …" | **P** — Data export/import + hardening *(backups out of scope)* | 0 (P1) + 4 (P2/P3) |
| — | (foundations required by the above) | **Y** — Foundations | 0 |

## Decisions from the question round (2026-08-14)

| # | Question | Decision |
|---|---|---|
| Q0 | Sequencing | **All of item 8 first** (not the phase-0 lockdown subset). Then items 1, 3 and 7 together. Consequence accepted: items 1/3/7 land roughly one phase later than in v2. |
| Q17 | Booking granularity | **Own hours per person per booking** — optional narrower start/end on the assignment. `@@unique([periodId, personId])` **stays**, so the risky constraint drop is off the table. |
| Q18 | Real overlaps | **Refuse by default, allow an explicit override**; forced overlaps are flagged everywhere that person appears. |
| Q19 | Part-day cost | **Bill per hour when an hourly rate exists**, else a full day → makes L1/L5 a hard dependency of item 1's pricing. |
| Q20 | Planning views | Month = expandable "3 projecten" cells; **Day = real hour timeline** (08:00–24:00) with blocks sized by actual hours. |
| Q21 | Person view | **Yes** — toggle between "per project" and "per persoon" rows. |
| Q22 | Travel costs | Subtotal = personeel + materiaal; **travel as itemised lines below it, still included in the total**, BTW over everything. *(PO to confirm with accountant.)* |
| Q23 | Invoice depth | **RentFlow becomes the invoicing system**: numbered invoices, invoice/due dates, status, frozen amounts, credit notes, overview page. |
| Q24 | Invoice lines | **Grouped per period** ("Opbouw", "Festivaldagen") with lines underneath each. |
| Q25a | BTW | **A configurable setting**, default 21%. Store the rate **per invoice line** (defaulted from the setting) so per-line VAT needs no migration later. |
| Q25b | New settings | **Payment terms, bank account holder name, invoice number format, standard invoice footer** — all four. |
| Q25c | Peppol | **Peppol is the future goal but out of scope now.** Therefore: design the invoice model **Peppol-shaped** (structured client VAT, per-line VAT rate, gapless sequential numbering, credit notes) so a later Peppol adapter is an export layer, not a rebuild. |
| Q26 | Figures location | **New "Cijfers" page** + 2–3 headline tiles on the dashboard linking to it. |
| Q27 | KPIs | Revenue per month · revenue per client · person utilisation · top 10 materials by revenue · **+ material payback (new, see K4)**. |
| Q29 | Revenue basis | **Booked and invoiced side by side**, so the gap between worked and billed is visible. |
| Q30 | Rate location | **Function default + person override** (+ existing project override). |
| Q31 | Billing unit | **Both day and hour rate, chosen per booking.** |
| Q32 | Per client | **Client rate card** (`clientId × functionId → dayRate/hourRate`) — it both filters the function list and applies the agreed price. |
| Q32b | Precedence | **Client rate card beats the person override.** Full order: project override → client rate card → person-function rate → function default → `Person.dayPrice` → 0. |
| Q33 | Legacy role | **Retire the free-text `Person.role`**; unmatched values reported during migration for manual mapping. |
| Q34b | "Advanced" file | **Import as archived and hidden** → needs a new `Material.archived` concept across list, tree and booking pickers. |
| Q34c | Material attachments | **Out of scope.** Item 7 is the import only; no photos or documents on materials. |
| Q36a | Import matching | **Match on `code`, update existing.** Re-importing a fresh export is the normal way to sync. |
| Q36b | Import flow | **Auto-create the 11 categories from `Folder`, and always show a preview** to confirm before writing. |
| Q36c | Extra columns | **Purchase price + list price only.** No dimensions, weight, power or critical-stock threshold. (Purchase price is also the input for K4 payback.) |
| Q37 | Role model | **Custom roles** ("Freelancer", "Boekhouder", …) created by an admin, each with its own module matrix. |
| Q38 | Granularity | **Four levels per module: geen / lezen / wijzigen / verwijderen.** |
| Q40 | Own-data scoping | **In scope now** — a freelancer sees only the projects/periods they are booked on. Every list query needs filtering; `User.personId` is the hook. |
| C1 | Rollout | **Seed the matrix fully open** — nobody's access changes on deployment; the PO tightens it themselves in the settings screen. |
| Q41 | Calendar depth | **ICS subscription feeds first.** No OAuth, no scheduler. Google's refresh lag (often hours) accepted. |
| Q42 | Which calendar | **Both**: a personal "my shifts" feed per user and a company-wide feed. |
| Q44a | Backups | **Out of scope** — a verified secondary backup flow already exists at infrastructure level. |
| Q44b | The "…" | **Data export — and import**, with an update mode *and* a truncate-and-replace mode. |
| Q45a | Hosting | **Own server / VPS.** |
| P-hardening | Container hardening | **Yes** — non-root user, healthchecks, health-gated `depends_on`. |
| Q48 | Bundle revenue for payback | **Split a bundle booking back to its components, pro-rata by each component's own day price.** Verified exact against live data: `Cocktailtafel` €5 + `cocktailtafelhoes` €3 = `cocktailtafel met hoes` €8, and the buffet set likewise — so the split reconstructs reality rather than approximating it. |
| Q49 | Truncate scope | **Per entity only.** Replacing materials wipes and reloads materials; projects, bookings, invoices and people are untouched. **No system-wide reset action.** |
| Q49b | Replace blast radius | **Refuse and list the blockers.** A replace that would remove records still referenced by bookings stops and reports exactly what blocks it. No cascade, no archiving fallback. |
| Q50 | Invoicing granularity | **Deposit + final invoice.** A project carries several invoices: a *voorschot* (fixed amount **or** percentage, chosen per invoice) and an *eindfactuur* billing the remainder minus what was already invoiced. |
| Q51 | Credit-note numbering | **Separate series** (`2026-0001` for invoices, `CN-2026-0001` for credit notes). Both gapless and sequential. |
| Q52 | Payments | **Mark-as-paid with partial payments** — an invoice can be partly paid and shows a remaining balance. No bank connection. |
| Q53 | Freelancer visibility | On their own periods they see **crew names + functions, crew phone/contact, the materials, and the client + location**. **No money at all.** |
| Q54 | Freelancer scope depth | **All periods of a project they are booked on**, not only their own periods. |
| Q55 | Freelancer write access | **Read-only.** `scope: own` denies writes regardless of the module matrix — including their own hours and travel costs. |
| Q56 | Import scope | **Everything RentFlow exports is importable in the same format** — materials, people, clients, locations. Export and import are one contract per entity, not two. |
| Q57 | Rentman format | The material adapter **also** accepts the 82-column Rentman export layout, alongside RentFlow's own. |
| Q58 | Duplicate code `9998-902` | **Lowest ID keeps the code; the other gets the next free code**, both listed in the import report. The import never fails on it. *(Verified: only this one code is a genuine collision — ID 707 "Vorken (vis)" vs ID 708 "Messen (Vis)". The other four apparent duplicates are the same item repeated across its serial-number rows.)* |
| Q59 | Freelancer catalogues | **Deny the standalone Materialen/Personen/Klanten/Locaties pages** for scoped roles — those models carry no project link, so they cannot be filtered. Crew and equipment remain visible embedded in their own periods. |
| Q60 | Freelancer privacy | Also hide colleagues' **home address and internal notes**; name, function and phone stay visible. |
| Q61 | Export format | **Real `.xlsx`**, via one small maintained library. CSV was rejected as a downgrade given the round-trip requirement. |
| Q8 | Label format | **Moot — E5 already shipped as A4 3×8 sticker sheets** (commit `bce0716`, `src/app/(app)/materials/labels/page.tsx:11,64,107-117`, `@page { size: A4 }`). The round-1 plan still lists E5 as blocked; that is stale. Q8 survives only as an optional "add a 62 mm roll variant", which the PO parked. |

### Accepted risks and consequences (PO informed, decisions reaffirmed)

1. **The permission holes stay open until the PO configures the matrix.** Item 8 goes first *for security reasons*, but C1 seeds every role at full access, and the phase-0 lockdown (N0 in v2) was declined. So on the day item 8 ships, a VIEWER still has full write access — the hole closes only when the PO tightens the matrix in the settings screen. **N3 must therefore ship with a visible "your matrix is wide open" warning banner and a one-click "apply recommended defaults" action**, or this item does not achieve its stated purpose.
2. **Item 8 grew to the largest workstream in the roadmap**: custom roles + a 4-level matrix + own-data scoping + a sweep of all 40 route files. Expect multiple worker sessions. Items 1, 3 and 7 all wait behind it.
3. **Item 1's pricing now depends on item 6.** Hourly billing (Q19 + Q31) means L1's function rates must land with H1's time windows — they share one migration.
4. **Existing cost figures will change** twice: once when the production Decimal bug is fixed (Y1) and once when travel leaves the subtotal (J1). Both are corrections of wrong numbers, not regressions.
5. **The truncate-and-replace import is destructive by design** — see P3 for the required guardrails and the open question Q49.

---

## Current-state facts (verified 2026-08-14)

### ⚠️ Money is silently wrong in production (not reproducible in dev)

The most important finding of this recon round. It undermines items 3, 4 and 5 before any of them is built.

- `prisma/schema.prisma` types money as `Decimal @db.Decimal(10,2)`; `prisma/schema.dev.prisma` types the same fields as `Float` (`schema.dev.prisma:97,108,137,152-155,193-196,221,232-234,246`).
- Generating the client from the **Postgres** schema types those fields `runtime.Decimal`; generating from the **dev** schema types them `number`. *(Verified by generating both: `PeriodStockItem.dayPriceSnapshot: runtime.Decimal | null` vs `: number`.)* The client under `src/generated/` is gitignored (`.gitignore:13`, 0 tracked files) and regenerated per environment — so **local development always runs the SQLite-flavoured client** (`internal/class.ts:22` → `"activeProvider": "sqlite"`) and can never reproduce the Postgres behaviour.
- `Prisma.Decimal.toJSON()` returns a **string**. *(Verified in node: `JSON.stringify({dayPrice: new Decimal("12.50")})` → `{"dayPrice":"12.5"}`.)*
- `GET /api/projects` and `GET /api/projects/[id]` return the entire `projectInclude` tree straight to `NextResponse.json()` with **zero numeric conversion** (`src/app/api/projects/route.ts:18-22`, `src/lib/project-include.ts:3-31`). No serializer helper exists in `src/lib/`.
- Client-side types declare these fields as `number` (`src/types/index.ts:180-183,192,201-203`), so TypeScript cannot catch the mismatch, and arithmetic runs on them directly.
- **Consequence — three confirmed string-concatenation sites**, all of the form `number + rawDecimalString`:
  1. `src/lib/pricing.ts:52-56` — `materialLineCost`: `rental + setup`.
  2. `src/components/cost-line-row.tsx:66-71` — `MaterialGroupCostRow`: `s + (a.setupCostSnapshot ?? 0)` then `perUnit * group.units + setup`.
  3. `src/components/period-bookings.tsx:99-103` — the same reduce, hand-duplicated rather than calling `materialLineCost`.
  Multiplication coerces, so `dayPriceSnapshot × days` survives; addition does not. With the default `setupCostSnapshot` of `0`, a €150 line becomes `150 + "0"` → `"1500"` → **€1500**. *(JS coercion illustration, not a code citation: `12.5 + "25"` → `"12.525"` → `12.53`.)*
- `lineCost` (`pricing.ts:37-50`) also does `gross - discount.discountAmount`; subtraction coerces, so that one is safe today — but it is one edit away from breaking.
- Dev cannot reproduce this (SQLite `Float`), and `npm test` runs against SQLite, so **every printed cost figure, every "Totaal" badge and the future invoice/report numbers are suspect in production only**. CI does catch *type* drift (it runs `prisma generate` against Postgres then `tsc --noEmit`), but not this: `NextResponse.json()` accepts anything, so a missing conversion is invisible to the compiler.
- Where conversion *is* done today it is ad hoc and partial: `src/lib/effective-price.ts:7,9,16,18`, `src/app/api/materials/route.ts:69,75`, `src/app/api/periods/[id]/materials/route.ts:32,35,52,58-59`.

**Verification recipe for the Y1 worker** (must run against real Postgres — SQLite proves nothing here):
```bash
docker compose up -d db
# point DATABASE_URL at the compose db, npx prisma migrate deploy, seed, start the app, then:
curl -s localhost:3000/api/projects -b "rentflow_token=<token>" | jq '.[0].periods[0].materials[0]'
# assert dayPriceSnapshot / setupCostSnapshot are JSON numbers, not quoted strings
```

### People bookings (item 1)

- Overlap detection is already **strict** (half-open intervals): `AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }]` (`src/lib/availability.ts:92`; same shape at `:28,65,125`). Back-to-back periods do not conflict — round-1 decision Q16, and it is tested (`src/lib/availability.test.ts:29-64`).
- **A same-day evening booking is therefore already legal at the model level.** What blocks the PO is coarse period spans, not the overlap operator:
  1. `POST /api/projects` auto-creates one period named `"Hoofdperiode"` spanning the **entire project** (`src/app/api/projects/route.ts:58-66`).
  2. `period-form.tsx:59-62` defaults a *new* period to the entire project range at `T08:00`–`T17:00`.
  3. A person is booked **per period** with no assignment-level window, so a Mon–Fri period books them solid Mon 08:00 → Fri 17:00, and a Tuesday-evening booking elsewhere genuinely overlaps → `conflict()` (`src/app/api/periods/[id]/people/route.ts:37-41`).
  4. `@@unique([periodId, personId])` (`prisma/schema.prisma:239`) prevents two windows for one person inside one period.
- **Availability picker bug:** `person-split-editor.tsx:28-29` truncates the period bounds with `.slice(0, 10)` (same at `material-split-editor.tsx:43-44`). Date-only strings parse as UTC midnight, so for a single-day period `from === to` → zero-width window → the overlap test matches nothing → **everyone reads "Beschikbaar"** (`:144`) with the add button enabled (`:150`), until the server returns 409. On a multi-day period it silently drops the last day's daytime instead. This is precisely the "it says free but won't let me book" experience.
- `POST /api/periods/[id]/people` does check-then-create with **no transaction and no `P2002` catch** (`:24-47`), unlike the material path which uses `$transaction` + pg advisory locks (`src/lib/booking.ts:34,61,120`). A lost race surfaces as a raw 500.
- Person cost is calendar-day only: `periodDays` = `differenceInCalendarDays + 1`, floor 1 (`pricing.ts:26-35`); `personLineCost` = `snapshot × days` (`:58-60`). A 3-hour evening job costs a full day. **No hourly-rate concept exists anywhere** (`hour|uur|hourly|uurprijs` → zero real hits; the only matches are "Huurprijs" = *rental* price, `prisma/seed.ts:124-126`).
- Times *are* already captured (`datetime-local` at `period-form.tsx:94,97`) and submitted as full ISO strings (`:73-78`); planning just never displays them.

### Planning (item 2)

- `src/app/(app)/planning/page.tsx` is **173 lines — already over the 150-line limit**. Hard-coded week view: `useState(new Date())` (`:42`), `eachDayOfInterval(startOfWeek…endOfWeek, weekStartsOn: 1)` (`:49-52`), fixed `grid grid-cols-7` (`:94`).
- It buckets **projects**, not periods (`projectsOnDay` compares `project.startDate/endDate`, `:54-59`), so the grid paints a project on days where nothing is booked.
- It fetches the entire unfiltered project tree (`GET /api/projects`, `:25-29`); that handler takes no `NextRequest` and supports **no** date filtering or pagination (`src/app/api/projects/route.ts:13`).
- One bespoke component only: `planning-calendar-item.tsx` (82 lines). Grid and week list are inline JSX. Date-only formatting throughout (`:78,79,110`, `planning-calendar-item.tsx:66-67`).
- No `calendar.tsx` in `src/components/ui/`; no `nuqs`. House URL-state pattern is `useSearchParams()` + `router.replace()` (`projects/[id]/page.tsx:34-41`).

### Invoices & travel costs (items 3, 5)

- **No invoice feature exists**: `factuur|invoice` → zero hits across `src/`, `prisma/`, `.plans/`. The nearest artifact is the internal **Kosten tab** (`project-costs-tab.tsx`, 183 lines — over the limit) plus `cost-summary.tsx` (105 lines), printed via `window.print()`.
- Travel is folded into every total: `periodTravelCost` (`pricing.ts:71-79`) is added inside `periodTotal` (`:130-131`) and `projectCostSummary().total` (`:113`). Deliberate (`.plans/setup-travel-costs-design.md:56-57`) and locked in by a test named *"periodTotal and projectCostSummary include travel as its own bucket"* (`pricing.test.ts:269-280`) — **that test must be rewritten, not patched**.
- Travel has **no line in the cost table** (no `TravelCostRow`); it appears only as a rolled-up `Reiskosten: €X` when `> 0` (`cost-summary.tsx:42-49,76-81`). Individual entries live only in `person-travel-editor.tsx` on the Personen tab. So the PO sees an unitemised lump that is also wrongly inside the subtotal.
- BTW is a hard-coded `BTW_RATE = 0.21` (`pricing.ts:140`) applied **once to the travel-inclusive grand total** (`cost-summary.tsx:59,91,99`). No per-line VAT, no setting.
- The Kosten tab's print view does **not** use `DocumentHeader` (`project-costs-tab.tsx:71-79`), so unlike pakbon/callsheet it prints with no company name, address, BTW number, IBAN or logo — it is not a document you could send a client. **This is the cheapest, most literal fix for "properder".**
- Two independent, already-diverged `@media print` blocks (`print-layout.tsx:6-34`, `project-costs-tab.tsx:29-49`); `globals.css` has none; the labels page has a third.
- Settings available for a header: `companyName, companyAddress, companyPostalCode, companyCity, companyPhone, companyVat, companyIban` (`src/lib/settings.ts:3-11`) + `logo` blob (`:40-62`). No invoice numbering, no payment terms, no bank-holder name.

### Business figures (item 4)

- Dashboard (`src/app/(app)/page.tsx`, 124 lines): three counts computed client-side as `array.length` (`:41,47,53`) + next five upcoming projects. Cards already link out (`:65-68`). No money figure anywhere. **No dashboard components exist** — all inline.
- **No aggregation endpoint** among the **40** route files; no `.aggregate(`/`.groupBy(` anywhere. Every number is derived client-side from full list payloads.
- **No chart library installed** (`recharts`/`chart.js`/`d3`/`visx` absent from `package.json`; `chart.js` present only transitively). No `src/components/ui/chart.tsx`.
- Seed data is too thin to judge a chart: 4 projects, 6 periods (2026-04-01 → 2026-11-30), 6 people, ~103 materials; **zero `PeriodBundleBooking` and zero `PersonTravelCost` rows**.

### Functions & person pricing (item 6)

- `Function` is name-only (`schema.prisma:46-50`); `PersonFunction` is a bare junction (`:52-59`). **Neither carries a price field.**
- These tables are never read by the booking flow, by `effective-price.ts`, by availability, or by the callsheet. Consumers: the functions CRUD routes, the people routes, `person-form.tsx`, and a badge list (`people/page.tsx:79-91`).
- The role string exists in **three unsynchronised copies**: `Person.role` (`schema.prisma:130`), `PeriodPerson.role` (`:231`), and `Function.name`. At booking time the UI silently copies `p.person.role` into the assignment (`person-split-editor.tsx:151`) — **there is no function picker at booking time at all**. The callsheet column headed "Functie" renders the legacy free-text field (`callsheet/page.tsx:109`).
- Price resolution is project-override → `Person.dayPrice` → 0 (`effective-price.ts:12-19`), duplicated inline at `people/available/route.ts:34-37` and client-side at `line-price-popover.tsx:42`. Changing a project override re-stamps all existing snapshots (`prices/person/[personId]/route.ts:22-31`).
- `Client` links to `Project` only (`schema.prisma:32`). **No client→function or client→rate relation exists**, so "pick prg → only prg functions" has no foundation.
- `src/app/api/people/route.ts` and `[id]/route.ts` have **no zod schema** (the only routes of their kind without one); `PUT` replaces the whole function set with `deleteMany: {} + create` (`[id]/route.ts:12-62`) — which would destroy per-person rate rows if they hung off that join.
- Seed: 6 functions, each person mapped 1:1, `Person.role` set redundantly alongside (`seed.ts:299-325`). **No person has multiple functions**, so multi-function UI is untested against realistic data.

### Uploads (item 7)

- `src/lib/documents.ts` (47 lines) is **not** the abstraction round 1 intended: every function calls `prisma.personDocument.*` directly (`:14,22,33,46`) and `StoreArgs` hard-codes `personId` (`:4-11`).
- Upload route accepts **PDF only** (`people/[id]/documents/route.ts:32`), cap 10 MB (`:7,33`). Logo route accepts PNG/JPEG at 1 MB (`settings/logo/route.ts:10,33`). List queries correctly `select` metadata without bytes (`documents.ts:33-37`).
- `next.config.ts` (14 lines) has no `images` config and no body-size override; both `<Image>` uses pass `unoptimized`. No `<img>`, no thumbnailing.
- `material-detail-pane.tsx` is **131/150 lines**; its pattern is one child component per section.
- The `app` service in `docker-compose.yml` has **no volume** — bytes-in-Postgres remains the only durable option (and is covered by the PO's existing infrastructure-level backup, which is out of scope per Q44a).
- The existing seed already parses `prisma/seed-data/materials.csv` with header detection and `code::name` dedup (`seed.ts:98-104,140-259`) — reusable groundwork for an importer.

### Roles & permissions (item 8)

- `requireRole(...roles)` (`api-auth.ts:13-25`) is the only RBAC primitive: a variadic string allow-list with a DB fallback when the JWT lacks a role. `role` **is** in the JWT (`auth.ts:9`, set at `login/route.ts:27-32`), 7-day TTL.
- **Only 5 of ~76 handlers enforce anything beyond "authenticated"**: `POST /api/projects` (ADMIN/PLANNER), `PUT /api/settings`, `POST /api/users`, `PATCH /api/users/[id]`, `DELETE /api/users/[id]` (ADMIN). Everything else — clients, locations, functions, categories, materials, stock items, people, person documents, periods, all bookings, travel costs, price overrides, **`PUT`/`DELETE /api/projects/[id]`**, `GET /api/settings` (IBAN + VAT), and all verbs of `/api/settings/logo` — is `requireAuth()` only. **A VIEWER, and therefore any freelancer account created today, has full write access to almost the entire system.**
- `src/proxy.ts` (33 lines) verifies the JWT signature and nothing else — **no role-based routing**. `/users` and `/settings` are `"use client"` with no server guard, so a non-admin navigating directly sees the page shell, the full user list (`GET /api/users` allows all three roles) and all company settings.
- UI gating is one inline JWT decode in a server component: `getRole()` (`sidebar.tsx:10-20`) → `isAdmin = role === "ADMIN"` (`:39`) → hides two nav links (`:51-54`). No `useCurrentUser` hook, no `/api/auth/me`.
- `export type Role = "ADMIN" | "PLANNER" | "VIEWER"` (`types/index.ts:8`) is declared and **never imported**. No zod validation of role exists; `POST /api/users` / `PATCH /api/users/[id]` persist whatever string arrives. Cosmetic bug: `users/page.tsx:65` compares `u.role === "admin"` lowercase, so that badge variant never applies.
- **No module, feature-flag, permission or ability concept exists** — greenfield. Reusable scaffolding: the role string and the `Setting` key-value table (`setSettings` filters to a 7-key allowlist, `settings.ts:29`).
- Public registration is correctly disabled (`auth/register/route.ts` returns `notFound()`).

### Integration surface (items 9, 10)

- **Zero outbound HTTP calls exist**: `fetch(` in `src/app/api/` and `src/lib/` → no matches; all 75 client-side `fetch(` calls target the app's own routes. No `axios`, no `googleapis`. **Google Calendar would be this app's first external integration.**
- **No scheduling infrastructure**: no `cron`, `setInterval`, `node-cron`, `after(`, `waitUntil`, no `src/app/api/cron/`, no queue dependency.
- **No encryption helper**: `crypto|encrypt|cipher` → zero hits in `src/` (only `bcryptjs`). Following convention, OAuth tokens would land in `Setting.value` **in plaintext**.
- No `externalId|googleEventId|syncedAt|icalUid` on any model. `Period` carries `name`, `startDate`, `endDate`; location lives on the parent `Project`.
- A webhook/callback route needs adding to `PUBLIC_API_PREFIX` (`proxy.ts:7`) or the matcher (`:31`); the current failure mode is an HTML redirect to `/login`, unsuitable for an API caller.
- Ops: one volume (`pgdata` on `db`), **no healthchecks**, plain `depends_on`, and **no `USER` directive in the Dockerfile → the app runs as root**. `pg_dump` is **not** in the app image (`node:22-alpine`, zero `apk add`); it exists only in the `postgres:15` container. **No backup service of any kind.**
- Env handling has no validation: `process.env.JWT_SECRET!` (`auth.ts:3`), `TextEncoder().encode(process.env.JWT_SECRET)` (`proxy.ts:4`, `sidebar.tsx:8` — silently encodes an empty key if unset), `process.env.DATABASE_URL ?? ""` (`prisma.ts:8`). Failures are deferred to first use.
- **Docs are wrong about deployment.** `README.md:31,142-163` says "Docker Hub"; the real `docker-compose.yml:10` and `release.yml` use `ghcr.io/jenteverbruggen-boop/rentflow2.0`. Worse, `docs/docker-compose.md` (254 lines) documents a **3-service backend/frontend/nginx architecture that does not exist**, built by a `builds.yml` workflow that does not exist; `.github/prompts/docker.prompt.md` prescribes the same phantom split and `node:20-alpine` (actual: 22). **Nothing in the repo states where production runs** — see Q45a.
- CI: `ci.yml` (45 lines) on every branch: `tsc --noEmit` → `npm test` (SQLite) → `npm run build`. `release.yml` (58 lines): semantic-release then build/push to GHCR on successful `main` CI.

---

## Conventions for all work items

Everything in `.plans/tasks/00-README.md` still applies **except its Execution-order and Brief-files tables, which describe round 1 only** — use the Execution order table in this document instead. Plus:

- **150-line file limit.** Four files are already over or at it and must be split by whoever touches them first: `planning/page.tsx` (173), `project-costs-tab.tsx` (183), `projects/[id]/page.tsx` (168), `material-detail-pane.tsx` (131/150). `person-split-editor.tsx` (230) is also over.
- Every schema change lands in **both** `prisma/schema.prisma` (Decimal for money) **and** `prisma/schema.dev.prisma` (Float for money), plus `prisma/seed.ts`.
- **No Prisma enums** — `String` column + TS union + zod.
- Postgres migrations via `prisma migrate diff` per `CLAUDE.md`; dev uses `prisma db push`.
- **Money rule (new, from Y1):** no API route may return a raw Prisma `Decimal` — convert at the route boundary. Never write `a + b` on a value that came off the wire unconverted. Never reimplement a `pricing.ts` helper inline in a component (that is how two of the three bugs happened).
- **Time rule (new):** any new datetime column or datetime API field must be verified against **Postgres**, not just SQLite, and must round-trip a Brussels wall-clock time on a UTC server. Never send bare `yyyy-MM-ddTHH:mm`; never truncate with `.slice(0, 10)`.
- Anything touching `src/lib/availability.ts`, `src/lib/booking.ts` or `src/lib/pricing.ts` is **critical**: vitest coverage mandatory, one owner per file per phase.
- UI copy Dutch (nl-BE); code/identifiers English.
- Skills: `code` always, `design` for UI, `cicd` for Docker/workflows, `docs` after schema/API changes, `dataviz` before writing any chart code.

---

## Workstream Y — Foundations

### Y1. Decimal → number at the API boundary `M` `phase 0` `blocks J, K; fixes a live production bug`

- Add `src/lib/serialize.ts` with `toNumber(v: unknown): number` and per-shape mappers (prefer explicit mappers over a blind deep-walk — the project tree is a hot path).
- Money key inventory: `dayPrice`, `setupCost`, `bundlePriceOverride`, `dayPriceSnapshot`, `setupCostSnapshot`, `discountPct`, `discountAmount`, `unitCost`.
- Apply at every route returning a model with those fields: `projects` (both), `people`, `materials`, `materials/available`, `people/available`, `stock-items`, all `periods/*`, `projects/[id]/prices/*`. Fold the ad-hoc `Number()` calls in `effective-price.ts`, `materials/route.ts`, `periods/[id]/materials/route.ts` onto the new helper.
- Make `pricing.ts` defensive anyway: coerce at each entry point (`lineCost`, `materialLineCost`, `personLineCost`, `periodTravelCost`).
- **Fix the two duplicated bug sites, do not just patch pricing.ts:** `cost-line-row.tsx:66-71` and `period-bookings.tsx:99-103` reimplement material line cost by hand. Make them call `materialLineCost` instead. If a component genuinely needs its own arithmetic, it must coerce first.
- **Regression guard (the important part):** a vitest suite that feeds `pricing.ts` **string** inputs (`"150"`, `"0"`, `"12.50"`) and asserts results identical to numeric inputs. This is the only test shape that catches the prod/dev divergence, because CI runs on SQLite.
- **Recurrence prevention — pick at least one and state it in the brief:** (a) a branded `Money = number & {__money}` type that only `toNumber` can mint, so a raw wire value cannot flow into arithmetic; (b) an eslint rule banning `+` on `*Snapshot`/`*Price`/`unitCost` identifiers outside `serialize.ts`; (c) a test that asserts every route module's response passes a "no strings in money keys" check. Without one of these, the next new route (J2, K1, L1, M) reintroduces the bug — `NextResponse.json()` accepts anything and TypeScript will not object.
- **Accept:** with Postgres behind the app, `GET /api/projects` returns JSON numbers for every money field; a material line with `setupCostSnapshot = 0` costs `dayPrice × days` (not 10×); all three known bug sites produce identical figures; the string-input suite is green; the chosen recurrence guard is in place; `npm test` + `npx tsc --noEmit` clean.

### Y2. Generalise document storage `S` `phase 4` `no consumer this round — deferred (Q34c dropped material attachments)`

- Refactor `documents.ts` to `storeDocument({ owner: { kind, id }, filename, label, mimeType, sizeBytes, expiresAt }, bytes)` + `getDocument`, `listDocuments(owner)`, `deleteDocument(id)`. Bytes stay in Postgres (round-1 Q5; also why the PO's existing infrastructure backup already covers uploads — Q44a).
- Prefer a second table (`MaterialDocument`) behind one façade over a polymorphic table — FK cascade integrity is worth more than the DRY.
- Centralise the MIME whitelist + size cap per owner kind instead of inlining them per route.
- **Accept:** person documents behave exactly as before; routes contain no `prisma.personDocument.*` calls; adding an owner kind needs no change to callers.

### Y3. Split the over-limit files `S` `phase 0` `one batch, before any feature work`

`planning/page.tsx` (173 → I1 grows it), `project-costs-tab.tsx` (183 → J grows it), `person-split-editor.tsx` (230 → H1/H2/H3/L2 all touch it), `projects/[id]/page.tsx` (168), `material-detail-pane.tsx` (131 → M grows it). Split all five in **one phase-0 batch**, before any feature work touches them — not lazily per phase. Extract per the existing one-component-per-section pattern, as **pure refactor commits** so later feature diffs stay reviewable.
- **Accept:** every touched file ≤150 lines; `tsc` + lint clean; no functional diff.

### Y4. Make the docs match reality `S` `phase 0` `skills: cicd, docs`

Rewrite or delete `docs/docker-compose.md` (documents a 3-service stack and a `builds.yml` workflow that do not exist); correct the README's Docker Hub → GHCR references; align `.github/prompts/docker.prompt.md` with the real single-container `node:22-alpine` GHCR setup. Fold in the Q45a answer.
- **Accept:** no doc describes a service, image name, workflow file or base image that does not exist.

### Y5. Startup env validation `S` `phase 0`

`src/lib/env.ts` (zod) validating `DATABASE_URL` and `JWT_SECRET`, imported from `prisma.ts` and `auth.ts`, so a missing secret fails loudly at boot instead of encoding an empty key (`proxy.ts:4`, `sidebar.tsx:8`). Must stay Edge-safe for `proxy.ts`.
- **Accept:** booting without either var fails with one clear error; both runtimes still build.

---

## Workstream H — Time-accurate people bookings *(PO item 1)*

**Sequence matters: H3 and H4 are cheap fixes that may resolve most of the PO's pain on their own.** Ship them in phase 0, let the PO retest, then decide how far H1/H2 need to go.

### H3. Fix the availability picker window `S` `phase 0` `no deps` `ship first`

`person-split-editor.tsx:28-29` truncates period bounds to `YYYY-MM-DD`, collapsing single-day periods to a zero-width UTC window so everyone reads "Beschikbaar" until the server 409s. Same truncation at `material-split-editor.tsx:43-44`.
- Send full ISO strings with offset for `from`/`to` in both editors.
- Validate `from`/`to` server-side in `people/available/route.ts:29-30` and `materials/available/route.ts:20-24` (raw `new Date()` on unvalidated params today); `badRequest` on unparseable or inverted ranges.
- Show the conflicting **window**, not just the project name, in the "Bezet" label (`:144`).
- **Accept:** a person booked 08:00–17:00 shows as available for an 18:00–23:00 period and busy for a 14:00–20:00 one; picker and server agree in every case; vitest covers the same-day non-overlap case `availability.test.ts` currently lacks.

### H4. Stop defaulting periods to the whole project `S` `phase 0` `no deps` `decided — no PO input needed`

Two places create project-spanning periods: `projects/route.ts:58-66` (`"Hoofdperiode"` over the full range) and `period-form.tsx:59-62` (new-period default).
- **Decided default (independent of Q17, so this can ship immediately):** a new period defaults to a **single day** — the project start date, 08:00–17:00. The auto-created first period keeps the name `"Hoofdperiode"` and the same single-day shape. Users extend it if they want more. If Q17 later changes the booking model, this default stays valid.
- Enforce server-side what is only a client-side `.refine` today (`period-form.tsx:20-23`): `endDate > startDate`, with zod on `POST /api/projects/[id]/periods` and `PATCH /api/periods/[id]` (raw `new Date(body.x)`, no validation, `periods/[id]/route.ts:13-19`).
- Decide whether the out-of-range warning becomes blocking; it is cosmetic today and does not disable submit (`period-form.tsx:68-71,100-106`).
- **Accept:** creating a project no longer books its people for the whole span; an inverted or invalid range is rejected with 400 by the API, not only by the form; existing periods are untouched.

### H1. Assignment-level time windows `L` `phase 2` `deps: H3, H4; owns availability.ts this phase` `✓ decided (Q17 = own hours per booking)`

- **Schema (both files + seed):** `PeriodPerson.startAt DateTime?`, `endAt DateTime?` — null means "inherit the period window".
- **`@@unique([periodId, personId])` stays** (Q17 chose one window per person per period, not the shift model). That deliberately avoids two rewrites the constraint drop would have forced: the compound-key `findUnique` at `periods/[id]/people/route.ts:24-26` keeps compiling, and `assignedIds` at `person-split-editor.tsx:36-39,44` stays valid. **If the PO later wants several shifts per period, reopen Q17 — it is not a small follow-up.**
- Validate the window against its period: `startAt`/`endAt` must fall inside the period's own span, and `endAt > startAt`, enforced server-side (not only in the form).
- **Availability:** add `effectiveWindow(assignment)` and make `checkPersonAvailability` compare against it rather than the parent period (`availability.ts:85-96`). Keep the strict `lt`/`gt` boundary (round-1 Q16) — already correct and tested.
- **Race fix (required):** wrap check-then-create in an interactive `$transaction` with the availability re-check inside, mirroring `booking.ts:61,120`, and catch `P2002` → `conflict()` as the material route does (`periods/[id]/materials/route.ts:46,65`).
- **Timezone rigor (apply the Time rule):** these are the first datetime columns written from a per-assignment form. Verify against Postgres, not SQLite: a Brussels 18:00–23:00 window must round-trip identically on a UTC server, and must not shift when read back into a `datetime-local` input. Round-1 already recorded inconsistent date parsing as a known hazard (`.plans/2026-07-po-feedback-roadmap.md:36,121`).
- **UI:** optional "eigen uren" on the assignment row (`person-split-editor.tsx` — split it in Y3 first), window shown in `period-bookings.tsx:52` and on the callsheet.
- **Tests (mandatory):** same-day non-overlapping windows allowed; 1-minute overlap blocked; touching boundaries allowed; window narrower than the period frees the rest of the day; null window behaves exactly as today (regression).
- **Accept:** the PO can book themselves 08:00–17:00 on project A and 18:00–23:00 on project B on the same Monday from the UI, with picker and server agreeing; all existing bookings (null windows) unchanged; Postgres round-trip verified.

### H2. Explicit double-booking override `M` `phase 2` `deps: H1` `✓ decided (Q18 = refuse + override)`

The PO asked to be *able* to double-book ("ik zou een dubbele boeking moeten kunnen doen op mezelf"), which a conflict fix alone does not grant.
- Refuse by default; a confirm dialog sends `allowOverlap: true` and the assignment stores `overlapAck Boolean @default(false)` so the UI can badge it. The API must still refuse without the flag — never make the client the only gate.
- Forced overlaps stay visible afterwards: a badge on the assignment, in `period-bookings.tsx`, in planning (I3's person view is where this pays off) and on the callsheet.
- **Accept:** an overlapping booking is refused by default, accepted after explicit confirmation, and visibly flagged everywhere that person appears; the API rejects an overlap when the flag is absent.

### H5. Bill by the hour / part-day `M` `phase 2` `deps: H1, L1, L5` `✓ decided (Q19 = hourly when a rate exists, Q31 = both units)`

Any window currently bills a full day (`pricing.ts:26-35,58-60`). Once windows exist the money must follow.
- Per-line billing unit (`dag` | `uur`) chosen at booking time (Q31); hours derived from the effective window; rate resolved per L1/Q32b. When the resolved function has no hour rate, fall back to a full day (Q19) — and say so in the UI rather than silently charging a day for 3 hours.
- Snapshot the chosen unit and rate on the assignment, consistent with the existing `dayPriceSnapshot` convention.
- `pricing.ts` is shared with J and K — one owner, tests first.
- **Accept:** a 4-hour evening assignment at an hourly rate bills 4 × hour rate; a function without an hour rate still bills a full day with a visible hint; day-billed lines produce byte-identical figures to today (regression tests).

---

## Workstream I — Planning granularity *(PO item 2)*

### I1. Day / week / month switcher `M` `phase 3` `deps: Y3` `✓ decided (Q20 = hour timeline for the day view)`

- Extract the inline week grid from the 173-line page first (Y3): `planning-view-switcher.tsx`, `planning-week-grid.tsx`, `planning-day-view.tsx`, `planning-month-grid.tsx`, plus `use-planning-range.ts` returning `{ from, to, days }` per view.
- View + cursor in the URL via the house pattern (`projects/[id]/page.tsx:34-41`): `?view=day|week|month&date=YYYY-MM-DD`.
- Month = `startOfMonth`/`endOfMonth` with leading/trailing week padding, `weekStartsOn: 1`, `locale: nl` (matching `:49-52,110`); cells show a count that expands on click when a day has more than fits.
- **Day = a real hour timeline (Q20):** 08:00–24:00 axis with blocks positioned and sized by actual start/end times. This is the payoff surface for H1's per-person hours, so **schedule I1 after H1** or the timeline has nothing but period spans to draw. Decide the axis behaviour for bookings that start before 08:00 or run past midnight (clamp with an indicator, do not silently hide).
- **Accept:** switching views keeps the focal date; `?view=month&date=2026-06-15` deep-links; Vorige/Volgende/Vandaag step by the active unit; the day timeline places an 18:00–23:00 booking in the evening portion at the correct height; week view does not regress.

### I2. Bucket by period, and show times `M` `phase 3` `deps: I1, H1`

The grid places whole **projects** by `project.startDate/endDate` (`planning/page.tsx:54-59`), painting days where nothing is booked. Bucket by `Period` (and per Q21 by person window) and render `HH:mm` — the data is there, just never formatted.
- Fetch cost: planning pulls every project with the full nested tree and no filtering (`projects/route.ts:13`); a month view multiplies that. Add `?from=&to=` plus a lean `include` to the projects route, or a dedicated planning endpoint — the pattern exists at `materials/available/route.ts:20-24`.
- **Accept:** a Mon 18:00–23:00 period appears only on Monday with its times; a Mon–Fri project no longer paints empty days; a month view of a year's data loads without fetching every booking line.

### I3. Person view — "wie werkt wanneer" `M` `phase 3` `deps: I1, I2, H1, H2` `✓ decided in scope (Q21)`

A toggle between "per project" and "per persoon": one row per person, their bookings laid out across the active day/week/month range, with hours from H1.
- This is where **forced double bookings (H2) must be visibly flagged** — overlapping blocks on one person's row, badged.
- Add the view to the URL state (`?mode=project|person`) alongside `view` and `date`.
- Respect N5 scoping: an own-scoped user sees only their own row.
- Watch the payload — a month of every person's bookings is a lot; reuse whatever range-filtered endpoint I2 introduces rather than fetching all projects.
- **Accept:** the person view shows each person's booked blocks for the selected range with times; a forced overlap is unmistakable; an own-scoped freelancer sees only themselves.

---

## Workstream J — Cost document / invoice *(PO items 3 + 5)*

> **The PO opted into the larger commitment (Q23): RentFlow becomes the invoicing system.** J1 still ships in phase 0, J2a in phase 2 as the quick presentable document, J2b in phase 3 as the real invoice entity. Peppol is a stated future goal but explicitly **out of scope now** (Q25c) — so J2b's model must be Peppol-shaped from day one.

### J1. Travel costs out of the subtotal `S` `phase 0` `deps: Y1` `✓ decided (Q22 = line below subtotal, still in total)`

The most concrete complaint. Travel is added into `periodTotal` (`pricing.ts:130-131`) and `projectCostSummary().total` (`:113`), and shown only as an unitemised rollup (`cost-summary.tsx:42-49,76-81`).
- Restructure `projectCostSummary` to `{ people, materials, subtotal, travel, total }` where `subtotal = people + materials` and `total = subtotal + travel` (Q22: travel sits outside the subtotal but inside the total, with BTW over everything).
- Render travel as **real lines** (label · qty × unit price) below the subtotal in the Kosten tab and its print view — a `TravelCostRow` beside `PersonCostRow`/`MaterialGroupCostRow` in `cost-line-row.tsx`.
- **Rewrite** `pricing.test.ts:269-280`, which asserts exactly the behaviour being removed, and update `.plans/setup-travel-costs-design.md:56-57` so the design doc stops contradicting the code.
- Audit all four grand-total display sites: `projects/[id]/page.tsx:59,115`, `project-overview-tab.tsx:54`, `cost-summary.tsx:59,91,99`, `project-costs-tab.tsx:84`.
- **Accept:** subtotal = people + materials exactly; travel prints as itemised lines outside it; total matches Q22; every total in the app is consistent; verified against Postgres (needs Y1).

### J2a. Make the cost print look like a document `S` `phase 2` `deps: J1, Y3` `the literal answer to "properder"`

The Kosten print view carries no company identity because it skips `DocumentHeader` (`project-costs-tab.tsx:71-79`), while pakbon and callsheet both use it.
- Reuse `PrintLayout` + `DocumentHeader` (company block + logo already wired) on a printable `/projects/[id]/kosten` route; add the client billing block (`Client` already has `address`, `postalCode`, `city`, `vatNumber` — only the name is passed into `meta` today), the project number (= id, round-1 Z3), the date, and clean line/subtotal/BTW/total typography per the `design` skill.
- No schema change, no numbering, no status. This is the cheap fix; ship it before deciding on J2b.
- **Accept:** the cost print is a presentable A4 document with company + client details, correct figures, and no interactive controls bleeding into print.

### J2b. Real invoices `XL` `phase 3` `deps: J2a, Y1, pricing settled (H5/L5), N2 (guards)` `✓ decided in scope (Q23)` `design doc first`

RentFlow becomes the invoicing system. **Write `.plans/invoice-design.md` for approval before implementing** — this is the second-largest item in the roadmap and it carries legal constraints.

- **Schema (both files + seed):**
  - `Invoice { id, number String @unique, clientId, projectId?, invoiceDate, dueDate, status, currency, vatRate, subtotalExcl, travelExcl, vatAmount, totalIncl, notes?, footer?, creditNoteOfId?, createdAt }`
  - `InvoiceLine { id, invoiceId, section String?, description, quantity, unit String, unitPrice, vatRate, lineTotalExcl, sortOrder, kind }` — `section` carries the period grouping (Q24), `unit` is `dag|uur|stuk`, and **`vatRate` lives on the line** even though Q25a chose a single global setting, so per-line VAT needs no migration later.
  - `status ∈ concept|verzonden|betaald|vervallen|creditnota` (TS union + zod, no Prisma enum).
- **Numbering (legal):** gapless and sequential per the format setting (Q25b). Generate inside the transaction that finalises the invoice, never at draft time, and never reuse a number — a deleted draft must not leave a hole. Corrections are **credit notes** (`creditNoteOfId`), never edits to a sent invoice.
- **Frozen amounts:** once status leaves `concept`, all figures and lines are immutable — the invoice must not change when someone later edits a booking, a rate or a project override. This is the whole point of the entity and must be enforced at the API, not by convention.
- **Peppol-shaped now, Peppol-connected later (Q25c):** store what a UBL document requires — client VAT number and full billing address on the invoice itself (snapshotted, not joined live), per-line unit codes, per-line VAT rate, a payment reference, and the invoice/due dates. Keep document generation behind a small interface so an XML/Peppol emitter can be added beside the PDF one. **Do not** build a Peppol connection, access-point integration or delivery tracking.
- **Lines grouped per period (Q24):** sections named after the period ("Opbouw", "Festivaldagen"), lines underneath, travel lines outside the subtotal per Q22.
- **UI:** invoice overview page (list, filter by status/client), create-from-project flow that pre-fills lines from the cost breakdown, printable document reusing J2a's layout, status transitions, credit-note action.
- **Settings needed (Q25b):** payment terms, bank account holder name, invoice number format, standard footer, plus the BTW rate (Q25a).
- **Accept:** an invoice generated from a project has sequential numbering, correct grouped lines, travel outside the subtotal, BTW from the setting, and does not change when the underlying project is edited afterwards; a credit note references its original; the design doc was approved first.

### J3. One shared print stylesheet `S` `phase 3` `deps: J2a`

`print-layout.tsx:6-34` and `project-costs-tab.tsx:29-49` are two hand-maintained, already-diverged `@media print` blocks; the labels page has a third. Consolidate before a fourth appears.
- **Accept:** one print stylesheet; pakbon, callsheet, kosten and labels all print correctly from it.

---

## Workstream K — Business figures *(PO item 4)*

### K1. Aggregation endpoint `M` `phase 3` `deps: Y1, J2b (invoiced figures), M1 (cost prices)` `✓ decided (Q27, Q29)`

No stats endpoint and no `groupBy`/`aggregate` exists; the dashboard counts client-side over full payloads.
- `GET /api/stats?from=&to=&groupBy=month|client|project` returning pre-aggregated, **already-numeric** figures. Y1 is a hard dependency — aggregating Decimals-as-strings produces silent nonsense.
- Aggregate server-side; do not ship every booking to the browser. If raw SQL is used, note the SQLite/Postgres divergence in date-truncation functions — prefer Prisma `groupBy` or bucket months in JS from a lean projection.
- **Response contract must be written into the brief before coding.** Decided shape (Q27 + Q29 — every revenue figure carries both a booked and an invoiced value):
  ```ts
  { range: { from: string; to: string },
    revenueByMonth: { month: "2026-06"; bookedPeople: number; bookedMaterials: number;
                      bookedTravel: number; booked: number; invoiced: number }[],
    revenueByClient: { clientId: number; name: string; booked: number; invoiced: number }[],
    personUtilisation: { personId: number; name: string; bookedDays: number; bookedHours: number }[],
    topMaterials: { materialId: number; name: string; code: string | null; revenue: number }[] }
  ```
- **Booked vs invoiced (Q29):** booked comes from booking snapshots, invoiced from `Invoice` totals (J2b). Until invoices exist the invoiced series is legitimately zero — label it, do not hide it. Note the two are attributed differently: booked revenue falls in the period's month, invoiced revenue in the invoice's month, so they will not line up and the page must not imply they should.
- **Accept:** one request returns everything the charts need; every money value is a JSON number; verified against Postgres; unit tests on the aggregation helpers.

### K4. Material payback — "heeft het zichzelf terugbetaald?" `L` `phase 3` `deps: K1, M1 (purchase prices)` `✓ decided (new PO ask + Q48)`

New in this round, from the PO: *"a fridge costs us 300, I rent it out at 10, it's rented 30 times — did I pay off the fridge, and what percentage?"* A top-10 of best and worst paid off.

- **Schema (both files + seed):**
  - `Material.costPrice Decimal?` (what it cost you) and `Material.listPrice Decimal?` — both come straight from the import's purchase/list price columns (Q36c).
  - `StockItem.costPrice Decimal?` — optional per-unit override for when a specific unit's real price is known. The PO chose "per material, with an optional per-unit override", so the material-level price is the default and the unit-level one is the exception.
  - `Material.revenueBefore Decimal?` — "already earned before RentFlow", optional, entered by hand. **Without it every existing item reads 0% paid off and the whole page misleads** (PO chose this explicitly).
- **Computation (`src/lib/payback.ts`, unit-tested):**
  - Earned = `revenueBefore` + flat-booking revenue + **bundle-booking share** (see below). Flat revenue comes from `PeriodStockItem` snapshots grouped via `stockItem.materialId` (the grouping helper at `src/lib/grouping.ts:13-22` already does this join). **Gross rental income only — no overhead percentage** (PO dropped the "magic number").
  - Cost basis = sum of per-unit `costPrice` where set, falling back to `Material.costPrice` × units owned.
  - `paybackPct = earned / costBasis`, undefined when no cost price is known — such materials are **excluded, not shown as 0%**.
- **Bundle attribution (Q48) — do not skip this, or 52 units read €0 forever:**
  - Component lines inside a set are snapshotted at **€0** (round-1 Q15 decision), so the payback calculation **must not** read component revenue off `PeriodStockItem.dayPriceSnapshot` for bundled lines — it has to reconstruct it from the bundle booking.
  - For each `PeriodBundleBooking`: take `dayPriceSnapshot × quantity × days` and split it across the recipe's components **pro-rata by weight**, where a component's weight = `MaterialComponent.quantity × child.dayPrice`.
  - Verified exact against the PO's live data: `Cocktailtafel` €5 + `cocktailtafelhoes` €3 = the €8 set, so the split returns precisely €5 and €3. Same for the buffet set. A component priced €0 (e.g. "aciet" in `Tap + aciet` €75, where the tap alone is €75) correctly receives nothing.
  - **Edge case to handle explicitly:** if every component weight is 0 but the bundle has a price, fall back to an equal split — never divide by zero, and never silently drop the revenue.
  - The affected population is small but high-volume: 4 sets in the live export covering ~52 physical units (15 cocktailtafels + 15 hoezen, 11 buffettafels + 11 hoezen), which are exactly the items whose payback the PO wants to see.
- **Ignore the date range:** payback is lifetime-to-date by definition. Keep it visually separate from the range-filtered charts so nobody reads it as "this month".
- **UI (per PO):** two side-by-side top-10 lists — best paid off and worst paid off — each row showing the percentage, earned amount and cost price. Not the full sortable table, not profit-after-payback, not a dead-stock list (all explicitly declined).
- **Accept:** a material with `costPrice` 300 and €330 of historical bookings reads 110%; a material with no cost price is absent rather than 0%; `revenueBefore` is included; **a cocktailtafel rented only ever inside the €8 set accrues €5 per rental day, not €0**; figures verified against Postgres; unit tests cover per-unit overrides, the no-cost-price case, the pro-rata split and the all-weights-zero fallback.

### K2. Figures page with charts `M` `phase 3` `deps: K1, K4` `✓ decided (Q26, Q27, Q29)` `skills: dataviz, design`

- **Read the `dataviz` skill before writing any chart code** (project rule); `design` for tokens/contrast in both themes.
- **Charting decided (engineering call, not a PO question):** add `recharts` + a shadcn-style `src/components/ui/chart.tsx` wrapper — it matches this stack and the `dataviz` skill's guidance, and hand-rolling five chart types is not a good use of the budget.
- **Decided KPI set (Q27):** revenue per month · revenue per client · person utilisation · top 10 materials by revenue · material payback (K4). Cost split was not selected — the stacked revenue-per-month bar already carries it.
- **Default chart-type mapping** (deviate only with a reason): revenue per month → stacked bars (personeel/materiaal/reis) with the invoiced series as a line over them; revenue per client → horizontal bars, top 10 + "overige"; person utilisation → grouped bars per month; top materials → horizontal bars; payback → two ranked lists with progress bars (K4), not a chart. **Every chart is paired with a table** — the PO asked for "diagrammen **en** tabellen".
- **Page location (Q26):** a new `/cijfers` page plus 2–3 headline tiles on the dashboard that link into it.
- Date-range control, empty state, loading state, responsive, readable in light and dark.
- **Seed data:** current volumes are too thin to judge (4 projects, 6 periods, no travel or bundle bookings). Extend `prisma/seed.ts` to roughly **20 projects across 12 months, 40+ periods, travel costs on ~30% of person bookings, and at least 2 booked bundles**, with day rates in the existing €200–€450 range, so trends and stacked series are actually visible.
- **Accept:** the Q27 KPIs render as charts + tables, readable in both themes, responsive, with sane empty/loading states, against the extended seed.

### K3. Dashboard tiles `S` `phase 3` `deps: K1`

Add two or three headline figures to the existing (count-only) dashboard cards and link through to K2.

---

## Workstream L — Functions, rates & client scoping *(PO item 6)*

### L1. Rates on functions `L` `phase 2` `deps: Y1; DDL first` `✓ decided (Q30, Q31, Q32b)`

- **Schema (both files + seed):** `Function.dayRate/hourRate` (the company default, Q30) **and** `PersonFunction.dayRate/hourRate` (the per-person override, both nullable). Money = `Decimal` (PG) / `Float` (dev). Both units exist because Q31 chose "both, per booking".
- **Because rates now hang off `PersonFunction`, fix the destructive write first:** `people/[id]/route.ts:12-62` replaces the whole set with `deleteMany: {} + create`, which would **silently wipe every per-person rate on any person save**. Convert to a diff (add/remove only what changed) before adding the columns, not after.
- **Decided resolution order (Q32b — client rate card beats the person override):**
  `ProjectPersonPrice` override → `ClientFunctionRate` (L3) → `PersonFunction` rate → `Function` default → `Person.dayPrice` → 0.
  Implement it in exactly one place (`effective-price.ts`), returning both the resolved amount **and which level it came from**, so the booking UI and the price popover can show *why* a price is what it is — with five levels, an unexplained number is a support call. Delete the duplicates at `people/available/route.ts:34-37` and `line-price-popover.tsx:42`.
- Give `people/route.ts` and `[id]/route.ts` the zod schemas they lack.
- Add a **functions management page** (functions can only be created inline from the person form today; no page exists).
- **Historical-data protection (required):** existing `dayPriceSnapshot` values were frozen under the old resolution order. Changing resolution must not retroactively alter the displayed cost of completed ("afgerond") projects. State explicitly in the brief that snapshots are never recomputed by this item, and add a regression test asserting a seeded historical booking's cost is byte-identical before and after.
- **Accept:** a function carries rates; a person can hold several functions at different rates; resolution is implemented once and unit-tested; historical project totals unchanged.

### L2. Pick the function at booking time `L` `phase 2` `deps: L1, H1`

Booking silently copies `p.person.role` (`person-split-editor.tsx:151`); there is no picker, and the callsheet's "Functie" column prints that legacy field (`callsheet/page.tsx:109`).
- Add `PeriodPerson.functionId Int?`, keep `role` as a display fallback during migration, backfill by exact name match against `Function.name` (clean in seed data, which is 1:1; real data may not be — log unmatched rows rather than guessing).
- Booking UI: choose one of the person's functions (default to their only one), showing the resolved rate before confirming. Snapshot behaviour must match the existing convention (`periods/[id]/people/route.ts:52`) and the re-stamp behaviour of project overrides (`prices/person/[personId]/route.ts:22-31`).
- Same historical-data protection as L1.
- **Accept:** booking asks which function when a person has more than one, snapshots the right rate, and the callsheet prints the chosen function from the relation.

### L3. Client rate cards `M` `phase 2` `deps: L1, L2` `✓ decided (Q32 = rate card, Q32b = it wins)`

"kies prg → enkel prg functies" and "handig dat we dit per klant koppelen". `Client` links to `Project` only today; nothing client→function exists.
- **Schema:** `ClientFunctionRate { id, clientId, functionId, dayRate?, hourRate? } @@unique([clientId, functionId])`. Its presence does double duty: it **scopes** the function picker (a project for that client offers only that client's functions) **and** it **prices** them, one level above the person override (Q32b).
- Fallback rule to decide in the brief and state in the UI: a client with **no** rate card rows must show **all** functions (not none), or creating a new client breaks booking entirely.
- UI: a rate-card section on the client detail page — add function, set day/hour rate, remove. Show the effective rate source on the booking screen (see L1).
- **Accept:** picking a "prg" client narrows the function list to prg's functions and applies prg's agreed rates automatically; a client without a rate card behaves exactly as before; the resolution order is unit-tested at all five levels.

### L4. Retire the legacy role string `S` `phase 4` `deps: L2` `✓ decided (Q33 = retire it)`

`Person.role`, `PeriodPerson.role` and `Function.name` are three unsynchronised copies, read at seven sites (`person-split-editor.tsx:48,56,78,151`, `period-bookings.tsx:52`, `cost-line-row.tsx:34`, `callsheet/page.tsx:109` — note `cost-line-row.tsx` lacks the `person.role` fallback the others have, so it already renders inconsistently).
- After L2's backfill, drop `Person.role` and `PeriodPerson.role` entirely (Q33 chose full retirement, no free-text override); remove the type fields (`types/index.ts:63,200`). Report unmatched legacy values during the migration so the PO can map them by hand rather than losing them silently.
- **Accept:** function comes from the relation everywhere; grouping/search/callsheet read one source; no free-text role remains except a deliberate override.

### L5. Hourly billing unit `M` `phase 2` `deps: L1, H1` `pairs with H5` `✓ decided (Q31 = both units, chosen per booking)`

Billing unit per line (`dag`/`uur`), quantity from the effective window. `pricing.ts` is shared with J and K — one owner, tests first, regression tests proving day-billed lines are unchanged.

---

## Workstream M — Material import *(PO item 7)*

> **Q34 is answered by the received files: this is a bulk import, not an attachment feature.** Neither file contains image bytes (`Number of images` = 0 on all but one row; only 5 filename references across both files), so "upload" here means "upload my equipment list", not "attach photos".

### Analysis of the two received files (verified 2026-08-14)

Both share an identical **82-column** layout — that is why they "look similar" — but the populated content is entirely different. Rows are a **flattened equipment × serial-number join**, so equipment repeats when it has multiple serials.

| | `Export_Equipment_20260814.xlsx` ("normal") | `Export_Equipment_20260814 (1).xlsx` ("advanced") |
|---|---|---|
| Rows / unique equipment IDs / unique codes | 113 / 104 / 103 | 287 / 287 / 287 |
| `Type of equipment` | 109 Physical item, 1 Physical combination, 3 Virtual combination | **287 Physical combination** |
| `Archived` | 0 for all | **1 for all** |
| `Display in planner` | 1 for all | **0 for all** |
| `Rental-/Sales price` | 4 zero, max €15 000 | **0 for all** |
| `Stock calculation method` | 16 Serialized, 97 Bulk | 287 Bulk |
| `Code` shape | 111 × `NNNN-NNN`, 2 plain digits; **5 duplicate codes** incl. `9998-902` | 287 plain 3-digit numbers, no duplicates |
| `Folder (Folder)` | 11 values, e.g. `0501-Tenten`, `0201-Catering` | empty for all |
| `Current quantity` | 0 → 350 | 1 for all |
| Names | real equipment (Tent 5x10, Cava glazen, …) | flightcases (`19" 8U Topdesk Flightcase 001`, …) |

**Decisive fact:** the "normal" file's 103 codes are a **100% match** with the 103 codes already in `prisma/seed-data/materials.csv` — it is the same equipment master, re-exported in English with 82 columns instead of 31 Dutch ones. The "advanced" file is a different, disjoint population: archived flightcase/combination records with no price, no folder and no planner visibility. **Whether those 287 rows should be imported at all is Q34b** — importing 287 archived, €0 items would badly pollute the materials list.

**Proposed column mapping** (worker must confirm against the CSVs; a conversion script is at `.plans/` — regenerate with the stdlib xlsx→csv converter, no new dependency needed):

| Source column | Target | Notes |
|---|---|---|
| `Code` | `Material.code` (`@unique`) | 5 duplicates in the normal file → must dedupe deterministically **before** insert, as round 1 did for `9998-902`. Never let one bad row abort the file |
| `Name (in database)` | `Material.name` | |
| `Folder (Folder)` = `0501-Tenten` | `Category.prefix` = `0501` (**full four digits**), `Category.name` = `Tenten` | 11 categories, auto-created per Q36b. ⚠️ **`nextCode()` must be fixed first**: `src/lib/material-code.ts:2` matches `^{prefix}01-(\d{3})$`, i.e. a 2-digit prefix plus a hard-coded `"01"` subgroup. Real folders use the full four digits as the prefix (`9997`, `9998`, `9999` all truncate to `"99"` and collide). Change the pattern to `^{prefix}-(\d{3})$` and store four digits — that reproduces every existing code (`0501-003`, `9998-902`) exactly |
| `Rental-/Sales price` | `Material.dayPrice` | 4 zero-priced rows in the normal file |
| `Type of equipment` | `Material.isBundle` | **Only `Virtual combination` → true** (3 rows: `Tap + aciet`, `cocktailtafel met hoes`, `Buffettafel met hoes`). `Physical combination` is an ordinary physical asset that can hold content (`Schepijs vriezer`, qty 1, €55; and **all 287 rows of the advanced file**) — mapping those to bundles would create 288 empty, unbookable recipes. **The export contains no component rows** (`Combination structure` empty in both files), so the 3 real sets import as empty shells whose contents must be entered by hand |
| `Stock calculation method` + `Current quantity` | `StockItem` rows | Serialized → one `StockItem` per serial row, `identifier` from `Manufacturer serial number (Serial number)` / `Display name (Serial number)`; Bulk → generate `Current quantity` units |
| `Internal remark` | `Material.notes` | populated on 2 rows |
| `Archived` | **no target column exists** | Needs `Material.archived Boolean @default(false)`, or skip archived rows on import. Blocks the "advanced" file entirely — see Q34b |
| `ID` | import bookkeeping | the stable external key; use it to dedupe the serial-join rows (104 unique IDs across 113 rows) |
| `VAT rate` / `VAT class` | — | uniformly 0.21 / "Hoog tarief"; relevant only to Q25a |
| purchase price, `List price` | `Material.costPrice`, `Material.listPrice` | **decided in scope (Q36c)** — purchase price is also the input for K4 payback |
| dimensions, weight, volume, power, current, `Margin price`, `Critical stock`, ledger accounts, factor/discount groups, webshop fields, `Default equipment group`, purchase date, book value | **not imported** | declined by the PO (Q36c). Do not add columns for these |

### M1. Import materials from an equipment export `L` `phase 2` `deps: Y1, N2 (route guard)` `✓ decided (Q34b, Q36a-c)`

**Decided:** match on `code` and **update** existing materials (Q36a); **auto-create** the 11 categories from `Folder` and **always show a preview** before writing (Q36b); import the "advanced" file's 287 rows **as archived and hidden** (Q34b); store **purchase price + list price** and nothing else from the unmapped columns (Q36c).

- **Schema additions (both files + seed):** `Material.archived Boolean @default(false)`, `Material.costPrice Decimal?`, `Material.listPrice Decimal?`, `StockItem.costPrice Decimal?`, `Material.revenueBefore Decimal?` (the last three feed K4 payback).
- **`archived` is not just a column — it is a new concept across the UI** (RentFlow has no notion of it today). Every one of these must exclude archived materials by default, with an explicit "toon gearchiveerd" toggle where it makes sense: the materials tree/list (`materials-tree-pane.tsx`, `materials-filter-bar.tsx`), the booking picker (`material-split-editor.tsx`), `/api/materials`, `/api/materials/available`, the labels page, and K4's payback lists. Missing one means 287 flightcases reappear in a booking dropdown.

- Flow: upload `.xlsx`/`.csv` → parse → **dry-run preview with a per-row diff** (new / updated / unchanged / skipped / error, with reasons) → confirm → apply in a transaction. Never write on upload.
- Parse `.xlsx` without a heavy dependency if practical (the format is a zip of XML; a ~40-line reader handled both files during this recon) or add one small maintained library — decide in the brief. Reuse the existing header-detection and dedup logic in `seed.ts:98-259`.
- Must handle: the serial-join row grain, duplicate codes, `Material.code @unique`, existing materials (match key per Q36a), auto-created categories (Q36b), archived rows (Q34b), and combinations-without-contents.
- Never let one bad row abort the import; report every skipped row with its line number.
- Guard the route with the module permission from N (imports are destructive) and cap the upload size.
- **Accept:** importing the "normal" file into a seeded database yields 103 materials in 11 categories with correct prices and stock counts, reports the 5 duplicate codes without failing, creates no duplicate categories on a second run, and leaves existing bookings' snapshots untouched.

### M2 / M3. Material attachments and photos — ❌ **out of scope (Q34c)**

The PO chose "just the import for now". Neither export file carries image data, so there is nothing to migrate and no attachment feature to build. `Y2` (generalising the document storage façade) therefore has **no consumer this round** — keep it only if a worker is already touching `documents.ts`, otherwise defer it.

---

## Workstream N — Module permissions *(PO item 8)*

> **This is now phase 1 and the PO's first priority.** It is also the largest workstream in the roadmap: custom roles + a four-level matrix + own-data scoping + a sweep of all 40 route files. N2 touches every route file, so no other route-adding work may run beside it. The phase-0 lockdown from v2 (N0) was **declined** — see accepted risk 1.

### N1. Custom roles, module registry, permission model `L` `phase 1` `DDL first` `✓ decided (Q37, Q38, C1)`

- `src/lib/modules.ts`: a `MODULES` const — code is the source of truth for *which modules exist*; the DB stores only *who may do what*.
- **Schema (both files + seed):**
  - `Role { id, key, label, isSystem Boolean }` — ADMIN/PLANNER/VIEWER seeded as `isSystem: true` (undeletable, renameable); admins create their own ("Freelancer", "Boekhouder", …).
  - `RolePermission { roleId, module, access }` with `access ∈ none|read|write|delete` (TS union + zod, **no Prisma enum**). Four levels per Q38: `delete` implies `write` implies `read`.
  - `User.role String` becomes `User.roleId Int` → migrate the three existing string values; keep a compatibility read path for tokens minted before the migration.
- **Seed the matrix fully open (C1):** every existing role gets `delete` on every module, so nobody's access changes on deployment. This is the PO's explicit choice; see accepted risk 1 for what N3 must therefore do.
- `requireModule(module, "read"|"write"|"delete")` in `api-auth.ts` beside `requireRole`. **Resolve permissions from the DB (cached per request), not from the JWT** — tokens live 7 days and a matrix change must apply on the next request, not after re-login. The JWT keeps carrying `roleId` for cheap nav rendering only.
- Retire the unused `Role` string union (`types/index.ts:8`, imported nowhere) in favour of the real entity, and add the zod validation `POST /api/users` / `PATCH /api/users/[id]` currently lack (any string is persisted today). Fix the dead lowercase comparison at `users/page.tsx:65`.
- **Rule for later phases:** every route added after this phase (invoices, stats, import, export, ICS) must ship with its own `requireModule` guard and an entry in the module map. The N2 enumeration test enforces it.
- **Proposed route → module map (this is the analytical work; confirm, don't re-derive):**

| Module | Routes |
|---|---|
| Projecten | `/api/projects`, `/api/projects/[id]`, `/api/projects/[id]/periods`, `/api/periods/[id]` |
| Planning | `/api/periods/[id]/people`(+`[assignmentId]`), `/api/periods/[id]/materials`(+`[assignmentId]`), `/api/periods/[id]/bundles/[bundleId]`, `/api/people/available`, `/api/materials/available` |
| Personen | `/api/people`, `/api/people/[id]`, `/api/functions`(+`[id]`), `/api/people/[id]/documents`, `/api/documents/[id]` |
| Materialen | `/api/materials`(+`[id]`, `stock-items`, `components`), `/api/stock-items/[id]`, `/api/categories`(+`[id]`), material import (M1) |
| Klanten | `/api/clients`(+`[id]`) |
| Locaties | `/api/locations`(+`[id]`) |
| Kosten/Facturen | `/api/projects/[id]/prices/*`, `/api/periods/[id]/people/[assignmentId]/travel`(+`[travelId]`), invoice routes (J2b), and the discount/price fields on booking PATCHes |
| Cijfers | `/api/stats` (K1) |
| Gebruikers | `/api/users`(+`[id]`) |
| Instellingen | `/api/settings`, `/api/settings/logo` |
| **Exempt (no module check, by design)** | `/api/auth/login`, `/api/auth/logout`, `/api/auth/register` (404s anyway), `/api/auth/me` (N4 — it is how a client *discovers* its permissions, so it cannot be gated behind one), and the ICS feed (O1, token-authenticated) |

  Note the deliberate split (PO-confirmed): **prices, discounts and travel costs are "Kosten/Facturen", not "Projecten"** — a freelancer gets project access without seeing commercial rates. Booking PATCH routes therefore need field-level care: the same endpoint edits both a booking and its discount, so the discount fields must be rejected without `Kosten/Facturen` write access.
- **Accept:** roles are creatable/renameable, the matrix is queryable at four levels, it is seeded fully open per C1, and a matrix change applies on the next request without re-login.

### N2. Enforcement sweep `L` `phase 1` `deps: N1` `security-critical; sole owner of route files this phase`

Convert all 40 route files to `requireModule(...)` per the N1 map. Because the matrix is seeded open (C1), this changes nobody's effective access on day one — it installs the mechanism.
- Map the four levels onto verbs: `GET` → read, `POST`/`PUT`/`PATCH` → write, `DELETE` → delete.
- Add a test that enumerates route files and asserts each has a module guard **or appears on the N1 exemption list** (auth routes, `/api/auth/me`, the ICS feed). Without that list the criterion is unsatisfiable — login cannot require a permission.
- **Accept:** every route resolves a module + level; a role with `lezen` on a module gets 403 on its writes and 200 on its reads; the enumeration test fails loudly when a new unguarded route is added.

### N3. Role & matrix UI `M` `phase 1` `deps: N1` `skill: design`

The settings page (14 lines today) gains role management + a permissions matrix: modules as rows, roles as columns, four-level access per cell.
- **Required by accepted risk 1:** because the matrix ships wide open, this screen must show a clear warning that every role currently has full access, plus a one-click **"pas aanbevolen standaarden toe"** action (e.g. VIEWER = lezen everywhere, PLANNER = wijzigen except Kosten/Gebruikers/Instellingen, ADMIN = everything) that the PO can review before applying. Without it, item 8 ships without closing the hole it exists to close.
- Guard against self-lockout: warn before removing the current admin's own `Instellingen` access, and never let the last ADMIN-equivalent role lose it.
- **Accept:** an admin creates a "Freelancer" role, sets Kosten/Facturen to *geen* and Projecten to *lezen*, and that account immediately loses those abilities in both UI and API.

### N4. Server-side page guards + client permission hook `M` `phase 1` `deps: N1, N2`

*(Ordered after N2 so it does not add a route while N2 is sweeping them.)*
- Add `GET /api/auth/me` (user + resolved permissions; exempt per N1), a `usePermissions()` hook, and per-route server guards for every page.
- Replace the one-off JWT decode in `sidebar.tsx:10-20` and drive nav from the module registry.
- Server stays authoritative; the hook is for affordances only.
- **Accept:** navigating directly to a forbidden page shows a proper 403 page; the sidebar shows exactly the permitted modules; no client-side check is the only thing protecting data.

### N5. Own-data-only scoping `L` `phase 1` `deps: N1, N4` `✓ decided in scope (Q40)` `design doc first`

A freelancer sees only the projects and periods they are booked on. This is **data scoping, not module toggling** — a different mechanism that touches every list query, which is why it needs a short design doc before implementation.
- `User.personId` (`schema.prisma:16`) is the existing hook. Add a per-role flag (e.g. `Role.scope ∈ all|own`) so scoping is configured alongside the matrix rather than hard-coded to one role.
- Enumerate the surfaces that must filter: `/api/projects` (list + detail), `/api/periods/*`, planning, the dashboard counts, `/api/stats` (K1), the ICS company feed (O1), and every export (P2). A single missed query leaks the whole company's planning.
- Decide and document the edge cases in the design doc: does an own-scoped user see the *other* people booked on their period (probably yes — they need the callsheet) but not their rates (no)? Can they see the project's client and location (yes)? Materials on their period (yes)?
- **Accept:** a freelancer account sees exactly the projects it is booked on in every list, detail view, planning view and export; an `all`-scoped role sees everything; a test asserts each scoped endpoint filters.

---

## Workstream O — Google Calendar *(PO item 9)*

> This would be the app's **first outbound HTTP call** and needs three things that do not exist: scheduling, secret encryption, and a known public URL. O1 needs none of them.

### O1. ICS feed export `M` `phase 4` `deps: H1 (times), N1/N5 (scoping)` `✓ decided (Q41 = ICS first, Q42 = both feeds)`

- **Two feed kinds (Q42):** a **personal** feed ("my shifts" — only the periods this user's linked person is booked on, with their H1 hours) and a **company-wide** feed (all projects/periods). The company feed is a broad disclosure, so gate it on a module permission and never hand it to an own-scoped role (N5).
- `GET /api/calendar/[token].ics` emitting valid iCalendar: title, `DTSTART`/`DTEND` in UTC with `VTIMEZONE`, location from the parent project, description, stable `UID` per period, `SEQUENCE` incremented on change.
- Google cannot send cookies, so this needs a per-user unguessable feed token (a random column on `User`, one per feed kind, revocable from settings), exempt in `proxy.ts` (`:7` or `:31`). **Do not put the JWT in a URL.** Note the current failure mode is an HTML redirect to `/login`, wrong for a feed client.
- The personal feed depends on `User.personId` being set — surface a clear message when an account has no linked person rather than serving an empty calendar.
- **Apply the Time rule:** verify the emitted times against Postgres and a UTC server — legacy periods store midnight timestamps and date parsing is already known-inconsistent (round-1 notes, `.plans/2026-07-po-feedback-roadmap.md:36,121`). An off-by-one-timezone calendar feed is worse than none.
- Honest limitation for the PO: **Google refreshes external ICS feeds on its own schedule — often only every few hours, sometimes up to 24.** Apple/Outlook poll more often.
- **Accept:** a feed URL added to Google Calendar shows that person's periods at correct local times; revoking the token kills the feed; no data outside that user's scope leaks.

### O2. OAuth two-way sync `XL` `phase 4` `deps: O1, O3, N1` `not chosen this round (Q41 = ICS first)` `design doc first`

Parked. Revisit only if the ICS feed's refresh lag proves unacceptable in practice. Real cost then: a Google Cloud project the PO owns, OAuth consent, token refresh, `googleEventId`/`syncedAt` columns (none exist), a sync loop (**no cron infrastructure exists**), conflict resolution, idempotent retries, and a deletion/echo strategy. Reopening it also reopens the prerequisite questions that were skipped because ICS was chosen: who owns the Google Cloud project, whether there is a Google Workspace domain, and what fixed public HTTPS address serves the OAuth callback (production is the PO's own VPS per Q45a).

### O3. Secret encryption helper `M` `phase 4` `blocks O2`

No `crypto`/`encrypt`/`cipher` code exists. Following current convention, OAuth refresh tokens would sit in `Setting.value` in plaintext. Add envelope encryption (`node:crypto` AES-GCM, key from env) before any third-party token is stored.
- **Accept:** tokens are unreadable in a DB dump; key rotation is documented.

---

## Workstream P — Data export/import & hardening *(PO item 10)*

> **Backups are out of scope (Q44a):** a verified secondary backup flow already exists at infrastructure level, and the PO confirmed it captures the database consistently. Since all uploads live in Postgres `Bytes` columns, that flow covers everything. **Re-open this only if uploads ever move to disk.** What the PO's "…" actually meant was data export — and, on follow-up, **import with a truncate-and-replace mode** (Q44b). Production runs on the PO's **own server/VPS** (Q45a).

### P1. Container hardening `S` `phase 0` `skill: cicd` `✓ decided in scope (PO said yes)`

Verified gaps: no `USER` directive → **the app container runs as root**; no healthchecks in `docker-compose.yml`; `depends_on: db` is not health-gated, so the app can start before Postgres is ready and the entrypoint's `migrate deploy` fails.
- Add a non-root `USER`, healthchecks for both services, `depends_on: condition: service_healthy`.
- **Accept:** the app runs as non-root, `docker compose ps` shows healthy services, and a cold start no longer races Postgres.

### P2. Per-entity data export `M` `phase 4` `deps: N2 (route guards), Y1` `✓ decided (Q44b)`

A download button per overview screen exporting the **currently filtered** list to Excel: projects, materials, people, clients, locations, invoices (J2b), and bookings.
- One export helper (`src/lib/export.ts`) producing `.xlsx`; reuse the column semantics of the PO's own equipment export where they overlap, so an export can be re-imported without translation.
- Money columns must be real numbers, not strings — Y1's serializer applies here too.
- Respect permissions **and** scoping: an own-scoped freelancer (N5) exports only their own rows; an export must never become a way around the module matrix. Gate each export on `read` for its module.
- **Accept:** each overview exports what is on screen, opens cleanly in Excel with correct number and date formatting, and an own-scoped user's export contains only their own data.

### P3. Data import with update / replace modes `L` `phase 4` `deps: P2, M1` `✓ decided (Q44b, Q49, Q49b)` `destructive — design doc first`

The PO asked for the round trip: *"ensure an import function, with a clear/update function so I can if needed upload and fully truncate all current data."* Build M1 (materials) first as the concrete case, then generalise its parse → preview → apply pipeline.

- **Two modes, always scoped to a single entity (Q49):** `update` (match on the entity's key and upsert — never delete) and `replace` (truncate that entity, then load the file). **There is no system-wide reset action** — replacing materials never touches projects, bookings, invoices or people.
- **Guardrails on `replace` — all of them, non-negotiable for a destructive feature:**
  - ADMIN-only via the module matrix, plus a **typed confirmation** (the user types the entity name), not just an OK button.
  - A preview first, always, showing exactly what will be deleted and created — same pipeline as M1's preview.
  - **Referential integrity (Q49b, decided):** truncating materials or people that existing bookings or invoices reference is **refused, with a list of exactly what blocks it and where**. No cascade — not even behind a second confirmation — and no archive-instead-of-delete fallback. Booking history is the basis of the cost figures, the invoices and the K4 payback numbers, so it is never collateral damage of an import.
  - Everything inside one transaction, so a mid-file failure leaves the database untouched.
  - Log who replaced what and when.
- **Never allow `replace` on invoices** — numbering must stay gapless and sent invoices are immutable (J2b).
- **Accept:** a per-entity update import upserts correctly and touches nothing else; a replace import refuses while references exist, and when permitted leaves exactly the file's contents; both always preview first; a mid-file error rolls back completely.

---

## Execution order

**Reordered per Q0: all of item 8 goes first.** Items 1, 3 and 7 (the PO's next three) follow in phase 2. This is roughly one phase later than v2 had them — an accepted consequence.

| Phase | Serial first (one worker) | Then in parallel | Notes |
|---|---|---|---|
| **0 — unblock & quick wins** | **Y1** (Decimal boundary) | **H3** picker · **H4** period defaults · **J1** travel line *(after Y1)* · Y3 splits · Y4 docs · Y5 env · **P1** hardening | Y1 first: J and K are meaningless on wrong numbers. H3/H4/J1 may already satisfy much of items 1 and 5 — **get a PO retest before phase 2 starts**. No N0: the PO chose the full item 8 instead |
| **1 — item 8 in full** *(PO priority)* | **N1** roles + registry + matrix model → then **N2** sweep of all 40 routes | N3 role & matrix UI *(after N1)* · N4 guards + `/api/auth/me` *(after N2)* · **N5** own-data scoping *(after N4, design doc first)* | **Own phase — N2 owns every route file, so nothing else may add routes.** Largest workstream in the roadmap; expect multiple sessions. N3 must ship the "matrix is wide open" warning + recommended-defaults action (accepted risk 1), or the item misses its purpose |
| **2 — items 1, 3, 7** | **DDL-2**: H1 windows + L1 function rates + L2 `PeriodPerson.functionId` + M1 columns (`archived`, `costPrice`, `listPrice`, `revenueBefore`) — one worker, one migration | H1 · H2 · H5/L5 pricing (single `pricing.ts` owner) · L1 · L2 · L3 rate cards · **M1 import** · **J2a** cost document | `availability.ts` and `pricing.ts` get exactly one owner each — critical booking logic, tests mandatory. Item 1's hourly billing depends on L1, hence the shared migration. **DDL rollback protocol:** if the shared migration must change after feature workers branch, the DDL worker issues a *new forward* migration and announces it — nobody edits an applied migration, and no feature worker starts before it merges |
| **3 — invoices & figures** | **DDL-3**: `Invoice` + `InvoiceLine` models | **J2b** invoices *(design doc approved first)* · K1 stats · **K4 payback** · K2 figures page · K3 dashboard tiles · I1 view switcher · I2 period bucketing · I3 person view · J3 print CSS | K1's invoiced series needs J2b; K4 needs M1's cost prices. I1's day timeline needs H1's hours, so planning lands here rather than earlier |
| **4 — later** | — | O1 ICS feeds · **P2** exports · **P3** import/replace *(design doc first)* · L4 retire legacy role · O2/O3 OAuth sync · optional 62 mm label-roll variant | J2b, N5, P3 and O2 each need a design doc before code. M2/M3 dropped (Q34c). Y2 has no consumer this round |

Rules: within a phase, **exactly one worker touches `prisma/schema*.prisma` + migrations + `seed.ts`**, and that commit lands first. `availability.ts`, `booking.ts` and `pricing.ts` get one owner per phase each.

Known file-conflict map (phase numbers per the reordered table above):
- `src/lib/pricing.ts`: **Y1** (0) → J1 (0) → H5/L5 (2) → K1/K4 consumers (3). Never concurrent.
- `src/lib/availability.ts`: H3 (0, callers only) → H1/H2 (2).
- `src/components/person-split-editor.tsx` (230 lines): H3, H1, H2, L2 all touch it → split it during H3/Y3 in phase 0.
- `src/app/(app)/planning/page.tsx`: Y3 (0) → I1 → I2 → I3 (all 3).
- `src/components/project-costs-tab.tsx` (183 lines): Y3 (0) → J1 (0) → J2a (2) → J2b reuse (3).
- `src/components/cost-line-row.tsx` + `period-bookings.tsx`: Y1 money fix (0) → J1 travel row (0).
- `src/lib/api-auth.ts`: N1 only (phase 1).
- `src/lib/effective-price.ts`: Y1 (0) → L1 resolution order (2) → L3 rate cards (2, same owner as L1).
- **Every API route file: N2 owns all of them in phase 1.** No other phase-1 work may add or edit a route. Routes introduced later (invoice, stats, import, export, ICS) each ship with their own `requireModule` guard.
- `src/components/settings-form.tsx` / `/settings` page: N3 matrix (1) → J2b invoice settings (3).
- `prisma/seed.ts`: touched by every DDL phase — always the DDL worker, never a feature worker.

---

## Open questions

**None blocking.** The 2026-08-14 question round resolved every decision in this roadmap — see the decisions table at the top. One round-1 item stays parked by the PO's choice:

- **Q8 (E5, material labels) — resolved by implementation, not a blocker.** E5 shipped in round 1 as **A4 3×8 sticker sheets** (commit `bce0716`; `src/app/(app)/materials/labels/page.tsx:11,64,107-117`). The round-1 plan's "⛔ blocked on Q8" line is stale. What remains is optional: a 62 mm label-roll variant, which the PO parked. Since the label layout is already A4-specific, adding a roll format later means parameterising the sheet geometry (label width/height and grid as CSS variables with two presets) rather than a new feature.

Two decisions carry an external dependency the PO owns rather than a design question:

- **Q22 (travel-cost VAT treatment)** — travel sits outside the subtotal but inside the total, with BTW over everything. This is the PO's stated intent; **confirm with their accountant** before J2b invoices go out to clients. The plan deliberately does not assert Belgian VAT law.
- **Q25c (Peppol)** — structured e-invoicing is a future goal, out of scope now. J2b's model is built Peppol-shaped so connecting later is an export layer. **If the accountant says the B2B mandate already applies to these invoices, reopen J2b before building it** — that would make it a compliance project, not a document project.

Items that will need their own design doc approved before implementation (not open questions, just gates): **J2b** invoices, **N5** own-data scoping, **P3** replace-import, and **O2** if the ICS feed's refresh lag ever proves unacceptable.
