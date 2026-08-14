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

Follow the established pattern: one child component per section, composed in the parent (see how `material-detail-pane.tsx` already delegates to `MaterialSummaryGrid`, `MaterialCodes`, `MaterialStockList`, `BundleComponentEditor`, `BundleStockSummary`).

**Y3.1 — `refactor(costs): extract cost tab sections into components`**
**Y3.2 — `refactor(planning): extract week grid and project list from the planning page`**
- Pull the inline 7-column grid (`:94-129`) and the "alle projecten deze week" list (`:131-170`) into `planning-week-grid.tsx` and `planning-week-list.tsx`. Leave the `useState(new Date())` cursor in the page — I1 replaces it with URL state.
**Y3.3 — `refactor(bookings): split the person split editor`**
- 230 lines with two panes, grouping logic and mutations. Extract the available pane, the assigned pane and the grouping helpers. Keep the `.slice(0, 10)` range bug **as-is** — H3 fixes it deliberately, and mixing the two makes both unreviewable.
**Y3.4 — `refactor(projects): extract project detail header and tab shell`**
**Y3.5 — `refactor(materials): extract detail pane sections`**

Each commit: **verify** `tsc` + `lint` + `npm test` green, and click through the affected screen to confirm it is visually identical.

**Out of scope:** renaming props, changing query keys, "improving" any logic you move.

---

## Y4 — Make the docs match reality

**Branch:** `y4-doc-drift`

Verified drift: `README.md:31,142-163` claims the image comes from Docker Hub, but `docker-compose.yml:10` and `.github/workflows/release.yml` use `ghcr.io/jenteverbruggen-boop/rentflow2.0`. `docs/docker-compose.md` (254 lines) documents a **three-service backend/frontend/nginx stack that does not exist**, built by a `builds.yml` workflow that does not exist. `.github/prompts/docker.prompt.md` prescribes the same phantom split and `node:20-alpine` (actual: `node:22-alpine`).

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

**Y5.1 — `feat(config): validate DATABASE_URL and JWT_SECRET at startup`**
- `src/lib/env.ts` with a zod schema (`DATABASE_URL` non-empty, `JWT_SECRET` min length — pick a sane floor like 16 chars and state it), exporting a parsed object.
- Import from `src/lib/prisma.ts` and `src/lib/auth.ts`.
- **Must stay Edge-safe** for `src/proxy.ts` — no Node built-ins, no `zod` import if it drags in anything Node-only (verify the Edge build actually compiles: `npm run build`).
- **Verify:** unset `JWT_SECRET` and confirm one clear error at boot rather than a confusing downstream failure; both runtimes still build.

---

## H3 — Fix the availability picker window `PO item 1, partial`

**Branch:** `h3-availability-window` · **after Y3.3**

`src/components/person-split-editor.tsx:28-29` (and `material-split-editor.tsx:43-44`) truncate the period bounds with `.slice(0, 10)`. Date-only strings parse as **UTC midnight**, so for a single-day period `from === to` → a zero-width window → the overlap test (`src/lib/availability.ts:92`, strict `lt`/`gt`) matches nothing → **everyone reads "Beschikbaar"** (`:144`) with the add button enabled (`:150`), right up until the server returns 409 (`src/app/api/periods/[id]/people/route.ts:37-41`). On a multi-day period it drops the last day's daytime instead. This is the "it says free but won't let me book" complaint.

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

Decided (Q22): **subtotal = personeel + materiaal; travel as itemised lines below it; travel still inside the total; BTW over everything.** The PO is confirming the VAT treatment with their accountant, so keep the treatment in one place rather than scattering it.

Current state: `periodTravelCost` (`src/lib/pricing.ts:71-79`) is added inside `periodTotal` (`:130-131`) and `projectCostSummary().total` (`:113`). Travel has **no line** in the cost table — no `TravelCostRow` exists; it appears only as a rolled-up `Reiskosten: €X` when `> 0` (`src/components/cost-summary.tsx:42-49,76-81`). Individual entries live only in `person-travel-editor.tsx` on the Personen tab.

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
