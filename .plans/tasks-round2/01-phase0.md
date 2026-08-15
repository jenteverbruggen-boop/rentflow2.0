# Phase 0 — Foundations & quick wins

> Read `00-README.md` first (commit discipline, conventions, review checklist).
> 8 items, ~26 commits. **No PO decisions outstanding — this phase is ready to run now.**
> Gate to leave this phase: PO reviews the commits and retests items 1 and 5 in the app.

## Order and parallelism

```
Y1 (money)  ─────────────────────────► J1 (travel line)      [both own pricing.ts — strictly serial]
Y3 (splits) ─────────────────────────► H3 (picker)           [Y3 splits person-split-editor first]
                                     └► H4 (period defaults) [independent of H3]
Y4 (docs) · Y5 (env) · P1 (hardening)                         [fully independent, any time]
```

**Serial chains:** `Y1 → J1` and `Y3 → H3`. Everything else is parallel-safe.
**One worker owns `src/lib/pricing.ts` for the whole phase** (Y1 then J1). Do not split those two across workers.

⚠️ **Y3 splits `project-costs-tab.tsx`, which J1 then edits.** If different workers take Y3 and J1, Y3 must merge first. Simplest safe assignment: one worker takes `Y1 → Y3 → J1` in sequence; a second takes `H3 → H4`; a third takes `Y4 · Y5 · P1`.

---

## Y1 — Decimal → number at the API boundary `fixes a live production bug`

**Branch:** `y1-decimal-boundary`

### Why this is first

`prisma/schema.prisma` types money `Decimal`; `prisma/schema.dev.prisma` types it `Float`. `Prisma.Decimal.toJSON()` returns a **string**, and API routes return the model tree unconverted, so in production `number + setupCostSnapshot` string-concatenates: a €150 line with the default setup cost of `0` renders **€1500**. Dev (SQLite/Float) cannot reproduce it and `npm test` runs on SQLite, so nothing catches it. Verified facts:

- `src/app/api/projects/route.ts:18-22` returns `projectInclude` straight to `NextResponse.json()` with no conversion; `src/lib/project-include.ts:3-31` is the tree.
- Client types claim `number`: `src/types/index.ts:180-183,192,201-203`.
- Three concatenation sites: `src/lib/pricing.ts:52-56`, `src/components/cost-line-row.tsx:66-71`, `src/components/period-bookings.tsx:99-103`.
- `lineCost` (`src/lib/pricing.ts:37-50`) does `gross - discount.discountAmount` — subtraction coerces, so it is safe **today** but one edit from breaking.
- Partial ad-hoc conversions already exist: `src/lib/effective-price.ts:7,9,16,18`, `src/app/api/materials/route.ts:69,75`, `src/app/api/periods/[id]/materials/route.ts:32,35,52,58-59`.

Money keys to handle: `dayPrice`, `setupCost`, `bundlePriceOverride`, `dayPriceSnapshot`, `setupCostSnapshot`, `discountPct`, `discountAmount`, `unitCost`.

### Files to read before starting

| File | Why |
|---|---|
| `src/lib/project-include.ts:3-31` | The shared `projectInclude` tree — every money field returned by `/api/projects*` flows through this include. |
| `src/app/api/projects/route.ts:13-26,28-74` | `GET`/`POST` return `projectInclude` straight to `NextResponse.json()` — the primary bug site. |
| `src/app/api/projects/[id]/route.ts:14-29` | `GET` returns the same tree for a single project. |
| `src/lib/pricing.ts` (155 lines — already over the 150-line limit before this item touches it) | Coercion targets: `lineCost` (37-50), `materialLineCost` (52-56), `personLineCost` (58-60), `periodTravelCost` (71-79). |
| `src/components/cost-line-row.tsx:65-115` (`MaterialGroupCostRow`, setup arithmetic 66-71) | One of the two duplicated concatenation sites Y1.4 must fix. |
| `src/components/period-bookings.tsx:93-144` (setup arithmetic 99-103) | The other duplicated concatenation site. |
| `src/lib/effective-price.ts:7,9,16,18` | Existing ad-hoc `Number()` conversions — fold onto the new helper, don't leave a second mechanism. |
| `src/app/api/materials/route.ts:60,69,75` | `GET` is **partially** converted already (69, 75) but the base material spread at line 60 (`const base = { ...m, totalStock: m._count.stockItems, usedInSets };`) still leaks raw `dayPrice`/`setupCost`/`bundlePriceOverride`. |
| `src/app/api/periods/[id]/materials/route.ts:32,35,52,58-59` | Ad-hoc `Number()` conversions on the way *in* to `bookFlatMaterial`/`bookBundleMaterial` — the returned booking record is still unconverted on the way out. |
| `src/lib/booking.ts:59-92,116-163` | `bookFlatMaterial`/`bookBundleMaterial` — their `.create()` calls re-hydrate Postgres `Decimal` fields on the returned record regardless of the plain-`number` arguments passed in. This is second-order: the fix belongs in the **route handler's** response, not in `booking.ts` itself (out of scope this phase — H1/H2 own that file in phase 2). |
| `src/types/index.ts:176-186,188-194,196-206` | Client types declare `dayPriceSnapshot`/`setupCostSnapshot`/`discountPct`/`discountAmount` (180-183), `unitCost` (192), and the `PeriodPerson` equivalents (201-203) as `number` — this is exactly why TypeScript cannot catch the mismatch. |
| `src/lib/pricing.test.ts` (281 lines) | Existing suite; its `makeStockItem`/`makePerson` helpers return typed `PeriodStockItem`/`PeriodPerson` objects — see the typing trap below before writing the Y1.2 string-input describe block. |
| `package.json` (`"test": "vitest run"`) | Confirms `npm test` runs vitest against whatever Prisma client was last generated — SQLite in local dev, so this alone can never reproduce the bug. |
| `.github/workflows/ci.yml:23-30` | CI already generates the Postgres client and runs `tsc --noEmit` before generating the dev client for tests — read this before adding Y1.5's step so it composes rather than duplicates. |

### Current behaviour

`GET`/`POST /api/projects` and `GET /api/projects/[id]` return the Prisma result tree unmodified:

```ts
// src/app/api/projects/route.ts:17-22
const projects = await prisma.project.findMany({
  orderBy: { startDate: "asc" },
  include: projectInclude,
});
return NextResponse.json(projects);
```

Every money field in `projectInclude` (`src/lib/project-include.ts:3-31`) — `PeriodStockItem.dayPriceSnapshot`/`setupCostSnapshot`/`discountPct`/`discountAmount`, `PeriodPerson.dayPriceSnapshot`/`discountPct`/`discountAmount`, `PersonTravelCost.unitCost`, `PeriodBundleBooking.dayPriceSnapshot`, `ProjectMaterialPrice.dayPrice` (+ nested `Material.dayPrice`/`setupCost`/`bundlePriceOverride`), `ProjectPersonPrice.dayPrice` (+ nested `Person.dayPrice`) — is a Postgres `Decimal` in production, and `JSON.stringify` renders `Decimal` as a **string**.

The two duplicated concatenation sites, verified:

```tsx
// src/components/cost-line-row.tsx:65-71 (MaterialGroupCostRow)
const perUnit = lineCost(group.dayPriceSnapshot, days, group);
const setup = group.assignments.reduce(
  (s, a) => s + (a.setupCostSnapshot ?? 0),
  0,
);
const total = perUnit * group.units + setup;
```

```tsx
// src/components/period-bookings.tsx:99-103
const setup = g.assignments.reduce((s, a) => s + (a.setupCostSnapshot ?? 0), 0);
const groupCost = lineCost(g.dayPriceSnapshot, days, {
  discountPct: g.discountPct,
  discountAmount: g.discountAmount,
}) * g.units + setup;
```

Both `+ setup` operations coerce to string concatenation once `setupCostSnapshot` arrives unconverted from the wire.

`src/app/api/materials/route.ts` GET (lines 60-77) is **already partially fixed** — a useful template and a trap:

```ts
// src/app/api/materials/route.ts:60-77
const base = { ...m, totalStock: m._count.stockItems, usedInSets };
if (!m.isBundle) return base;
const bundleStock = computeBundleStock(
  m.components.map((c) => ({
    ...
    dayPrice: Number(c.child.dayPrice),           // ← converted
    ...
  })),
);
const setPrice =
  m.bundlePriceOverride != null
    ? Number(m.bundlePriceOverride)               // ← converted
    : bundleStock.componentSum;
return { ...base, bundleStock, setPrice };
```

`c.child.dayPrice` and `m.bundlePriceOverride` are converted; `base` — and therefore every material's own `dayPrice`/`setupCost`/`bundlePriceOverride` — is not.

### Complete route inventory (money-bearing payloads)

| Route | Verb(s) | Money fields returned | Conversion today |
|---|---|---|---|
| `src/app/api/projects/route.ts` | GET, POST | `dayPriceSnapshot`/`setupCostSnapshot`/`discountPct`/`discountAmount` (materials), `dayPriceSnapshot`/`discountPct`/`discountAmount` (people), `unitCost` (travel), `dayPriceSnapshot` (bundle bookings), `dayPrice` ×2 + nested `Material`/`Person` money fields (price overrides) | **none** — raw `projectInclude` tree |
| `src/app/api/projects/[id]/route.ts` | GET | same tree as above | **none** |
| `src/app/api/projects/[id]/route.ts` | PUT | — (`Project` has no money field) | n/a |
| `src/app/api/materials/route.ts` | GET | `dayPrice`, `setupCost`, `bundlePriceOverride` (base material); nested component `dayPrice`; `setPrice` | **partial** — nested/computed values converted (69, 75), base spread (60) not |
| `src/app/api/materials/route.ts` | POST | `dayPrice`, `setupCost` of the created material | **none** on output (input coerced with `Number()`) |
| `src/app/api/materials/[id]/route.ts` | GET, PUT | `dayPrice`, `setupCost`, `bundlePriceOverride` | **none** on output |
| `src/app/api/materials/available/route.ts` | GET | `dayPrice`, `basePrice` | **converted** (`Number(m.dayPrice)` etc.) |
| `src/app/api/people/route.ts` | GET, POST | `dayPrice` | **none** on output |
| `src/app/api/people/[id]/route.ts` | PUT | `dayPrice` | **none** on output |
| `src/app/api/people/available/route.ts` | GET | `dayPrice`, `basePrice` | **converted** |
| `src/app/api/materials/[id]/stock-items/route.ts` | GET | `dayPriceSnapshot`/`discountPct`/`discountAmount` on nested `assignments` | **none** |
| `src/app/api/periods/[id]/materials/route.ts` | POST | `dayPriceSnapshot`, `setupCostSnapshot` (via `bookFlatMaterial`/`bookBundleMaterial`) | **none** on the returned record |
| `src/app/api/periods/[id]/materials/[assignmentId]/route.ts` | PATCH | `dayPriceSnapshot`/`discountPct`/`discountAmount`/`setupCostSnapshot` | **none** |
| `src/app/api/periods/[id]/people/route.ts` | POST | `dayPriceSnapshot`/`discountPct`/`discountAmount` | **none** |
| `src/app/api/periods/[id]/people/[assignmentId]/route.ts` | PATCH | `dayPriceSnapshot`/`discountPct`/`discountAmount` | **none** |
| `src/app/api/periods/[id]/people/[assignmentId]/travel/route.ts` | GET, POST | `unitCost` | **none** |
| `src/app/api/periods/[id]/people/[assignmentId]/travel/[travelId]/route.ts` | PATCH | `unitCost` | **none** |
| `src/app/api/projects/[id]/prices/material/[materialId]/route.ts` | PUT | `dayPrice` (override) + nested `material.dayPrice`/`setupCost`/`bundlePriceOverride` | **none** — the local `price` variable is a coerced number but the `.upsert()` return value is not |
| `src/app/api/projects/[id]/prices/person/[personId]/route.ts` | PUT | `dayPrice` (override) + nested `person.dayPrice` | **none** |

`src/app/api/stock-items/[id]/route.ts` carries no money field today (`StockItem.costPrice` arrives later, K4/M1 in phase 3) — no action there this phase.

**Existing test files that touch pricing and need updating this item:** `src/lib/pricing.test.ts` (add the string-input describe block, Y1.2). No other test file references `pricing.ts`, `materialLineCost` or `personLineCost` directly (checked: `booking.integration.test.ts`, `booking.lock.test.ts`, `bundle-sharing.test.ts`, `bundle-stock.test.ts`, `material-code.test.ts`, `availability.test.ts` do not import from `pricing.ts`).

### Concrete traps

- **`pricing.ts` is already 155 lines — over the 150-line limit before Y1 touches it at all.** Both Y1.2 (coercion at 4 entry points) and J1.1 (restructuring `projectCostSummary`, later this phase) add lines without removing any. One of the two commits must extract something (e.g. move `formatEUR`/`BTW_RATE`/`btwAmount`/`withBtw` into a new small module) to stay compliant — decide which commit does it and say so in its body.
- `pricing.test.ts`'s `makeStockItem`/`makePerson` helpers return `PeriodStockItem`/`PeriodPerson` (every money field typed `number`). The Y1.2 string-input describe block cannot pass a string through that return type without a cast or a parallel raw-object-literal helper — plan for this or `tsc --noEmit` fails on the new test itself.
- Fixing `src/app/api/materials/route.ts` GET must close the gap at the `base` spread (line 60) specifically, without re-wrapping the already-converted lines 69/75.
- `src/lib/booking.ts` is second-order for `POST /api/periods/[id]/materials` — fix the route handler's response serialization, do not edit `booking.ts` (owned by H1/H2 next phase).
- `cost-line-row.tsx` (115 lines) and `cost-summary.tsx` (105 lines) are both grown again immediately afterwards by J1.2 (`TravelCostRow`) — leave headroom in Y1.4 rather than filling either file toward 150.
- `.github/workflows/ci.yml:23-30` already runs `prisma generate` (Postgres) then `tsc --noEmit` — Y1.5 should tighten/annotate this existing step, not add a duplicate.
- `npm run db:dev:seed` is wired to SQLite via `--env-file=.env.local` (`package.json`) — seeding the compose Postgres DB for Y1.3's verification needs `DATABASE_URL` overridden explicitly, not that script as-is.

### Verification commands

```bash
npx tsc --noEmit
npm run lint
npm test -- src/lib/serialize.test.ts
npm test -- src/lib/pricing.test.ts

# Y1.3 — must run against real Postgres; SQLite proves nothing
docker compose up -d db
npx prisma migrate deploy   # DATABASE_URL pointed at the compose db
DATABASE_URL="postgresql://rentflow:rentflow@localhost:5432/rentflow" npx tsx prisma/seed.ts
npm run build && npm start   # or npm run dev, same DATABASE_URL
curl -s -c cookies.txt -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<a seeded user email>","password":"<seeded password>"}'
curl -s -b cookies.txt localhost:3000/api/projects \
  | jq '.[0].periods[0].materials[0] | {dayPriceSnapshot, setupCostSnapshot}'
# success: both values are unquoted JSON numbers, e.g. {"dayPriceSnapshot": 150, "setupCostSnapshot": 0}
```

### Definition of done

- [ ] `src/lib/serialize.ts` exists, exports `toNumber`, has its own passing test file
- [ ] Every route in the inventory table above returns JSON numbers for its money fields, spot-checked against real Postgres
- [ ] `cost-line-row.tsx` and `period-bookings.tsx` call `materialLineCost` (or one shared helper) — no hand-rolled `+ setupCostSnapshot` reduce remains outside `pricing.ts`
- [ ] `pricing.test.ts` string-input suite fails before Y1.2's coercion and passes after (stash-and-diff, recorded in the commit body)
- [ ] `pricing.ts` is ≤150 lines after both Y1.2 and J1.1 have touched it
- [ ] The chosen recurrence guard (Y1.5) is implemented and named in that commit's body
- [ ] `CLAUDE.md` money rule added (Y1.6), `docs` skill run
- [ ] The actual `curl | jq` output (or an explicit "Postgres could not be run" statement) is ready for the phase exit report

### Commit sequence

**Y1.1 — `feat(lib): add money serializer for Decimal-safe API responses`**
- New `src/lib/serialize.ts`: `toNumber(v: unknown): number` (handles `number`, numeric `string`, `Prisma.Decimal`-like objects with `toString`, `null`/`undefined` → `0`; throws on genuinely non-numeric input rather than silently returning `NaN`), plus explicit per-shape mappers for the payloads that need it.
- Prefer explicit mappers over a recursive deep-walk: `/api/projects` returns a large nested tree and this is a hot path.
- New `src/lib/serialize.test.ts`: numbers pass through, numeric strings convert, `"0"` → `0` (not `NaN`), Decimal-like objects convert, `null` → `0`, garbage throws.
- **Verify:** `npm test` green.

**Y1.2 — `fix(pricing): coerce money inputs so string values cannot corrupt totals`**
- Coerce at every entry point in `src/lib/pricing.ts`: `lineCost`, `materialLineCost`, `personLineCost`, `periodTravelCost`. Belt-and-braces — even after Y1.3 the library must not be corruptible.
- Add to `src/lib/pricing.test.ts` a describe block that runs the **existing** assertions with **string** inputs (`"150"`, `"0"`, `"12.50"`) and asserts identical results. This is the only test shape that can catch the prod/dev divergence, because CI runs on SQLite.
- **This is the commit that fixes the €1500 bug** at library level. Body must say that displayed material costs change in production wherever a setup cost exists.
- **Verify:** the string suite fails before the coercion and passes after (check by stashing the source change).

**Y1.3 — `fix(api): return money as JSON numbers from every route`**
- Apply the serializer at: `projects` (list + `[id]`), `people`, `materials`, `materials/available`, `people/available`, `stock-items/[id]`, all `periods/*` routes, `projects/[id]/prices/*`.
- Consolidate the ad-hoc `Number()` calls listed above onto the helper — one mechanism, not two.
- **Verify (must be done against real Postgres — SQLite proves nothing):**
  ```bash
  docker compose up -d db
  # point DATABASE_URL at the compose db, npx prisma migrate deploy, seed, start the app
  curl -s localhost:3000/api/projects -b "rentflow_token=<token>" \
    | jq '.[0].periods[0].materials[0] | {dayPriceSnapshot, setupCostSnapshot}'
  # both MUST be unquoted numbers
  ```
  Record the actual output in the commit body. If Postgres cannot be run, say so explicitly in the report — do not claim verification you did not do.

**Y1.4 — `fix(ui): use materialLineCost instead of hand-rolled setup-cost arithmetic`**
- `src/components/cost-line-row.tsx:66-71` and `src/components/period-bookings.tsx:99-103` both reduce `s + (a.setupCostSnapshot ?? 0)` and then add it to a product — the same bug, duplicated by hand.
- Make both call `materialLineCost` (or a small shared helper for the grouped case) rather than reimplementing it. Removing the duplication is the actual fix; coercion alone would leave the trap in place.
- **Verify:** the Kosten tab and the period bookings panel show identical figures to each other and to the print view for a material with a non-zero setup cost.

**Y1.5 — `ci: type-check against the Postgres client to catch Decimal drift`**
- Add a CI step in `.github/workflows/ci.yml` that generates the client from `prisma/schema.prisma` and runs `tsc --noEmit`, so Decimal-vs-number type drift fails the build instead of reaching production. The workflow already generates both clients (see the existing step order) — make the Postgres type-check explicit and non-skippable.
- Then pick **one** recurrence guard from the plan and implement it in this commit: preferred is a branded `Money` type that only `toNumber` can mint, so a raw wire value cannot flow into arithmetic. If a branded type proves too invasive for the existing call sites, fall back to an eslint rule banning `+` on `*Snapshot`/`*Price`/`unitCost` identifiers outside `serialize.ts`. **State in the commit body which guard you chose and why.**
- Without this, the next new route (J2b, K1, M1, P2) silently reintroduces the bug — `NextResponse.json()` accepts anything.

**Y1.6 — `docs: record the Decimal/Float divergence in CLAUDE.md`**
- Add the money rule to `CLAUDE.md` conventions: never return raw Decimal, never `+` an unconverted wire value, and dev (SQLite/Float) cannot reproduce production money behaviour.
- Run the `docs` skill.

**Out of scope for Y1:** changing any money *semantics* (that is J1), touching the schemas, and rounding-strategy changes (`pricing.ts` rounds at every intermediate step — leave that alone, it is not the bug).

---

## Y3 — Split the five over-limit files `pure refactor`

**Branch:** `y3-file-splits`

All five exceed or sit at the 150-line limit and every one is grown by a later item. Split them **now, in one batch**, as pure refactors so the feature diffs stay reviewable. **No behaviour change in any commit** — if the UI renders differently, you have gone too far.

| File | Lines | Grown later by |
|---|---|---|
| `src/components/project-costs-tab.tsx` | 183 | J1, J2a |
| `src/app/(app)/planning/page.tsx` | 173 | I1, I2, I3 |
| `src/components/person-split-editor.tsx` | 230 | H3, H1, H2, L2 |
| `src/app/(app)/projects/[id]/page.tsx` | 168 | — |
| `src/components/material-detail-pane.tsx` | 131 | M1 (archived badge) |
| `src/components/material-split-editor.tsx` | **403** | **H3.1 edits it next commit** — added after review; it is the largest over-limit file in the repo and was missing from this batch |
| `src/lib/pricing.ts` | **155** | already over the limit **before** Y1 and J1 touch it — one of those two must extract something (helpers into `src/lib/pricing-helpers.ts`, or the BTW block into its own module) |

Follow the established pattern: one child component per section, composed in the parent (see how `material-detail-pane.tsx` already delegates to `MaterialSummaryGrid`, `MaterialCodes`, `MaterialStockList`, `BundleComponentEditor`, `BundleStockSummary`).

### Files to read before starting

- `src/components/project-costs-tab.tsx` (183 lines) — the whole file; every section must be identified before extracting.
- `src/components/cost-line-row.tsx` and `src/components/cost-summary.tsx` — child components `project-costs-tab.tsx` already uses; understand the boundary before adding a third.
- `src/app/(app)/planning/page.tsx` (173 lines) — the whole file, in particular the grid at `:94-129` and the list at `:131-170`.
- `src/components/planning-calendar-item.tsx` (82 lines) — the existing bespoke child component; match its prop-passing pattern for the two new ones.
- `src/components/person-split-editor.tsx` (230 lines) — the whole file.
- `src/components/material-split-editor.tsx` (403 lines) — **not** in this item's file list but shares the exact `.slice(0, 10)` bug and the available/assigned-pane shape; read it to understand why it was *not* included (see the trap below).
- `src/app/(app)/projects/[id]/page.tsx` (168 lines) — the whole file.
- `src/components/material-detail-pane.tsx` (131 lines) — the whole file, plus `MaterialSummaryGrid`, `MaterialCodes`, `MaterialStockList` briefly, to match the existing extraction pattern exactly.

### Current behaviour and proposed splits

| File | Current lines | Proposed split |
|---|---|---|
| `project-costs-tab.tsx` | 183 | Extract the per-period block (`sorted.map((period) => { ... })`, lines 81-175 today, ~95 lines including its own table markup) into `cost-period-section.tsx` taking `{ period, project }`. Parent keeps `PRINT_CSS` (29-49), the print button, the print-only document header (71-79) and the `<CostSummary>` call — shrinks to roughly **85-90 lines**. New `cost-period-section.tsx` ≈ **100-110 lines**. |
| `planning/page.tsx` | 173 | Per the brief: pull the 7-column grid (`:94-129`, 36 lines) into `planning-week-grid.tsx` (≈ **50 lines** incl. imports/props) and the "alle projecten deze week" list (`:131-170`, 40 lines) into `planning-week-list.tsx` (≈ **55 lines**). Keep the `useState(new Date())` cursor, `fetchProjects`, `countAssignments` and `projectsOnDay` in the page (I1 replaces the cursor later). Page shrinks to roughly **75-85 lines**. |
| `person-split-editor.tsx` | 230 | Extract the "Beschikbaar" pane JSX (`:111-169`, 59 lines) into `person-available-pane.tsx` (≈ **80-90 lines** incl. its own search input and role list) and the assigned pane (`:171-225`, 55 lines) into `person-assigned-pane.tsx` (≈ **70-80 lines**). Extract the two grouping `useMemo`s (`byRole` at `:53-61`, `assignedByRole` at `:75-83`, ~20 lines combined) into a small new `src/lib/person-grouping.ts` (≈ **30-35 lines**) — do **not** append to `src/lib/grouping.ts` (114 lines already, and it is material-booking-specific). Keep the `range` computation (`:27-33`, the `.slice(0, 10)` bug H3 fixes next), `assignedIds`, and the `add`/`remove` mutations in the parent. Parent shrinks to roughly **90-100 lines**. |
| `projects/[id]/page.tsx` | 168 | Extract the back-button + action-links + summary `<Card>` block (`:69-122`, ~54 lines) into `project-detail-header.tsx` (≈ **65 lines**) and the `<Tabs>` assembly (`:124-164`, ~41 lines) into `project-detail-tabs.tsx` (≈ **55 lines**, props: `project`, `tab`, `setTab`, `selectedPeriodId`, `onSelectPeriod`, `jumpToPeriod`). Parent keeps data fetching and state — shrinks to roughly **70-80 lines**. |
| `material-detail-pane.tsx` | 131 (already under the limit, but M1 adds an archived badge/toggle later) | Extract the `CardHeader` block (title + "Markeer als set"/"Beheer units" buttons, `:51-77`, ~29 lines) into `material-detail-header.tsx` (≈ **40 lines**). Parent shrinks to roughly **100-105 lines**, giving M1 headroom to add the archived badge without re-crossing 150. |

### Concrete traps

- **`material-split-editor.tsx` is 403 lines — the largest over-limit file in the codebase — but it is not in this item's list of five.** H3.1 edits it in the very next item (fixing the same `.slice(0, 10)` bug as `person-split-editor.tsx`, at `:43-44`). The per-commit checklist in `00-README.md` requires "every touched file ≤ 150 lines", which this file cannot satisfy without a split of its own. Flag this to the PO/reviewer rather than silently absorbing a 403-line file into this batch (it is out of this item's stated scope) or silently skipping the checklist item in H3 — either choice is a real deviation from the brief and should be reported, not improvised.
- `project-costs-tab.tsx`'s `PRINT_CSS` constant (`:29-49`) is duplicated in spirit by `print-layout.tsx:6-34` (per the source plan) — do not merge them in this item (that is J3, phase 3); just don't let the Y3.1 split make the eventual merge harder by scattering the constant further.
- `planning/page.tsx`'s `countAssignments` and `projectsOnDay` helpers are used by both the grid and the list — decide once whether they live in the page and are passed as props/results, or are duplicated; duplicating them is the "improving logic while moving it" mistake the item's own "Out of scope" line warns against, so prefer passing computed data down.
- `person-split-editor.tsx`'s `add` mutation reads `p.person.role ?? undefined` (`:151` in the wider codebase, referenced by L2 later) when adding a person — if the available pane is extracted, the `onAdd` callback signature must still let the parent read `p.person.role`; do not simplify this away.
- None of these five files has a dedicated test file today (`find src -name "*.test.tsx"` returns nothing) — "visually identical" verification is manual click-through, not an automated regression check. Say so explicitly when reporting Y3 as done.

### Verification commands

```bash
npx tsc --noEmit
npm run lint
npm test
npm run dev
# then manually click through: /projects/:id (Kosten tab), /planning, a period's Personen tab,
# /projects/:id (Overzicht/Periodes/tab shell), /materials (a non-bundle and a bundle material)
# — each screen must render pixel-identical to before the split.
```

### Definition of done

- [ ] All five files (`project-costs-tab.tsx`, `planning/page.tsx`, `person-split-editor.tsx`, `projects/[id]/page.tsx`, `material-detail-pane.tsx`) are ≤150 lines
- [ ] Every new extracted file is also ≤150 lines
- [ ] No prop renames, no query-key changes, no logic "improvements" — diffed against the pre-split render for each screen
- [ ] `material-split-editor.tsx`'s 403-line, out-of-batch status is reported explicitly (see trap above), not silently resolved or silently ignored
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` green after each of the five commits

**Y3.1 — `refactor(costs): extract cost tab sections into components`**
**Y3.2 — `refactor(planning): extract week grid and project list from the planning page`**
- Pull the inline 7-column grid (`:94-129`) and the "alle projecten deze week" list (`:131-170`) into `planning-week-grid.tsx` and `planning-week-list.tsx`. Leave the `useState(new Date())` cursor in the page — I1 replaces it with URL state.
**Y3.3 — `refactor(bookings): split the person split editor`**
- 230 lines with two panes, grouping logic and mutations. Extract the available pane, the assigned pane and the grouping helpers. Keep the `.slice(0, 10)` range bug **as-is** — H3 fixes it deliberately, and mixing the two makes both unreviewable.
**Y3.4 — `refactor(projects): extract project detail header and tab shell`**
**Y3.5 — `refactor(materials): extract detail pane sections`**
**Y3.6 — `refactor(bookings): split the material split editor`**
- `src/components/material-split-editor.tsx` is **403 lines** — the worst offender in the repo, and H3.1 edits it in the very next item. Split it the same way as `person-split-editor.tsx` (Y3.3): available pane, assigned pane, grouping helpers. Keep the `.slice(0, 10)` range bug at `:43-44` **as-is** — H3.1 fixes it deliberately.

Each commit: **verify** `tsc` + `lint` + `npm test` green, and click through the affected screen to confirm it is visually identical.

**Out of scope:** renaming props, changing query keys, "improving" any logic you move.

---

## Y4 — Make the docs match reality

**Branch:** `y4-doc-drift`

Verified drift: `README.md:31,142-163` claims the image comes from Docker Hub, but `docker-compose.yml:10` and `.github/workflows/release.yml` use `ghcr.io/jenteverbruggen-boop/rentflow2.0`. `docs/docker-compose.md` (254 lines) documents a **three-service backend/frontend/nginx stack that does not exist**, built by a `builds.yml` workflow that does not exist. `.github/prompts/docker.prompt.md` prescribes the same phantom split and `node:20-alpine` (actual: `node:22-alpine`).

### Files to read before starting

- `README.md` (258 lines) — in particular the Tech Stack table (`:20-31`), the "Docker Compose (Production)" section (`:142-163`) and the CI/CD table (`:241-246`); all reference the real single-container setup and must stay internally consistent after the edit.
- `docs/docker-compose.md` (253 lines) — read enough to confirm it describes the phantom 3-service stack before deleting it; do not delete on the strength of this brief alone.
- `.github/prompts/docker.prompt.md` (38 lines) — the whole file; it is short and wrong in almost every line (base images, compose image names, healthcheck examples for a backend/frontend split that doesn't exist).
- `docker-compose.yml` (20 lines) — the real, current 2-service file; the source of truth to align both docs against.
- `Dockerfile` (30 lines) — confirms the actual base image (`node:22-alpine`, all three stages) and the single-image, multi-stage shape.
- `.github/workflows/release.yml` (58 lines) — confirms the real registry (`ghcr.io`, `docker/login-action` with `registry: ghcr.io`, `:39-43`) and tagging scheme.
- `.plans/2026-08-po-feedback-round2.md` Q45a decision ("Own server / VPS") — the fact to fold into the README's deployment section per Y4.2.

### Current behaviour

`README.md:29-31` (Tech Stack table):
```md
| Containerisation | Docker (multi-stage standalone build), Docker Compose |
| CI/CD | GitHub Actions → Docker Hub |
```

`README.md:142-144`:
```md
## Docker Compose (Production)

Uses PostgreSQL. The app image is pulled from Docker Hub; the container runs `prisma migrate deploy` on startup.
```

The real image, verified: `docker-compose.yml:10` → `image: ghcr.io/jenteverbruggen-boop/rentflow2.0:latest`. `.github/prompts/docker.prompt.md` in full asserts a `node:20-alpine` base for both a "backend" and "frontend" stage, an nginx runtime stage, and Docker Hub images `thewizard2026/rentflow-backend`/`-frontend` — none of which exist; the real `Dockerfile` is a single 3-stage `node:22-alpine` build (`Dockerfile:1,6,13`) with **no** nginx stage and **no** backend/frontend split.

### Concrete traps

- `docs/docker-compose.md` is 253 lines of detail (env vars, service definitions, troubleshooting) for a stack that never existed in this form — skim it fully before deciding "delete" vs "rewrite" so nothing accurate-but-buried is lost (e.g. check for any generic Postgres/volume advice that still applies to the real 2-service file).
- `.github/prompts/docker.prompt.md` is consumed by whatever generates/reviews Dockerfiles under the `cicd` skill — after editing it, re-read the `cicd` skill's own instructions (`.claude/skills/cicd`) to confirm they don't cite the old prompt file's content verbatim elsewhere.
- Do not touch `Dockerfile`, `docker-compose.yml` or `release.yml` in this item — Y4 is docs-only; P1 (this same phase) changes the real compose file, so a docs-only Y4 commit must not accidentally pre-empt P1's healthcheck/`USER` changes.
- The README's API Overview table (`:190-237`) and Future plan list (`:250-257`) are unaffected by this item — do not touch them; only the Tech Stack row, the Docker Compose section, and the deployment-location fact (Q45a) change.

### Verification commands

```bash
grep -rn "Docker Hub" README.md .github/prompts/docker.prompt.md docs/ 2>/dev/null
grep -rn "node:20-alpine" .github/prompts/docker.prompt.md 2>/dev/null
grep -rn "thewizard2026" README.md docs/ .github/prompts/ 2>/dev/null
# success: all three return no matches once Y4 is done
ls docs/docker-compose.md 2>/dev/null   # success: either gone, or replaced with content that matches docker-compose.yml exactly
npx tsc --noEmit && npm run lint
```

### Definition of done

- [ ] No file in the repo names Docker Hub, `thewizard2026/*`, `node:20-alpine`, a backend/frontend/nginx split, or a `builds.yml` workflow
- [ ] README's Tech Stack table and Docker Compose section both say GHCR and match `docker-compose.yml:10` exactly
- [ ] README states production runs on the PO's own server/VPS (Q45a)
- [ ] `.github/prompts/docker.prompt.md` matches the real single-container `node:22-alpine` GHCR setup
- [ ] `cicd` and `docs` skills both run
- [ ] `npx tsc --noEmit` and `npm run lint` still clean (docs-only change, but the checklist still applies)

**Y4.1 — `docs: delete the obsolete three-service compose guide`**
- `docs/docker-compose.md` describes an architecture the repo never had in this form. Delete it, or replace it with a short accurate page for the real two-service setup. Deleting is preferred over maintaining a second source of truth alongside the README.

**Y4.2 — `docs: correct registry and base-image references`**
- README: GHCR not Docker Hub, in both the tech-stack table and the deployment section. Add that production runs on the PO's own server/VPS (decided Q45a).
- `.github/prompts/docker.prompt.md`: single container, `node:22-alpine`, GHCR.
- Run the `cicd` and `docs` skills.

---

## Y5 — Startup env validation

**Branch:** `y5-env-validation`

Today: `process.env.JWT_SECRET!` (`src/lib/auth.ts:3`); `new TextEncoder().encode(process.env.JWT_SECRET)` in `src/proxy.ts:4` and `src/components/sidebar.tsx:8`, which **silently encodes an empty key** if the var is missing; `process.env.DATABASE_URL ?? ""` (`src/lib/prisma.ts:8`). Every failure is deferred to first use.

### Files to read before starting

- `src/lib/auth.ts` (18 lines) — `JWT_SECRET` read at module load (`:3`), used by `signToken`/`verifyToken` (Node runtime, `jsonwebtoken`).
- `src/proxy.ts` (33 lines) — Edge runtime; `JWT_SECRET` encoded at module load (`:4`); this is the file that must stay Edge-safe after Y5 (no Node built-ins, careful with the `zod` import).
- `src/components/sidebar.tsx` (85 lines) — Server Component; encodes the same secret independently at `:8` — a second copy of the exact same footgun.
- `src/lib/prisma.ts` (17 lines) — `DATABASE_URL` read at `:8` with a silent `?? ""` fallback; decides SQLite vs Postgres adapter from the URL shape (`:9-11`).
- `.env.example` / `.env.local.example` — the two real shapes `DATABASE_URL`/`JWT_SECRET` take in this repo (Postgres connection string vs `file:./prisma/dev.db`; a 30+ character prod secret vs `local-dev-secret-change-in-production`, 33 chars).
- `package.json` — confirms `zod` is already a dependency (used elsewhere for route validation), so no new package is needed for `env.ts`.
- `.github/workflows/ci.yml:33-36,43-45` — CI sets `JWT_SECRET: ci-placeholder-secret` (22 chars) and `DATABASE_URL` placeholders for the test and build steps; whatever minimum length Y5 picks must not reject these.

### Current behaviour

```ts
// src/lib/auth.ts:1-3
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
```

```ts
// src/proxy.ts:1-4
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
```

```ts
// src/components/sidebar.tsx:8
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
```

```ts
// src/lib/prisma.ts:8-11
const url = process.env.DATABASE_URL ?? "";
const adapter = url.startsWith("file:")
  ? new PrismaLibSql({ url })
  : new PrismaPg({ connectionString: url });
```

`proxy.ts` and `sidebar.tsx` each call `new TextEncoder().encode(undefined)` if `JWT_SECRET` is unset — `TextEncoder.encode` coerces `undefined` to the string `"undefined"` rather than throwing, so every request is verified against a **valid, silently-wrong key** instead of failing loudly. `auth.ts`'s `!` assertion means `jwt.sign`/`jwt.verify` throw only at first call, not at boot. `prisma.ts`'s `?? ""` means an empty string is fed to `PrismaPg({ connectionString: "" })`, which fails only on the first query.

### Concrete traps

- **Two independent copies of the same `TextEncoder` line** (`proxy.ts:4`, `sidebar.tsx:8`) — both must import from the new `src/lib/env.ts`, or the fix is half-done and the sidebar keeps its own silent-empty-key bug.
- `proxy.ts` runs on the **Edge runtime** — `zod`'s default export is Edge-safe in this project already (it's used in several Node-runtime route handlers, but confirm no transitive Node-only import sneaks in via `env.ts`) and must be checked with an actual `npm run build`, not just `tsc --noEmit`, since Edge bundling failures don't always surface as type errors.
- `sidebar.tsx` is a **Server Component**, not Edge — it can import a Node-safe module, but if `env.ts` is shared between `proxy.ts` (Edge) and `sidebar.tsx`/`auth.ts`/`prisma.ts` (Node), it must satisfy the stricter Edge constraint anyway since one file imports it in both runtimes.
- Picking the JWT_SECRET minimum length: CI's placeholder (`ci-placeholder-secret`, 22 chars) and the local dev default (`local-dev-secret-change-in-production`, 33 chars) both currently pass; whatever floor is chosen (brief suggests 16) must not reject either, or CI and local dev both break on this commit.
- `prisma.ts:9` branches on `url.startsWith("file:")` to choose the adapter — validating `DATABASE_URL` as "non-empty" is not sufficient to catch a malformed value that still passes that check (e.g. a Postgres URL missing the scheme); keep the zod check to "non-empty string", per the brief, and don't scope-creep into full URL-shape validation.
- This item's `env.ts` will very likely become a dependency of Y1's new `serialize.ts` boundary work only indirectly (both are `src/lib/` additions this phase) — no functional overlap, but if both workers land the same day, check for a merge conflict on nothing shared (they don't share files), just sequencing noise in the phase's commit log.

### Verification commands

```bash
npx tsc --noEmit
npm run lint
npm test

# Unset JWT_SECRET and confirm a single clear boot-time error, not a downstream 500
JWT_SECRET= DATABASE_URL="file:./prisma/dev.db" npm run dev
# success: the process fails fast with one readable error naming JWT_SECRET, before any request is served

# Both runtimes must still build
npm run build
# success: no Edge bundling error for src/proxy.ts, no Node error for the server bundle
```

### Definition of done

- [ ] `src/lib/env.ts` exists with a zod schema for `DATABASE_URL` (non-empty) and `JWT_SECRET` (stated minimum length)
- [ ] `src/lib/auth.ts` and `src/lib/prisma.ts` import the parsed object instead of reading `process.env` directly
- [ ] `src/proxy.ts` **and** `src/components/sidebar.tsx` both import from `env.ts` — no `new TextEncoder().encode(process.env.JWT_SECRET)` remains duplicated
- [ ] Unsetting either var produces one clear error at boot, verified by actually running the command above
- [ ] `npm run build` succeeds (Edge bundle for `proxy.ts` unaffected)
- [ ] CI's placeholder secrets (`ci-placeholder-secret`, etc.) still pass validation

**Y5.1 — `feat(config): validate DATABASE_URL and JWT_SECRET at startup`**
- `src/lib/env.ts` with a zod schema (`DATABASE_URL` non-empty, `JWT_SECRET` min length — pick a sane floor like 16 chars and state it), exporting a parsed object.
- Import from `src/lib/prisma.ts` and `src/lib/auth.ts`.
- **Must stay Edge-safe** for `src/proxy.ts` — no Node built-ins, no `zod` import if it drags in anything Node-only (verify the Edge build actually compiles: `npm run build`).
- **Verify:** unset `JWT_SECRET` and confirm one clear error at boot rather than a confusing downstream failure; both runtimes still build.

---

## H3 — Fix the availability picker window `PO item 1, partial`

**Branch:** `h3-availability-window` · **after Y3.3**

`src/components/person-split-editor.tsx:28-29` (and `material-split-editor.tsx:43-44`) truncate the period bounds with `.slice(0, 10)`. Date-only strings parse as **UTC midnight**, so for a single-day period `from === to` → a zero-width window → the overlap test (`src/lib/availability.ts:92`, strict `lt`/`gt`) matches nothing → **everyone reads "Beschikbaar"** (`:144`) with the add button enabled (`:150`), right up until the server returns 409 (`src/app/api/periods/[id]/people/route.ts:37-41`). On a multi-day period it drops the last day's daytime instead. This is the "it says free but won't let me book" complaint.

### Files to read before starting

- `src/components/person-split-editor.tsx` — after Y3.3's split, the `.slice(0, 10)` truncation (`:28-29` today) lives wherever the `range` object is now built (likely still the parent, per Y3.3's instruction to keep the mutations/range logic there).
- `src/components/material-split-editor.tsx` (403 lines — see the Y3 trap above) — same bug at `:43-44`, in the file that Y3 did **not** split.
- `src/lib/availability.ts` — `findAvailableStockItems` (`:10-42`), `checkPersonAvailability` (`:78-105`, strict boundary at `:92`), `checkStockItemSameProject` (`:107-136`). Read the whole file; it is short and every function shares the same `lt`/`gt` shape.
- `src/lib/availability.test.ts` (76 lines) — the whole file; existing coverage is back-to-back boundaries and a 1-minute overlap, both for `findAvailableStockItems`, plus one `checkPersonAvailability` back-to-back case. No same-day day/evening case exists yet.
- `src/app/api/people/available/route.ts` (49 lines) — raw `new Date(from)`/`new Date(to)` at `:29-30`, no validation beyond "present" (`:17`).
- `src/app/api/materials/available/route.ts` (118 lines) — same shape, `:20-24` extracts the params, `new Date(from)`/`new Date(to)` at `:60-61`.
- `src/app/api/periods/[id]/people/route.ts` (62 lines) — the conflict response the picker is racing against (`:37-41`); also note the **no-transaction, no-`P2002`-catch** shape (`:24-47`) that H3 must not fix (that's H1, phase 2 — out of scope here).
- `src/hooks/use-availability.ts` (45 lines) — `usePersonAvailability`/`useMaterialAvailability`; confirms the query-string shape (`buildQS`) both editors rely on — the `from`/`to` values pass through unmodified, so the fix is entirely in what the editors put into `range.from`/`range.to`.

### Current behaviour

```tsx
// src/components/person-split-editor.tsx:27-33
const range = {
  from: period.startDate.slice(0, 10),
  to: period.endDate.slice(0, 10),
  excludePeriodId: period.id,
  sameProjectId: project.id,
  projectId: project.id,
};
```

```tsx
// src/components/material-split-editor.tsx:42-47
const range = {
  from: period.startDate.slice(0, 10),
  to: period.endDate.slice(0, 10),
  sameProjectId: project.id,
  projectId: project.id,
};
```

```ts
// src/lib/availability.ts:85-96 (checkPersonAvailability)
const conflict = await defaultPrisma.periodPerson.findFirst({
  where: {
    personId,
    ...(args.excludePeriodId != null
      ? { NOT: { periodId: args.excludePeriodId } }
      : {}),
    period: {
      AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }],
    },
  },
  include: { period: { include: { project: true } } },
});
```

```tsx
// src/components/person-split-editor.tsx:140-155 (the "Beschikbaar" label and the add button)
<p className="text-[10px] text-muted-foreground truncate">
  {p.isAvailable ? "Beschikbaar" : `Bezet (${p.blockingProject?.name})`} · {formatEUR(p.person.dayPrice)}/d
</p>
...
<Button
  size="icon"
  className="h-7 w-7"
  disabled={!p.isAvailable || add.isPending}
```

```ts
// src/app/api/people/available/route.ts:26-33
const results = await Promise.all(
  people.map(async (p) => {
    const check = await checkPersonAvailability(p.id, {
      from: new Date(from),
      to: new Date(to),
      excludePeriodId: excludePeriodId ? parseInt(excludePeriodId) : undefined,
      sameProjectId: sameProjectId ? parseInt(sameProjectId) : undefined,
    });
```

Both `available` routes only check `if (!from || !to) return badRequest(...)` (`people/available/route.ts:17`, `materials/available/route.ts:25`) — an unparseable string produces `new Date("garbage")` → `Invalid Date`, and an inverted range (`to` before `from`) is never rejected; `Invalid Date` in a Prisma `lt`/`gt` comparison does not throw, it just matches nothing, silently reproducing the same "everyone available" failure mode this item exists to fix.

### Concrete traps

- Y3.3 splits `person-split-editor.tsx` into available/assigned panes **before** this item — re-read whichever file now owns the `range` object; the line numbers above (`:27-33`) are pre-split and will have moved.
- `material-split-editor.tsx` was **not** split by Y3 (see the Y3 trap) and is 403 lines; fixing `:43-44` here still leaves the file over the 150-line limit — decide how to report this (see Y3's definition of done) rather than silently expanding an already-oversized file further.
- `toISOString()` always renders UTC (`Z` offset) — sending "full ISO strings with offset" from a `datetime-local` input (which has no timezone) means constructing the Date from the local wall-clock value and letting `toISOString()` do the UTC conversion, **not** naively concatenating a `Z` onto the local time string. Get this wrong and the picker will be correct in this UTC-server dev environment by accident, then wrong the moment the server or a user's browser sits in a different offset — verify against Postgres per the project's Time rule, not just SQLite.
- `checkPersonAvailability`'s `RangeArgs` type (`availability.ts:4-8`) types `from`/`to` as `Date`, not `string` — the two `available` routes already do the `new Date(from)` conversion (`people/available/route.ts:29-30`, `materials/available/route.ts:60-61`); H3.2's validation must reject bad input **before** that conversion, inside the route handler, not inside `availability.ts` (which stays a pure function this item).
- The existing back-to-back test (`availability.test.ts:29-55`) mocks `periodStockItem.findMany` with a hand-rolled overlap calculation inside the mock — a new same-day test must follow the same mocking shape (see `checkPersonAvailability`'s simpler mock at `:67-76` for a closer template, since H3 is about `checkPersonAvailability`, not `findAvailableStockItems`).
- Do not touch `src/app/api/periods/[id]/people/route.ts:24-47` (no transaction, no `P2002` catch) — that is explicitly H1's job in phase 2; H3 only adds validation to the two `available` routes.

### Verification commands

```bash
npx tsc --noEmit
npm run lint
npm test -- src/lib/availability.test.ts
npm test

npm run dev
# PO's exact scenario: book a person 08:00-17:00 on project A (a single-day period),
# then open the split editor for an 18:00-23:00 period on project B, same calendar day.
# success: that person shows "Beschikbaar"; for a 14:00-20:00 period the same day, "Bezet".

curl -s "localhost:3000/api/people/available?from=not-a-date&to=2026-06-01T17:00:00.000Z" -b cookies.txt
curl -s "localhost:3000/api/people/available?from=2026-06-02T00:00:00.000Z&to=2026-06-01T00:00:00.000Z" -b cookies.txt
# success: both return 400, not a 200 with nonsense results
```

### Definition of done

- [ ] Neither split editor truncates `from`/`to` with `.slice(0, 10)` — both send full ISO timestamps with offset
- [ ] The PO's exact scenario (08:00-17:00 vs 18:00-23:00 same day → available; vs 14:00-20:00 → busy) is verified and recorded in the H3.1 commit body
- [ ] `people/available` and `materials/available` reject missing, unparseable and inverted ranges with `badRequest`
- [ ] `availability.test.ts` covers the same-day non-overlap case and the inverted-range rejection
- [ ] `material-split-editor.tsx`'s continued over-limit status (403 lines, untouched by Y3) is reported, not silently absorbed
- [ ] Verified against Postgres, not only SQLite, per the project's Time rule

**H3.1 — `fix(bookings): send full timestamps when checking availability`**
- Send full ISO strings **with offset** for `from`/`to` in both split editors. Do not truncate, do not reformat via `toISOString().slice(...)`.
- **Verify:** a person booked 08:00–17:00 shows *available* for an 18:00–23:00 period on the same day, and *busy* for a 14:00–20:00 one. This is the PO's exact scenario — record it in the commit body.

**H3.2 — `fix(api): validate availability query ranges`**
- `src/app/api/people/available/route.ts:29-30` and `src/app/api/materials/available/route.ts:20-24` do raw `new Date()` on unvalidated query params. Return `badRequest` for missing, unparseable or inverted ranges (`to <= from`).

**H3.3 — `test(availability): cover same-day non-overlapping windows`**
- `src/lib/availability.test.ts` currently covers back-to-back boundaries and a 1-minute overlap, but **not** the same-day day/evening case. Add it, plus the inverted-range rejection.
- Optional in the same commit: show the conflicting **window** (not just the project name) in the "Bezet" label so the user can see *why*.

**Out of scope:** assignment-level hours (H1, phase 2), the transaction/`P2002` race fix (H1).

---

## H4 — Stop defaulting periods to the whole project `PO item 1, partial`

**Branch:** `h4-period-defaults`

Two places create project-spanning periods, which is what actually books a person solid for a whole project: `src/app/api/projects/route.ts:58-66` auto-creates `"Hoofdperiode"` over the full range, and `src/components/period-form.tsx:59-62` defaults a new period to the full range at `T08:00`–`T17:00`.

**Decided default (no PO input needed):** a new period is **one day** — the project start date, 08:00–17:00. The auto-created first period keeps the name `"Hoofdperiode"` and the same single-day shape. Users extend it if they want more.

### Files to read before starting

- `src/components/period-form.tsx` (121 lines) — the whole file; the default-value logic (`:50-64`) and the client-side `.refine` (`:20-23`) both matter to this item.
- `src/app/api/projects/route.ts` (75 lines) — `POST` handler, the auto-created `"Hoofdperiode"` (`:58-66`).
- `src/app/api/projects/[id]/periods/route.ts` (33 lines) — `POST`, raw `new Date(startDate)`/`new Date(endDate)` with no range validation (`:16-22`).
- `src/app/api/periods/[id]/route.ts` (38 lines) — `PATCH`, same lack of validation (`:13-19`).
- `src/lib/availability.test.ts` and `src/app/api/periods/[id]/people/route.ts:37-41` — not touched by H4, but worth a glance to confirm the single-day default doesn't change any availability-check assumption.

### Current behaviour

```ts
// src/app/api/projects/route.ts:58-66
periods: {
  create: [
    {
      name: "Hoofdperiode",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  ],
},
```

```tsx
// src/components/period-form.tsx:16-23
const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  startDate: z.string().min(1, "Verplicht"),
  endDate: z.string().min(1, "Verplicht"),
}).refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
  message: "Einddatum moet na startdatum liggen",
  path: ["endDate"],
});
```

```tsx
// src/components/period-form.tsx:57-63 (the "else" branch of the defaultValues effect — no existing period)
} else {
  form.reset({
    name: "",
    startDate: format(new Date(project.startDate), "yyyy-MM-dd") + "T08:00",
    endDate: format(new Date(project.endDate), "yyyy-MM-dd") + "T17:00",
  });
}
```

```ts
// src/app/api/projects/[id]/periods/route.ts:16-22
const { name, startDate, endDate } = await req.json();
if (!name || !startDate || !endDate)
  return badRequest("naam, startdatum en einddatum zijn verplicht");
const period = await prisma.period.create({
  data: {
    projectId: parseInt(id),
    name,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  },
```

```ts
// src/app/api/periods/[id]/route.ts:12-19 (PATCH)
const { name, startDate, endDate } = await req.json();
if (!name || !startDate || !endDate)
  return badRequest("naam, startdatum en einddatum zijn verplicht");
const period = await prisma.period.update({
  where: { id: parseInt(id) },
  data: { name, startDate: new Date(startDate), endDate: new Date(endDate) },
});
```

Neither route validates `endDate > startDate`, and neither validates that the dates parse at all — `new Date("garbage")` silently produces `Invalid Date`, which Prisma will reject at the DB layer with an opaque error caught by the generic `catch (err) { return serverError(...) }`, not a clean 400.

### Concrete traps

- **The client-side refine uses `>=`, not `>`** (`period-form.tsx:20`: `new Date(v.endDate) >= new Date(v.startDate)`) — it currently *allows* a zero-length period (`endDate === startDate`). H4.3's server-side validation must decide explicitly whether to keep matching that (`>=`) or tighten to strictly `>` as the brief's wording implies — a mismatch between client and server here means the form accepts something the API then rejects, or vice versa. State the choice in the commit body.
- `period-form.tsx`'s default-values effect (`:50-64`) has **two branches** — `defaultValues` present (editing) at `:51-56` uses `toDateTimeLocal` on the existing period; the "else" branch (`:57-63`, new period) is the one H4.1 changes. Do not touch the editing branch.
- **Verified: the project's own `startDate`/`endDate` are bare `yyyy-MM-dd` strings, not datetimes.** `project-form.tsx` uses `<DateInput type="date" ...>` for both fields (`:229,242`), submits them unmodified (`handleSubmit`, `:150-160`, no `toISOString()` call), and `POST /api/projects` does `startDate: new Date(startDate)` on that bare string (`projects/route.ts:56-57`) — which `new Date()` parses as **UTC midnight**. The auto-created `"Hoofdperiode"` today inherits that same bare-date/UTC-midnight value for both its own `startDate` and `endDate` (`projects/route.ts:61-64`, no separate time component). H4.2's fix must decide explicitly how to construct `08:00`/`17:00` from that UTC-midnight project start date without re-introducing a UTC/Brussels offset bug — do not assume `new Date(startDate)` already sits at local midnight; verify the actual stored instant against Postgres, per the Time rule.
- `projects/[id]/periods/route.ts` and `periods/[id]/route.ts` both destructure `{ name, startDate, endDate }` with no zod schema at all today — H4.3 is the first zod validation either file has ever had; make sure the new schema's error messages stay in Dutch (`nl-BE`) to match the existing `badRequest("naam, startdatum en einddatum zijn verplicht")` convention.
- `period-form.tsx:68-71,100-106` (the out-of-range warning) is cosmetic and non-blocking today; H4.3 asks you to decide and state whether it becomes blocking — whichever you choose, it is a UI change and needs the `design` skill if the alert's presentation changes at all.

### Verification commands

```bash
npx tsc --noEmit
npm run lint
npm test
npm run dev
# create a project — confirm "Hoofdperiode" is a single day, not the full project span
# add a new period on an existing project — confirm it defaults to project start date, 08:00-17:00

curl -s -X POST localhost:3000/api/projects/1/periods -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","startDate":"2026-06-05T17:00:00.000Z","endDate":"2026-06-05T08:00:00.000Z"}'
# success: 400, not a 500 or a silently-created inverted period
curl -s -X POST localhost:3000/api/projects/1/periods -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","startDate":"not-a-date","endDate":"2026-06-05T17:00:00.000Z"}'
# success: 400
```

### Definition of done

- [ ] New periods (both the auto-created first one and any added afterwards) default to a single day, 08:00-17:00, not the full project span
- [ ] Existing projects/periods are provably untouched (no migration, no backfill)
- [ ] `POST /api/projects/[id]/periods` and `PATCH /api/periods/[id]` reject an inverted or unparseable range with 400
- [ ] The `>=` vs `>` decision (H4.3) is stated explicitly in the commit body and the client `.refine` matches the server rule
- [ ] The out-of-range-warning blocking/advisory decision is stated explicitly

**H4.1 — `fix(periods): default new periods to a single day`**
- `period-form.tsx:59-62`. Body must note the behaviour change: new periods no longer span the project.

**H4.2 — `fix(projects): create the first period as a single day`**
- `projects/route.ts:58-66`. Existing projects are untouched — no migration.

**H4.3 — `fix(api): validate period date ranges server-side`**
- `endDate > startDate` is currently only a client-side `.refine` (`period-form.tsx:20-23`). Add zod validation to `POST /api/projects/[id]/periods` and `PATCH /api/periods/[id]` — both today do raw `new Date(body.x)` with no validation (`src/app/api/periods/[id]/route.ts:13-19`).
- Decide and state whether the out-of-project-range warning becomes blocking; it is cosmetic today and does not disable submit (`period-form.tsx:68-71,100-106`). Recommendation: keep it advisory, but reject a period that does not overlap its project at all.

---

## J1 — Travel costs out of the subtotal `PO item 5`

**Branch:** `j1-travel-line` · **after Y1 (and after Y3.1 if split across workers)**

Decided (Q22): **subtotal = personeel + materiaal; travel as itemised lines below it; travel still inside the total; BTW over everything.**

⚠️ **Outstanding prerequisite (does not block this item):** the PO is confirming the Belgian VAT treatment of reiskosten with their accountant. J1 ships now regardless — but implement the treatment in **one place** (`projectCostSummary` plus a single BTW application site) so that if the accountant says travel should be VAT-exempt or excluded from the total, it is a one-line change and not a hunt. Do not scatter the rule across display components. This prerequisite must be resolved **before the first real invoice goes to a client** (phase 3), not before this commit. The PO is confirming the VAT treatment with their accountant, so keep the treatment in one place rather than scattering it.

Current state: `periodTravelCost` (`src/lib/pricing.ts:71-79`) is added inside `periodTotal` (`:130-131`) and `projectCostSummary().total` (`:113`). Travel has **no line** in the cost table — no `TravelCostRow` exists; it appears only as a rolled-up `Reiskosten: €X` when `> 0` (`src/components/cost-summary.tsx:42-49,76-81`). Individual entries live only in `person-travel-editor.tsx` on the Personen tab.

### Files to read before starting

- `src/lib/pricing.ts` (155 lines — already over the limit; see Y1's trap on this same file) — `projectCostSummary` (`:93-115`, **already returns `{ people, materials, travel, total }`** — read this closely, see the trap below) and `periodTotal` (`:117-132`, travel folded into the sum at `:130-131`).
- `src/components/cost-line-row.tsx` (115 lines) — `PersonCostRow` and `MaterialGroupCostRow`; the new `TravelCostRow` goes here, beside them.
- `src/components/cost-summary.tsx` (105 lines) — `PeriodSubtotals` (`:20-52`) and `CostSummary` (`:58-105`); both currently show travel as a rolled-up line, both need the subtotal line added.
- `src/components/project-costs-tab.tsx` (post-Y3.1 split — the per-period section, wherever it now lives) — `periodTotal(period)` at the (pre-split) line `:84`, the per-period header total.
- `src/app/(app)/projects/[id]/page.tsx` — `projectTotal(project.periods)` at `:59`, displayed at `:115`.
- `src/components/project-overview-tab.tsx` — `periodTotal(p)` at `:54`, per-period row total in the Overzicht tab.
- `src/lib/pricing.test.ts:257-281` — the `"travel costs"` describe block, in particular the test at `:269-280` that must be rewritten.
- `.plans/setup-travel-costs-design.md:54-61` — the design doc section that documents travel-in-the-total as intentional; J1.4 corrects it.

### Current behaviour

```ts
// src/lib/pricing.ts:93-115 (projectCostSummary — already has a travel bucket)
export function projectCostSummary(periods: Period[]): {
  people: number;
  materials: number;
  travel: number;
  total: number;
} {
  ...
  return {
    people,
    materials,
    travel,
    total: Math.round((people + materials + travel) * 100) / 100,
  };
}
```

```ts
// src/lib/pricing.ts:117-132 (periodTotal — travel folded into one lump sum)
export function periodTotal(period: Period): number {
  const days = periodDays(period);
  const flat = period.materials...
  const bundles = (period.bundleBookings ?? [])...
  const pers = period.people.reduce(...);
  const travel = periodTravelCost(period);
  return Math.round((flat + bundles + pers + travel) * 100) / 100;
}
```

```tsx
// src/components/cost-summary.tsx:76-81 (CostSummary — travel is a rollup, not a line item)
{travel > 0 && (
  <div className="flex justify-between gap-6 text-sm">
    <span className="text-muted-foreground">Reiskosten</span>
    <span className="tabular-nums">{formatEUR(travel)}</span>
  </div>
)}
```

```ts
// src/lib/pricing.test.ts:269-280 (the test that must be rewritten, not patched)
it("periodTotal and projectCostSummary include travel as its own bucket", () => {
  const person = makePerson(100, {
    travelCosts: [{ unitCost: 50, quantity: 3 }],
  });
  const period = makePeriod("2026-05-01", "2026-05-02", [], [person]);
  // 100 × 2 days + 50 × 3 trips = 350
  expect(periodTotal(period)).toBe(350);
  const summary = projectCostSummary([period]);
  expect(summary.travel).toBe(150);
  expect(summary.people).toBe(200);
  expect(summary.total).toBe(350);
});
```

### Every total/subtotal display site (must all agree after J1)

| File | Line(s) | What it shows today |
|---|---|---|
| `src/lib/pricing.ts` | `:93-115` (`projectCostSummary`), `:117-132` (`periodTotal`), `:134-138` (`projectTotal`) | The three aggregation functions everything downstream calls |
| `src/components/cost-summary.tsx` | `:59` (`projectCostSummary` call), `:76-81` (travel rollup), `:83-86` ("Subtotaal excl. BTW" — currently the travel-inclusive `total`), `:91` (`btwAmount(total)`), `:99` (`withBtw(total)`) | Project-level cost summary + BTW block |
| `src/components/cost-summary.tsx` | `:20-52` (`PeriodSubtotals`), travel span at `:42-49` | Per-period rollup line above each period's table |
| `src/components/project-costs-tab.tsx` | `:84` (`periodTotal(period)`, shown per period header) | Per-period header total |
| `src/app/(app)/projects/[id]/page.tsx` | `:59` (`projectTotal(project.periods)`), `:115` (displayed) | Project header "Totaal" badge |
| `src/components/project-overview-tab.tsx` | `:54` (`periodTotal(p)`, displayed per period row) | Overzicht tab period list |

### Concrete traps

- **`projectCostSummary` already returns `{ people, materials, travel, total }` today** (`pricing.ts:93-115`) — J1.1 is not adding a bucket, it is adding a **`subtotal`** field (`people + materials`, excluding travel) and changing what `total` means downstream in the UI (travel stays inside `total`, per Q22, but must now also be visible as `subtotal`). Read the current return shape carefully before assuming this function needs a bigger rewrite than it does.
- The label in `cost-summary.tsx:84` currently reads **"Subtotaal excl. BTW"** for what is actually the travel-inclusive grand total pre-BTW — once `subtotal` (people+materials only) exists as a distinct number, decide precisely which of `subtotal`/`total` each label in `CostSummary` refers to, or the UI will show two numbers both captioned "subtotaal".
- `pricing.ts` is already 155 lines (see Y1's trap) — this item is the second of the two commits sharing that budget problem; coordinate with whichever of Y1.2/J1.1 does the extraction (see Y1's traps) so the file is ≤150 lines by the end of this item, not just by the end of Y1.
- `cost-line-row.tsx` (115 lines) gains a new exported `TravelCostRow` in J1.2 — after Y1.4 already touched this file (materialLineCost swap), check the running line count before adding the new component; extract if it would cross 150.
- The rewritten `pricing.test.ts:269-280` test currently asserts `periodTotal(period) === 350` (100×2 days + 50×3 trips) — the **numeric expectation for `periodTotal` does not change** (travel still inside it per Q22); only the assertions about `projectCostSummary`'s shape change (a `subtotal` field appears, `summary.travel`/`summary.people`/`summary.total` keep their current meaning). Do not accidentally change `periodTotal`'s actual arithmetic while "fixing" the test.
- `setup-travel-costs-design.md:56-57` states `periodTotal includes travel` — that sentence stays **true** after J1 (Q22 keeps travel inside the total); only the doc's characterization of the *subtotal* needs correcting, plus adding the new itemised-line requirement. Don't over-correct the design doc into saying travel is excluded from the total, which would misstate Q22.

### Verification commands

```bash
npx tsc --noEmit
npm run lint
npm test -- src/lib/pricing.test.ts
npm test

npm run dev
# open a project with a person travel cost > 0 (Personen tab → PersonTravelEditor) and check:
# - Kosten tab shows a travel line item below the subtotal (not just a rolled-up "Reiskosten: €X")
# - the four total/subtotal sites in the table above all agree with each other and with the print view
```

### Definition of done

- [ ] `projectCostSummary` returns a distinct `subtotal` (`people + materials`) alongside the existing `travel`/`total`
- [ ] `TravelCostRow` renders each `PersonTravelCost` entry as `label · qty × unit price`, in both the Kosten tab and its print view
- [ ] All six display sites in the table above show mutually consistent figures for the same project
- [ ] `pricing.test.ts:269-280` is rewritten (not deleted) to assert the new `projectCostSummary` shape; `periodTotal`'s numeric behaviour is unchanged
- [ ] `.plans/setup-travel-costs-design.md:56-57` corrected without contradicting Q22 (travel stays inside the total)
- [ ] BTW still applies once, to the travel-inclusive total, from the single `BTW_RATE` constant
- [ ] Commit body states explicitly that displayed subtotals change (per the phase exit report requirement)
- [ ] `pricing.ts` ≤150 lines by the end of this item

**J1.1 — `fix(pricing): separate the subtotal from travel costs`**
- `projectCostSummary` returns `{ people, materials, subtotal, travel, total }` with `subtotal = people + materials` and `total = subtotal + travel`. Same split for the per-period figures.
- **Rewrite** `src/lib/pricing.test.ts:269-280` — the test is literally named *"periodTotal and projectCostSummary include travel as its own bucket"* and asserts the behaviour being removed. Replace it with assertions for the new shape; do not delete the coverage.
- Body must state that displayed subtotals change.

**J1.2 — `feat(costs): show travel costs as itemised lines`**
- Add a `TravelCostRow` beside `PersonCostRow`/`MaterialGroupCostRow` in `src/components/cost-line-row.tsx`, rendering each entry as `label · qty × unit price`. Place the lines below the subtotal in both the Kosten tab and its print view.
- The PO currently sees an unitemised lump — this is the visible half of the fix.

**J1.3 — `fix(costs): align every total with the new subtotal split`**
- Four display sites must agree: `src/app/(app)/projects/[id]/page.tsx:59,115`, `src/components/project-overview-tab.tsx:54`, `src/components/cost-summary.tsx:59,91,99`, `src/components/project-costs-tab.tsx:84`.
- BTW is applied once to the total (`cost-summary.tsx:59,91,99`) — keep it over everything per Q22, and keep the rate in the single existing constant so making it a setting later (J2b) is a one-line change.

**J1.4 — `docs: correct the travel-cost design doc`**
- `.plans/setup-travel-costs-design.md:56-57` documents travel-in-the-total as intentional. Update it so the design doc stops contradicting the code.

**Out of scope:** the invoice document (J2a), the BTW setting (J2b), per-line VAT (J2b).

---

## P1 — Container hardening

**Branch:** `p1-hardening` · skill: `cicd`

Verified: the `Dockerfile` has **no `USER` directive**, so the app container runs as **root**; `docker-compose.yml` has **no healthchecks**; `depends_on: db` is not health-gated, so the app can start before Postgres is ready and `docker-entrypoint.sh`'s `prisma migrate deploy` fails.

### Files to read before starting

- `Dockerfile` (30 lines) — the whole file, all three stages (`deps`, `builder`, `runner`).
- `docker-compose.yml` (20 lines) — the whole file, both services.
- `docker-entrypoint.sh` (17 lines) — the whole file; this is what `depends_on: condition: service_healthy` must actually protect.
- `src/proxy.ts:6` — `PUBLIC_PATHS = ["/login"]`, the one unauthenticated page-level route, relevant to picking an app healthcheck target.
- `src/app/api/auth/login/route.ts` — confirms only `POST` exists (no `GET`), so this route is not directly probeable with a plain `GET`/`wget` healthcheck.
- `.github/prompts/docker.prompt.md` — already corrected by Y4 (same phase) to describe the real single-container setup; re-read it after Y4 lands so the healthcheck example you add matches what that file now documents. If Y4 has not merged yet when you start P1, do not depend on its content — read the real `Dockerfile`/`docker-compose.yml` directly.

### Current behaviour

`Dockerfile` in full:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Prisma 7's config loader (@prisma/config) depends on `effect` and ~20 other
# packages not traced by Next.js standalone. Copy full builder node_modules —
# the standalone traced set is a subset so overwriting is safe.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
# Entrypoint handles both fresh DBs (apply migration) and existing DBs that
# predate migration history (baseline 0001_init then deploy).
CMD ["./docker-entrypoint.sh"]
```

No `USER` instruction anywhere — every `COPY` and the final `CMD` run as the image default, `root`.

`docker-compose.yml` in full:

```yaml
services:
  db:
    image: postgres:15
    restart: always
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    image: ghcr.io/jenteverbruggen-boop/rentflow2.0:latest
    restart: always
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - db

volumes:
  pgdata:
```

`depends_on: - db` (short form) only waits for the `db` **container to start**, not for Postgres inside it to accept connections — no `healthcheck:` block exists on either service, so there is nothing a `condition: service_healthy` could reference yet.

`docker-entrypoint.sh` in full:

```sh
#!/bin/sh
set -e

PRISMA="node node_modules/prisma/build/index.js"

# Try a normal migrate deploy first (works for fresh DBs and for DBs that
# already have a migration history). If it fails — most likely because the
# tables already exist from a pre-migration deployment — resolve the baseline
# migration as "already applied" and retry; that is a no-op from that point on.
if ! $PRISMA migrate deploy 2>&1; then
  echo "migrate deploy failed — attempting to baseline existing schema as 0001_init"
  $PRISMA migrate resolve --applied 0001_init
  $PRISMA migrate deploy
fi

exec node server.js
```

This is exactly what races Postgres on a cold start: if `db`'s container has started but `postgres` inside it isn't accepting connections yet, `migrate deploy` fails with a connection error — which this script's fallback logic misinterprets as "pre-existing schema needing a baseline", not "DB not ready yet", so the `migrate resolve --applied 0001_init` branch can fire incorrectly.

### Concrete traps

- **No health endpoint exists in the app** (`find src/app/api -iname "*health*"` returns nothing). `POST /api/auth/login` is the only unauthenticated API route family, and it only implements `POST` (`src/app/api/auth/login/route.ts` has no `GET` export) — a plain `GET`/`wget` probe against it gets a 405, which is a "the process is alive" signal at best, not a true readiness check. The cheapest **real** page-level probe is `GET /login` (exempted from the auth redirect by `src/proxy.ts:6`, `PUBLIC_PATHS = ["/login"]`) — this returns 200 once the Next.js server is actually serving requests, without needing a valid session or touching the DB. Use that rather than adding a new `/api/health` route (out of scope this item).
- `docker-entrypoint.sh`'s fallback logic (baseline-then-retry) means a **failed healthcheck due to Postgres not being ready yet** could, in the worst case, race with the baseline-resolve branch in a way that was never designed for a not-yet-up DB. Health-gating `depends_on` on `db` (P1.2) removes this risk at the source — do not try to "fix" the entrypoint script itself in this item, gate the dependency instead.
- The `node:22-alpine` base image ships a built-in `node` user/group (uid 1000) — confirm the copied files under `/app` are readable/executable by that user (`COPY --chown=node:node` on each `COPY --from=builder` line, or a single `chown -R` before switching `USER`) **before** adding `USER node`, or the container will fail to start with a permission error on `docker-entrypoint.sh` or on writing anything under `/app` at runtime.
- `docker-compose.yml`'s `app` service has **no volume** (verified — only `db` has `pgdata`) — a non-root `node` user needs no extra writable volume for this app (no local file writes at runtime), but double check nothing in `docker-entrypoint.sh` or the Prisma migrate step tries to write inside `/app` (e.g. a lockfile) that would need write permission beyond what `COPY --chown` grants.
- `pg_isready` is the standard `postgres:15` image's own healthcheck tool — it needs no extra install; the `app` healthcheck needs `wget` or `curl` available in `node:22-alpine` (Alpine ships neither by default in some minimal variants — verify with `docker compose exec app which wget` after building, and `apk add --no-cache wget` in the runner stage if it's missing, which itself must not push the image past whatever size/layer conventions the `cicd` skill sets).

### Verification commands

```bash
docker compose build app
docker compose up -d
docker compose exec app whoami
# success: prints "node", not "root"

docker compose ps
# success: both "db" and "app" show a "healthy" status, not just "running"

# Cold-start race test — remove everything and start fresh
docker compose down -v
docker compose up -d
docker compose ps
docker compose logs app | tail -50
# success: "app" does not attempt `prisma migrate deploy` until "db" reports healthy;
# no connection-refused error in the app logs on a clean cold start
```

### Definition of done

- [ ] `Dockerfile`'s runner stage ends with `USER node` (or equivalent), after the necessary `COPY --chown`/`chown` steps
- [ ] `docker compose exec app whoami` prints `node`
- [ ] `db` has a `pg_isready`-based healthcheck; `app` has an HTTP-based healthcheck against `/login` (or another justified cheap route — state the choice)
- [ ] `app`'s `depends_on` uses `condition: service_healthy` against `db`
- [ ] `docker compose ps` shows both services healthy after a cold `docker compose down -v && docker compose up -d`
- [ ] No new `/api/health` route was added (out of scope) unless explicitly justified and stated otherwise in the commit body

**P1.1 — `fix(docker): run the app as a non-root user`**
- The `node:22-alpine` base already provides a `node` user. Add `USER node` in the runner stage, and make sure the copied `.next/standalone` output and `docker-entrypoint.sh` are readable/executable by it (`chown` on copy, or `COPY --chown=node:node`).
- **Verify:** `docker compose up` starts, and `docker compose exec app whoami` prints `node`.

**P1.2 — `fix(docker): add healthchecks and gate the app on a healthy database`**
- Healthcheck on `db` (`pg_isready`) and on `app` (an HTTP probe — check whether a health endpoint exists; if not, probe an existing cheap route rather than adding a new one in this phase).
- `depends_on: db: condition: service_healthy`.
- **Verify:** a cold `docker compose up` no longer races Postgres; `docker compose ps` shows both healthy.

**Out of scope:** backups (out of scope entirely — the PO has a verified secondary flow), monitoring/alerting, resource limits.

---

## Phase 0 exit report

The worker(s) finishing this phase report:

1. Branch and commit list per item.
2. **The Postgres verification output for Y1.3** — the actual `curl | jq` result, or an explicit statement that Postgres could not be run.
3. Which recurrence guard was chosen in Y1.5 and why.
4. Confirmation that displayed money figures changed (Y1) and that subtotals changed (J1) — the PO must expect this.
5. For the PO to retest before phase 2: book yourself 08:00–17:00 on one project and 18:00–23:00 on another, same day (H3 + H4); check a project's Kosten tab shows travel as separate lines outside the subtotal (J1).
