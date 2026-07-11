# Phase 3 — Codes, RBAC, links, cost split, bundle design

Order: **p3-ddl first (one worker)**, then E3 / F1 / F3 / B6 / E6-design in parallel. B6 waits until B7 (phase 2) merged — both touch `src/lib/pricing.ts`. Read `00-README.md` first.

---

## p3-ddl — DDL commit 2 (M, lands first)

Both schema files + one Postgres migration (Z1 recipe) + seed.ts:

1. `Material.code String? @unique` — **migration order is load-bearing** (a failed unique index bricks `prisma migrate deploy` at prod startup):
   a. `ALTER TABLE ... ADD COLUMN code TEXT;` (no index yet)
   b. Backfill from `Material.notes` — codes live in the notes text as `\b\d{3,4}-\d{3}\b` (e.g. `0401-006`); take the first match.
   c. **Dedupe deterministically** — real data has `9998-902` twice plus malformed codes (`898-…`, `0000-…`): lowest `id` keeps its code; each later duplicate gets the next free 3-digit sequence within its 4-digit prefix. Malformed-but-unique codes are kept (user data).
   d. Only then `CREATE UNIQUE INDEX`.
2. `User.personId Int? @unique` + relation to `Person`.
3. `User.role` default `"user"` → `"PLANNER"` (`prisma/schema.prisma:15` + dev schema) and data migration `UPDATE "User" SET role='ADMIN' WHERE role='admin'; UPDATE "User" SET role='PLANNER' WHERE role='user';`
4. `seed.ts`: write `code` directly per material (same extraction+dedupe applied to seed data), seed users with `ADMIN`/`PLANNER`.
5. Regenerate clients; extend `src/types/index.ts` (`code` on Material, `personId` on User, `type Role = "ADMIN" | "PLANNER" | "VIEWER"`).

**Accept:** migration applies on a Postgres containing the duplicate-code data; unique index holds; seed clean; tsc passes. **Out of scope:** routes/UI; E6 models (own phase-4 DDL).

---

## E3 — Auto-generated material codes (M)

Decisions: format `{category.prefix}01-{3-digit seq}` (subgroup fixed `01` in v1); code does **not** change when the material changes category; manually editable; unique.
1. Pure generator `src/lib/material-code.ts`: `nextCode(prefix: string, existingCodes: string[]): string` — scan `^{prefix}01-(\d{3})$` matches, next = max+1 zero-padded; ignore malformed; seq >999 → throw (caught → Dutch error **"Geen vrije code meer in deze categorie"**). Vitest: gaps, none existing (→ `…-001`), malformed ignored, overflow.
2. Materials POST route: if no `code` supplied and the material has a category → generate server-side (fetch existing codes for the prefix inside the same transaction to dodge races); no category → leave null (prints as TEMP later).
3. UI: code field in `material-form.tsx` (placeholder **"Wordt automatisch gegenereerd"**) + inline-editable in the detail pane (E2 component). Unique violation (P2002) → **"Code bestaat al"** via error helper.

**Accept:** new Meubilair material gets next free `04xx01-…`-style code from its prefix; manual override works; duplicate rejected with Dutch error.

---

## F1 — RBAC: ADMIN / PLANNER / VIEWER (L, auth-critical)

Decisions: three roles; public registration **disabled** (admin creates accounts); rights are role-based only.

Current holes (verified): JWT payload is `{id, email, name}` (`src/lib/auth.ts:5-9`) — no role; `/api/auth/register` is public; **any** authenticated user can PATCH any user's role (`src/app/api/users/[id]/route.ts:22-54`).

1. **Token:** add `role` to `TokenPayload`, `signToken`, and the login route. `requireRole(...roles: Role[])` in `src/lib/api-auth.ts`: verify token → if payload lacks `role` (pre-migration cookie, ≤7-day tail) fall back to one DB lookup by id → not allowed → 403 helper. Role checks stay in **Node** handlers/pages — never in `proxy.ts` (Edge: no DB fallback for stale tokens).
2. **Matrix v1** (server-authoritative; UI hiding is cosmetic):
   | Action | Roles |
   |---|---|
   | GET anything | any authenticated |
   | POST/PUT/PATCH/DELETE projects, periods, bookings, people, materials, clients, locations, functions, categories | ADMIN, PLANNER |
   | `/api/users/*`, `PUT /api/settings*`, `/settings`, `/users` pages | ADMIN |
   Apply `requireRole` accordingly in every mutating handler (sweep `src/app/api/`).
3. **No self-promotion:** users PATCH rejects `role` changes where `targetId === token.id`.
4. **Close holes:** `/api/auth/register` → 404 via helper (keep file, return early); remove the register link from `src/app/(auth)/login/page.tsx`.
5. **Admin bootstrap (prod):** on startup seed-if-missing an admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env (small script invoked from the Docker CMD chain after `migrate deploy` — `cicd` skill; document in README/compose).
6. **UI:** sidebar hides Gebruikers/Instellingen for non-admins — `sidebar.tsx` is a Server Component: read the cookie with `verifyToken` directly. Mutation buttons hidden for VIEWER where cheap (server still enforces).
7. **Changelog note (required):** pre-F1, `"user"` accounts could manage users; post-F1 PLANNER cannot — intended ability loss.

**Tests:** migrated `"user"`→PLANNER: 200 POST /api/projects, 403 PATCH /api/users/[id]; VIEWER: 403 POST /api/projects, 200 GETs; register → 404; roleless stale token resolves role via DB fallback.

**Accept:** matrix enforced; register gone; bootstrap documented; tests green.

---

## F3 — Link Person ↔ User (S)

Decision: simple account link `User.personId` (column in p3-ddl); rights stay role-based — linking changes **nothing** about permissions. Groundwork for later "eigen planning/documenten" views (out of scope).
1. Users PUT (ADMIN-only per F1) accepts `personId: number|null`; P2002 → **"Deze persoon is al gekoppeld aan een account"**.
2. User form: optional person combobox (reuse `entity-combobox.tsx`, label **"Gekoppelde persoon"**, clearable); users table shows the linked person's name.

**Accept:** link/unlink works; one person ↔ max one account; permissions unchanged.

---

## B6 — Cost breakdown: materialen vs personen (M — after B7 merged)

`src/components/project-costs-tab.tsx` is ~154 lines — extract subcomponents (`cost-period-section.tsx`, `cost-summary.tsx`) to stay under 150.
1. Extend `src/lib/pricing.ts` with pure per-kind helpers: `periodPeopleCost(period)`, `periodMaterialsCost(period)`, `projectCostSummary(periods) → {people, materials, total}` — reuse the existing snapshot × days × quantity formulas unchanged.
2. UI: per period two subtotal rows (**"Personen"**, **"Materialen"**) + period **"Subtotaal"**; project level: both kinds + **"Totaal project"**. Print view (window.print + print CSS) shows the same split.
3. Vitest: only-people period, only-materials, mixed, empty; totals equal the sum of the old undivided totals (regression).

**Accept:** tab + print show per-kind subtotals per period and per project; tests green.

---

## E6-design — Bundles design doc (M — human approval gate, no implementation)

Deliverable: **`.plans/e6-bundles-design.md`**, presented for approval. Implementation is `04-phase4.md § E6-impl`.

Decided constraints the design MUST satisfy:
- A recipe model `MaterialComponent {parentId, childId, quantity}` alone is **insufficient**: virtual bundles have no StockItems (no price-snapshot row) and nothing ties component `PeriodStockItem` rows to one bundle *instance* (pakbon can't nest; unbook can't find siblings). Add a booking-side model — e.g. `PeriodBundleBooking {id, periodId, materialId, dayPriceSnapshot, quantity}` + nullable `PeriodStockItem.bundleBookingId` (names may be refined). Requirements: price snapshotted per booking; unbook-whole-instance; pakbon nesting derivable; flat bookings untouched.
- Booking becomes an **interactive `prisma.$transaction`** with the availability re-check **inside** — today availability is checked before the transaction (`src/app/api/periods/[id]/materials/route.ts:27-62`, TOCTOU race ×N components). Note SQLite vs Postgres isolation differences in the test plan.
- Bundle availability = min over components; back-to-back at the boundary does not conflict (strict comparison, per B7).
- Pricing (decided): bundle price = **sum of component day prices with nullable manual override** (null = live sum); components print/count as €0 inside a set.
- UI: bundle definition in materials UI (bundle flag vs separate model — design argues the choice) with a component editor (material + quantity).

Required doc structure: data model (both schemas) · booking algorithm pseudocode with transaction boundary marked · unbooking · availability · pricing · UI surfaces · migration/seed impact · test plan (edge cases incl. exhausted component, concurrent booking) · non-goals.

**Accept:** doc committed and explicitly presented for human approval. **Do not implement anything.**
