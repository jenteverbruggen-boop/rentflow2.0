# Phase 1 — Item 8 in full: custom roles, module matrix, own-data scoping

> Read `00-README.md` first. Source decisions: `.plans/2026-08-po-feedback-round2.md` (Q37, Q38, Q40, C1).
> **v2 — one adversarial review round folded in (13 findings, 4 blockers).**
> 5 items, ~23 commits. **The PO's first priority.** Largest workstream in the roadmap.
> **Gate to start:** phase 0 merged and reviewed · `.plans/own-data-scoping-design.md` approved (blocks N5 only, so N1–N4 may start first).

## Why this phase is isolated

**N2 rewrites all 40 route files.** No other work may add or edit a route while it runs. N4 adds `/api/auth/me`, so it is ordered *after* N2 rather than beside it.

```
N1 (model + registry)  ──►  N2 (sweep, owns every route file)  ──►  N4 (guards + hook)  ──►  N5 (scoping)
                       └─►  N3 (roles + matrix UI, parallel with N2)
```

**This phase has TWO schema-changing commits, by necessity:** N1.2 *adds* `Role`/`RolePermission`/`User.roleId`, and N4.3 *drops* the legacy `User.role` column once nothing reads it. They cannot be merged into one — the column must survive while `requireRole` and the sidebar decode are still live. `00-README.md`'s "one DDL commit per phase" rule is therefore deliberately relaxed here; both are still owned by one worker and each lands alone.

## Decided design (do not re-litigate)

| Decision | Value |
|---|---|
| Roles | **Admin-creatable custom roles.** ADMIN/PLANNER/VIEWER seeded as `isSystem` (renameable, undeletable). |
| Access levels | **Four:** `geen` / `lezen` / `wijzigen` / `verwijderen`. `verwijderen` implies `wijzigen` implies `lezen`. |
| Modules | Projecten · Planning · Personen · Materialen · Klanten · Locaties · Kosten/Facturen · Cijfers · Gebruikers · Instellingen |
| Rollout | **Matrix seeded fully open** — nobody loses access on deployment. The PO tightens it themselves. |
| Scoping | Per-role `scope`: `all` or `own`. A scoped user sees only projects/periods they are booked on. |
| Source of truth | Modules live in **code**; the DB stores only who may do what. |

⚠️ **Accepted risk, and N3.3 is its mitigation.** Because the matrix ships fully open, the security hole the PO raised is *not* closed by deploying this phase — it closes when they configure it. N3.3 is therefore **not optional**.

## 🔴 The hard problem this phase must solve: commercial data is everywhere

The PO's whole point is that a freelancer should not see rates. But money is **not** confined to the Kosten/Facturen module — it is embedded in the ordinary Projecten, Personen and Materialen payloads. Verified:

| Where | Evidence |
|---|---|
| The whole project tree | `src/lib/project-include.ts:3-31` nests `materialPrices`, `personPrices`, and per booking `dayPriceSnapshot`, `discountPct`, `discountAmount`, plus `travelCosts.unitCost`. Returned unfiltered by `src/app/api/projects/route.ts:18-21` and `src/app/api/projects/[id]/route.ts:20-23`. |
| People | `Person.dayPrice` (`prisma/schema.prisma:137`) returned by `GET /api/people` (`src/app/api/people/route.ts:15-19`) and writable via `PUT /api/people/[id]` (`[id]/route.ts:31-38`). |
| Materials | `Material.dayPrice`, `setupCost`, `bundlePriceOverride` (`prisma/schema.prisma:152-155`) returned and writable under Materialen. |
| Functions (phase 2) | L1 adds `dayRate`/`hourRate` to `Function`. |

**Consequence:** guarding routes by module alone does **not** hide rates. Under N3.3's recommended defaults a PLANNER has `Projecten: wijzigen` + `Kosten/Facturen: geen` and would still receive every price, discount and travel cost in the company from `GET /api/projects`.

**Therefore N2.1 builds a field-redaction layer before any route guard lands**, and it applies to projects, people and materials — not just to the two booking PATCH routes.

---

## N1 — Roles, module registry, permission model `DDL`

**Branch:** `n1-permission-model`

### Current state (verified 2026-08-14)

- `requireRole(...roles: string[])` at `src/lib/api-auth.ts:13-25` is the only RBAC primitive: a variadic string allow-list with a DB fallback when the JWT lacks a role. It re-queries Prisma on every call with **no caching**.
- `role` **is** in the JWT (`src/lib/auth.ts:9`), signed at `src/app/api/auth/login/route.ts:31` and echoed in the response body at `:39`. TTL **7 days** (`auth.ts:13`).
- `export type Role = "ADMIN" | "PLANNER" | "VIEWER"` (`src/types/index.ts:8`) is declared and **imported nowhere**.
- `User.role String @default("PLANNER")` (`prisma/schema.prisma:15`). No zod validation — `POST /api/users` and `PATCH /api/users/[id]` persist any string.
- `src/components/user-form.tsx` **hardcodes the three roles** as `SelectItem`s (`:62-64`) and posts a `role` **string** (`createSchema`/`editSchema` `:32-44`, defaults at `:89,93,100`).
- **No module, permission, ability or feature-flag concept exists.** Greenfield.
- Cosmetic bug: `src/app/(app)/users/page.tsx:65` compares `u.role === "admin"` (lower case) against always-upper-case values, so that badge variant never applies.

### Commits

**N1.1 — `feat(auth): add the module registry`**
- New `src/lib/modules.ts`: `MODULES` const of `{ key, label, nav? }` for the ten modules; `ModuleKey` and `AccessLevel` TS unions; zod schemas; a helper `satisfies(held, required)` encoding `verwijderen > wijzigen > lezen > geen`.
- Types go in `src/types/index.ts` per convention.
- Pure addition — nothing imports it yet. **Verify:** `tsc` + unit tests on `satisfies` (each level satisfies those below; `geen` satisfies nothing).

**Files to read before starting:**
- `src/types/index.ts:1-17` — confirms the file's existing pattern (`ProjectStatus`, `Role` unions sit at the top, plain string literal unions, no zod here) that `ModuleKey`/`AccessLevel` must follow; zod schemas themselves stay in `modules.ts`, not this file.
- `src/lib/api-auth.ts` (52 lines, whole file) — the response helpers (`forbidden`, `badRequest`, `unauthorized`) that N1.3's `requireModule` will call; read now because `satisfies()`'s return shape (boolean, not a thrown error) is what makes that composition trivial later.
- `prisma/schema.prisma` (whole file, 250 lines) — confirms the ten modules (Projecten, Planning, Personen, Materialen, Klanten, Locaties, Kosten/Facturen, Cijfers, Gebruikers, Instellingen) map onto existing models with no eleventh concept hiding (e.g. `PersonDocument`/`StockItem` are sub-resources of Personen/Materialen, not separate modules).

**Current behaviour (verified 2026-08-15):**
- Confirmed greenfield: `grep -rn "requireModule\|ModuleKey\|AccessLevel" src/` and `ls src/lib/modules.ts src/app/api/roles` both return nothing — no route, type, or directory pre-exists for any part of N1.1–N1.3.
- The only structural precedent is `export type Role = "ADMIN" | "PLANNER" | "VIEWER"` (`src/types/index.ts:8`), a plain literal union with no zod schema anywhere — `ModuleKey`/`AccessLevel` should sit beside it in the same style, not introduce a new pattern (e.g. a const object with `as const`) unless the zod schema needs it.

**Concrete traps:**
- Cijfers (K1, phase 3) and the two schema-only modules have **no route file today** — `MODULES` must still declare all ten now (rollout decision C1 requires the matrix to cover modules that don't have working UI yet), or N3.2's matrix table renders nine columns and phase 3 needs a second schema-adjacent change to add a tenth.
- `satisfies(held, required)` must implement a **total order** (`verwijderen > wijzigen > lezen > geen`), not set membership — the riskiest bug is an implementation that treats `geen` as satisfying nothing *including itself*, which would make `requireModule(module, "geen")` (a call nobody should make, but also one nothing should crash on) throw instead of returning true.
- Zod schemas must be `z.enum([...])`, not `z.string()` — a permissive schema here silently reopens the exact hole N1.4 is supposed to close for role/module assignment.

**Verification commands:**
```bash
npx tsc --noEmit
npm test -- modules
```
Success: a new `src/lib/modules.test.ts` asserts all 4×4 level combinations (each level satisfies itself and everything strictly below it; nothing satisfies a level above it) and that `MODULES` has exactly ten entries with the Dutch labels from the decided-design table (`02-phase1.md:25`) verbatim — an English label is a silent regression `tsc` cannot catch.

**Definition of done:**
- [ ] `src/lib/modules.ts` exports `MODULES` (10 entries) and `satisfies`; zero importers outside its own test (grep confirms)
- [ ] `ModuleKey`/`AccessLevel` added to `src/types/index.ts`; zod schemas stay in `modules.ts`
- [ ] `satisfies` unit-tested for all 16 level-pair combinations, not just the happy path
- [ ] `npx tsc --noEmit` and `npm test` clean; no other file touched

**N1.2 — `feat(db): add Role and RolePermission models`** ← **schema commit 1 of 2 in this phase; lands alone, first**
- Both `prisma/schema.prisma` and `prisma/schema.dev.prisma`:
  - `Role { id, key String @unique, label String, isSystem Boolean @default(false), scope String @default("all"), permissions RolePermission[], users User[] }`
  - `RolePermission { id, roleId Int, module String, access String, @@unique([roleId, module]) }`
  - `User.roleId Int?` + relation. **Keep `User.role String`** — dropping it now breaks every reader mid-phase. It is retired in N4.3.
- Migration (per `CLAUDE.md`'s `prisma migrate diff` recipe) must:
  1. Create the three system roles with `isSystem = true`, `scope = "all"`.
  2. Grant **every role `verwijderen` on every module** — the fully-open seed (C1).
  3. Backfill `User.roleId` by matching `User.role`; unmatched → the `PLANNER` role, and **log each unmatched user**.
- `prisma/seed.ts`: the roles, the open matrix, and `roleId` on both seeded users.
- **No behaviour change** — nothing reads the new tables yet.
- **Verify — and note the trap:** `npm run db:dev:reset` runs `prisma db push --force-reset` (`package.json:13`), which **wipes and recreates**, so it can never exercise the backfill. To actually test it: bring up the compose Postgres, apply migrations *up to the previous one*, insert users with `role` values including one deliberately invalid string, then run `prisma migrate deploy` and assert every user has a sane `roleId` and the invalid one was logged.

**Files to read before starting:**
- `prisma/schema.prisma:10-19` (`User`) and the whole file (250 lines) — every existing model's relation style (`@relation(fields: [...], references: [...])`, `onDelete: Cascade` used everywhere except `User.person`) so `Role`/`RolePermission` match house style.
- `prisma/schema.dev.prisma:10-19` — the SQLite mirror; confirms money fields are `Float` there vs `Decimal` in Postgres (`schema.dev.prisma:97` vs `schema.prisma:97`), but `Role`/`RolePermission`/`roleId` carry no money, so both files get **identical** new blocks — the Decimal/Float split does not apply here, which is easy to over-think given how much of this repo's convention text is about that split.
- `prisma/seed.ts:272-282` — the only two seeded users today: `admin@rentflow.dev` (`role: "ADMIN"`) and `jan@rentflow.dev` (`role: "PLANNER"`). **No `VIEWER` user is seeded.** This matters for N1.2's backfill test and for N1.5/N3's manual testing — a VIEWER-equivalent role has no real account to assign it to until someone creates one by hand.
- `CLAUDE.md`'s "Authoring Postgres migrations" section — the exact `prisma migrate diff` recipe this commit must follow, including the "no shadow DB" constraint.

**Current behaviour (verified 2026-08-15):**
- `docker-compose.yml`'s `db` service (lines 2–7) has **no `ports:` mapping** — only the `app` service publishes a port (`3000:3000`, line 12). `CLAUDE.md`'s migration recipe assumes `psql`/Prisma can reach `postgresql://rentflow:rentflow@localhost:5432/rentflow`, which will **not** resolve against the committed compose file as-is.
- `.env.example` confirms the intended connection string uses host `db` (the compose service name) for in-network access, and `localhost` only "outside Docker" — i.e. the recipe's `localhost:5432` implicitly assumes a port has been published, which today it has not.

**Concrete traps:**
- **Fix the port gap before following `CLAUDE.md`'s recipe literally**, or the `docker compose run --rm app sh -c "npx prisma migrate deploy"` validation step in step 3 works (it runs inside the Docker network) but the manual backfill test in this commit's own "note the trap" (connecting from the host to insert test users) will not, unless you either add a temporary `ports: ["5432:5432"]` override or run the test-user inserts from inside the `db`/`app` container instead of the host.
- The migration's step 3 ("Backfill `User.roleId` by matching `User.role`... unmatched → the `PLANNER` role") needs a **case-sensitive or case-insensitive match** decision against `User.role` — state it explicitly in the migration or commit body, since nothing in the current schema constrains `role` to upper case (it is `String @default("PLANNER")`, `schema.prisma:15`, no check constraint).
- `prisma/seed.ts` currently seeds no `VIEWER` account (`:281-282`) — if the seed script's new role-assignment block only wires `roleId` for the two existing users, a manual VIEWER test account created afterwards will get whatever the "no role matched" fallback does, not a clean VIEWER assignment. Decide whether to add a third seeded user or explicitly document that VIEWER must be tested by hand.
- **`npm run db:dev:reset` cannot exercise this migration at all** (it force-resets, per the existing "Verify" note above) — do not accept a green `db:dev:reset` as proof the backfill works; only the Postgres-based manual recipe proves it.

**Verification commands:**
```bash
docker compose up -d db
# temporarily expose the port for the manual test, e.g.:
#   docker compose run --rm -p 5432:5432 db   (or add a local-only ports override)
DATABASE_URL="postgresql://rentflow:rentflow@localhost:5432/rentflow" npx prisma migrate deploy --schema=prisma/schema.prisma  # up to the commit *before* this one
# insert test users directly (psql or a one-off script), including one with role="bogus"
DATABASE_URL="postgresql://rentflow:rentflow@localhost:5432/rentflow" npx prisma migrate deploy --schema=prisma/schema.prisma  # now including this migration
# assert: every user has a non-null roleId; the "bogus"-role user landed on PLANNER and was logged
npx tsc --noEmit
```
Success: every existing user row (seeded and hand-inserted) has a sane `roleId` after the migration; the deliberately-invalid role string is both mapped to `PLANNER` and printed in the migration/log output, not silently dropped.

**Definition of done:**
- [ ] `Role`, `RolePermission`, `User.roleId` added to **both** schema files, identical shape (no Decimal/Float split needed — no money fields here)
- [ ] Migration creates the three system roles `isSystem = true`, grants `verwijderen` on every module to every role (C1's fully-open seed)
- [ ] Migration backfills `roleId` from `role`, logs unmatched values, defaults them to `PLANNER`
- [ ] `prisma/seed.ts` updated with the roles, the open matrix, and `roleId` on both seeded users
- [ ] Manual Postgres backfill test run and passed (not just `db:dev:reset`)
- [ ] `npx tsc --noEmit` clean; no route or component reads the new tables yet (grep confirms)

**N1.3 — `feat(auth): resolve module permissions per request`**
- `requireModule(module: ModuleKey, level: AccessLevel)` in `src/lib/api-auth.ts`, beside the existing `requireRole` (leave that until N2 has removed its last caller).
- **Resolve from the database on every call. Do not add a cache.** The existing `requireRole` (`api-auth.ts:13-25`) already re-queries per call and that is the right pattern here: it is one indexed lookup, and a matrix change must apply on the *next request*, not after re-login (7-day tokens). **Do not use React `cache()`** — route handlers are not part of a Server Component render pass, so it does not reliably scope per request and risks serving stale permissions across requests. If a handler needs the permission set more than once, resolve it once at the top and pass it down within that request.
- The JWT keeps carrying the role for nav rendering only; never trust it for authorisation.
- Return `forbidden()` (`api-auth.ts:31-36`). Keep the `.catch(() => null)` call pattern so route code stays uniform.
- **Verify:** unit tests — each level satisfies those below; unknown module fails closed; user with no role fails closed; downgrading a role blocks the *next* call with no re-login.

**Files to read before starting:**
- `src/lib/api-auth.ts` (52 lines, whole file) — `requireAuth` (`:6-11`) is what `requireModule` calls first; `requireRole` (`:13-25`) is the pattern to mirror (re-query per call, DB fallback when the JWT lacks what's needed) — but note `requireRole`'s fallback is "JWT lacks `role`", whereas `requireModule` must **never** trust a JWT-carried permission set at all (only the role/id for nav, per N1.3's own text above).
- `src/lib/prisma.ts` (whole file, ~17 lines) — confirms the `globalThis` singleton pattern; `requireModule` is a plain async function against this same client, no new client needed.
- `.plans/own-data-scoping-design.md:56` — N5 depends on `requireModule` resolving `{ role, permissions, scope }` **once per request** and passing it down; design `requireModule`'s return shape now so N5 does not need to change its signature later.

**Current behaviour (verified 2026-08-15):** `requireRole` (`api-auth.ts:13-25`) is the only precedent; it throws (`"Forbidden"`) rather than returning a response object, and every one of the ~76 handlers wraps it in `.catch(() => null)` then manually returns `forbidden()`/`unauthorized()`. `requireModule` must follow the exact same throw-and-catch shape so the 40-file sweep in N2 is a mechanical, uniform edit rather than a rewrite of the response-handling pattern per file.

**Concrete traps:**
- The brief explicitly forbids React `cache()` (`02-phase1.md:85`) — do not let an editor's auto-import or a copy-paste from a Server Component elsewhere in the repo pull in `cache` from `react`. There is no existing caching helper in `src/lib/` to reach for by habit; if a request needs the permission set twice, thread it through function arguments, not a cache.
- `requireModule` needs access to `Role.scope` too (N5 reads it via the same resolved-once object per `own-data-scoping-design.md:56`) — design the return type now as `{ role, permissions: Map<ModuleKey, AccessLevel> | Record<...>, scope, personId }` even though N5 doesn't land until after N4. Retrofitting scope onto a narrower N1.3 return type later is exactly the kind of second pass the phase order is trying to avoid.
- A user whose `roleId` is `null` (pre-N1.2 legacy account, or a race where `User.role` was set but `roleId` backfill missed it) must fail **closed** on every module — test this explicitly, it's a one-line "if no role row, return no permissions" branch that's easy to accidentally skip when `roleId` is truthy-checked instead of existence-checked.

**Verification commands:**
```bash
npx tsc --noEmit
npm test -- api-auth
```
Add `src/lib/api-auth.test.ts` (none exists today — `find src -iname "*auth*test*"` returns only the production file itself) covering: each level satisfies those below (reuse `modules.ts`'s cases); an unknown `ModuleKey` string fails closed; a user with `roleId: null` fails closed on every module; a role downgraded via direct Prisma update between two calls changes the *second* call's outcome with no token re-issue.

**Definition of done:**
- [ ] `requireModule(module, level)` added to `src/lib/api-auth.ts` beside `requireRole` (not replacing it yet — N2.4 removes `requireRole`)
- [ ] No `cache()` import from `react` anywhere in the diff (grep confirms)
- [ ] Return shape includes `scope`/`personId` even though nothing reads them until N5
- [ ] `roleId: null` and unknown-module cases both unit-tested and fail closed
- [ ] `npx tsc --noEmit` and `npm test` clean

**N1.4 — `fix(users): validate role assignment and fix the admin badge`**
- `POST /api/users` / `PATCH /api/users/[id]`: accept `roleId`, validate it exists (zod + existence check), reject unknown with `badRequest`. **Also close the pre-existing hole**: the legacy `role` string currently accepts anything — validate or stop accepting it.
- **Keep `role` and `roleId` in sync while both columns exist.** Between N1.2 and N4.3, authorisation still partly flows through the legacy string (`requireRole` in `api-auth.ts:13-25`, the sidebar decode at `sidebar.tsx:38-39`, the self-promotion check at `users/[id]/route.ts:27-33`). **Decided rule (do not improvise):** while both columns exist, `roleId` may only point at a **system** role (`isSystem = true`). Assigning a custom role returns `badRequest` with a Dutch message explaining it becomes available once the legacy column is retired. Mapping a custom role onto "the nearest system string" was rejected — it silently grants whatever that system role can do, which is precisely the divergence this guard exists to prevent. **N4.3's checklist includes lifting this restriction** once `User.role` is gone; custom roles can be *created* (N3.1) and the matrix configured for them throughout, they simply cannot be *assigned to a user* until N4.3 lands in the same phase.
- Fix the lower-case comparison at `users/page.tsx:65`.

**Files to read before starting:**
- `src/app/api/users/route.ts` (whole file, 61 lines) — `POST` (`:39-60`) persists `role: role ?? "PLANNER"` with **zero validation** (`:53`); `GET` (`:22-37`) uses `requireRole("ADMIN", "PLANNER", "VIEWER")`, i.e. every role today, which is effectively `requireAuth`.
- `src/app/api/users/[id]/route.ts` (whole file, 74 lines) — `PATCH` (`:17-56`) accepts `body.role` unchecked (`:32`) and has the self-promotion guard (`:27-29`) that must keep working; `DELETE` (`:58-73`) has the self-deletion guard (`:65`) — neither guard should be touched, only the `role`/`roleId` handling around them.
- `src/app/(app)/users/page.tsx:65` — the exact lower-case comparison to fix: `<Badge variant={u.role === "admin" ? "default" : "secondary"}>` against a column that is always upper case (`"ADMIN"`), so the `default` variant never renders.

**Current behaviour (verified 2026-08-15):** confirmed both routes accept an unchecked `role` string — `users/route.ts:53` (`create`) and `users/[id]/route.ts:32` (`update`, only guarded by the self-promotion check, not by validity). `users/page.tsx:65` compares against `"admin"` (lower case) exactly as the brief states.

**Concrete traps:**
- The self-promotion check at `users/[id]/route.ts:27-29` (`if (body.role !== undefined && auth.id === userId)`) checks the **legacy** `role` field only — if this commit adds `roleId` handling without adding an equivalent `roleId !== undefined && auth.id === userId` guard, an admin editing their own account via the new field bypasses the self-promotion protection entirely. This is a real regression risk, not a hypothetical.
- `data.role = body.role` (`:32`) and the future `data.roleId` must be **kept consistent in the same request** — if a caller sends `roleId` pointing at a custom role with no legacy-string equivalent, decide now (per the brief) whether to reject it until N4.3 or map it to the nearest system string, and write that decision into the commit body verbatim, not just into code comments.
- `users/route.ts`'s `GET` uses `requireRole("ADMIN", "PLANNER", "VIEWER")` (`:23`) — this is the route N1.5 (next commit) depends on being readable by everyone with a `User` row, so do not tighten it here; N2.4 is where `Gebruikers` gating actually lands.

**Verification commands:**
```bash
npx tsc --noEmit
npm run lint
npm test -- users
```
Success: `POST /api/users` and `PATCH /api/users/[id]` both reject a `roleId` that does not exist in the `Role` table (400, not a Prisma FK crash); the legacy `role` string is validated against the three system role strings (or rejected) rather than accepted verbatim; `users/page.tsx:65`'s badge now compares against `"ADMIN"` and the `default` variant visibly applies in a manual check.

**Definition of done:**
- [ ] `roleId` validated (zod + Prisma existence check) on both create and update; unknown `roleId` → `badRequest`
- [ ] Legacy `role` string validated or no longer accepted freely — decision stated in the commit body
- [ ] Self-promotion guard extended to cover `roleId`, not only legacy `role`
- [ ] `users/page.tsx:65` compares against `"ADMIN"`; badge variant verified to actually change in the UI
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` all clean

**N1.5 — `feat(users): assign roles from the roles table`**
- Without this, custom roles — the headline decision of this phase — are reachable only by raw API call. `src/components/user-form.tsx` hardcodes three `SelectItem`s (`:62-64`) and posts a string.
- Convert `RoleSelect` to fetch `GET /api/roles` and submit `roleId`; update `src/hooks/use-users.ts`, the `User` type in `src/types/index.ts`, and the users table's role column to show the role label.
- Requires `GET /api/roles` — if N3.1 has not landed yet, add the read-only endpoint here and let N3.1 extend it.

**Files to read before starting:**
- `src/components/user-form.tsx` (whole file, 247 lines) — `RoleSelect` (`:49-68`) hardcodes three `SelectItem`s; `createSchema`/`editSchema` (`:32-44`) type `role` as `z.string()`; defaults at `:89` (create form), `:93` (edit form), `:100` (create form reset) all hardcode `"PLANNER"`. All four sites need to move from `role` string to `roleId` number.
- `src/hooks/use-users.ts` (whole file, 55 lines) — `fetchUsers`/`create`/`update` all type against `CreateUserValues`/`EditUserValues` imported from `user-form.tsx` (`:3`); changing the form's schema shape changes this file's types too, so both must land in the same commit or `tsc` goes red.
- `src/app/(app)/users/page.tsx` (whole file, 126 lines) — the role column (`:64-68`) currently renders the raw string; it needs the role's `label`, not its `key`, once users carry `roleId`.
- `src/types/index.ts:10-17` (`User` interface) — `role: string` needs a same-commit update (add `roleId`/`role: { label }` or similar) alongside the form/hook changes, or the three files above cannot agree on a shape.

**Current behaviour (verified 2026-08-15):** `RoleSelect` (`user-form.tsx:56-67`) is three literal `SelectItem`s with values `"VIEWER"`/`"PLANNER"`/`"ADMIN"`; nothing in the client fetches a role list. `useUsers()` (`use-users.ts:11-55`) has no query for roles at all.

**Concrete traps:**
- This commit touches **four** files that must agree on the `User`/role shape in one commit (`user-form.tsx`, `use-users.ts`, `types/index.ts`, `users/page.tsx`) — splitting it further than the brief's single commit risks a red intermediate state the checklist forbids.
- `user-form.tsx` is 247 lines already (`wc -l` verified) — comfortably under the 150-line limit is **not** the case here; it is **over by 97 lines already**, before this change adds a role-fetching `RoleSelect`. This file must be split as part of this commit (e.g. extract `RoleSelect` into its own component file) rather than grown further, or the per-commit checklist's 150-line rule fails on a file this commit is required to touch.
- `GET /api/roles` (added here if N3.1 hasn't landed) needs its own zod-free minimal response shape (`{ id, key, label }[]`) — do not accidentally pull in `RolePermission` rows too; that is N3.2/N3.1's concern, and a premature join here creates a second place the roles list is shaped inconsistently.

**Verification commands:**
```bash
wc -l src/components/user-form.tsx   # must be ≤150 after the split
npx tsc --noEmit
npm run lint
npm test -- users
```
Success: creating/editing a user shows a role dropdown populated from `GET /api/roles` (not a hardcoded list); submitting posts `roleId`; the users table's role column shows the role's label, not its raw key; `user-form.tsx` (or its extracted successor files) are each ≤150 lines.

**Definition of done:**
- [ ] `user-form.tsx` split so no resulting file exceeds 150 lines
- [ ] `RoleSelect` fetches `GET /api/roles` and submits `roleId`
- [ ] `use-users.ts`, `types/index.ts`'s `User`, and `users/page.tsx`'s role column all updated in the same commit
- [ ] `GET /api/roles` exists (new here, or already landed via N3.1) and returns `{ id, key, label }[]`
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

**N1.6 — `test(auth): cover permission resolution end to end`**
- Fully-open seed grants everything; a role downgraded to `lezen` blocks writes on the next call; `geen` blocks reads; a custom role behaves exactly like a system role.

**Files to read before starting:**
- `src/lib/availability.test.ts` and `src/lib/pricing.test.ts` — the repo's house style for vitest suites (`describe`/`it`, seed-independent fixtures built in-test rather than reused from `prisma/seed.ts`); `requireModule`'s tests should follow the same shape rather than inventing a new one.
- `src/lib/booking.integration.test.ts:1-40` — the only existing integration-style test that stands up a real (SQLite) Prisma client via `execSync("prisma db push ...")`; if this commit needs a real DB rather than a mocked `prisma` import, this file is the template for doing it against `schema.dev.prisma`.

**Current behaviour:** no test file for `api-auth.ts` exists at all today (`find src -iname "*auth*test*"` returns only the production file) — this commit is the first test coverage that module ever gets.

**Concrete traps:**
- "A custom role behaves exactly like a system role" is the one assertion most likely to be accidentally weakened into "a custom role with the same permissions as a system role behaves the same" — the real test must create a *genuinely new* `Role` row (not reuse `ADMIN`/`PLANNER`/`VIEWER`) and prove `requireModule` treats it identically, otherwise `isSystem` could silently leak into the authorisation path somewhere.
- "Downgraded to `lezen` blocks writes on the next call" must be tested **without a new JWT** — mutate the `RolePermission` row directly between two calls in the same test, reusing the original token/payload, to prove there is no caching anywhere in the chain (this is the one test that would catch a regression if someone "helpfully" added a `cache()` call later).

**Verification commands:**
```bash
npx tsc --noEmit
npm test -- api-auth
```
Success: all four scenarios in the commit title pass, and the "no re-login needed" scenario specifically reuses one token/payload across two calls with a role mutation in between.

**Definition of done:**
- [ ] Fully-open-seed, lezen-blocks-writes, geen-blocks-reads, and custom-role-parity are each an explicit test case
- [ ] The downgrade test mutates the DB between two calls on the same token — no new login/JWT issued mid-test
- [ ] `npx tsc --noEmit` and `npm test` clean

**Out of scope for N1:** route files (N2), the matrix UI (N3), scoping (N5).

---

## N2 — Redaction + enforcement sweep `security-critical` `sole owner of route files`

**Branch:** `n2-route-guards`

Because the matrix is seeded fully open, this changes **nobody's effective access on day one** — it installs the mechanism. Say that in every commit body so the PO is not alarmed.

### Verb → level mapping

`GET` → `lezen` · `POST`/`PUT`/`PATCH` → `wijzigen` · `DELETE` → `verwijderen`

### The complete route → module map (all 40 files, verified inventory)

| Route file (under `src/app/api/`) | Methods | Today | Module |
|---|---|---|---|
| `auth/login`, `auth/logout`, `auth/register` | POST | none | **exempt** (register already 404s) |
| `projects/route.ts` | GET, POST | auth + role(ADMIN,PLANNER) | Projecten **+ redaction** |
| `projects/[id]/route.ts` | GET, PUT, DELETE | auth only ⚠️ | Projecten **+ redaction** |
| `projects/[id]/periods/route.ts` | POST | auth | Projecten |
| `periods/[id]/route.ts` | PATCH, DELETE | auth | Projecten |
| `periods/[id]/people/route.ts` | POST | auth | Planning |
| `periods/[id]/people/[assignmentId]/route.ts` | PATCH, DELETE | auth | Planning **+ field-level Kosten** |
| `periods/[id]/materials/route.ts` | POST | auth | Planning |
| `periods/[id]/materials/[assignmentId]/route.ts` | PATCH, DELETE | auth | Planning **+ field-level Kosten** |
| `periods/[id]/bundles/[bundleId]/route.ts` | DELETE | auth | Planning |
| `people/available/route.ts` | GET | auth | Planning **+ redaction** (returns `dayPrice`, `basePrice`, `hasOverride` — `people/available/route.ts:34-37`) |
| `materials/available/route.ts` | GET | auth | Planning **+ redaction** |
| `people/route.ts` | GET, POST | auth | Personen **+ redaction** (`dayPrice`) |
| `people/[id]/route.ts` | PUT, DELETE | auth | Personen **+ field-level** (`dayPrice` write) |
| `people/[id]/documents/route.ts` | GET, POST | auth only ⚠️ | Personen |
| `documents/[id]/route.ts` | GET, DELETE | auth only ⚠️ | Personen |
| `functions/route.ts` | GET, POST | auth | Personen — **`TODO(L1)`: rates arrive in phase 2, redact then** |
| `functions/[id]/route.ts` | PUT, DELETE | auth | Personen — same `TODO(L1)` |
| `materials/route.ts` | GET, POST | auth | Materialen **+ redaction** |
| `materials/[id]/route.ts` | GET, PUT, DELETE | auth | Materialen **+ field-level** |
| `materials/[id]/stock-items/route.ts` | GET, POST | auth | Materialen |
| `materials/[id]/components/route.ts` | GET, POST | auth | Materialen |
| `materials/[id]/components/[componentId]/route.ts` | PATCH, DELETE | auth | Materialen |
| `stock-items/[id]/route.ts` | PATCH, DELETE | auth | Materialen |
| `categories/route.ts` | GET, POST | auth | Materialen |
| `categories/[id]/route.ts` | PUT, DELETE | auth | Materialen |
| `clients/route.ts` | GET, POST | auth | Klanten |
| `clients/[id]/route.ts` | GET, PUT, DELETE | auth | Klanten |
| `locations/route.ts` | GET, POST | auth | Locaties |
| `locations/[id]/route.ts` | GET, PUT, DELETE | auth | Locaties |
| `projects/[id]/prices/material/[materialId]/route.ts` | PUT, DELETE | auth only ⚠️ | Kosten/Facturen |
| `projects/[id]/prices/person/[personId]/route.ts` | PUT, DELETE | auth only ⚠️ | Kosten/Facturen |
| `periods/[id]/people/[assignmentId]/travel/route.ts` | GET, POST | auth | Kosten/Facturen |
| `periods/[id]/people/[assignmentId]/travel/[travelId]/route.ts` | PATCH, DELETE | auth | Kosten/Facturen |
| `users/route.ts` | GET, POST | role(all three) / role(ADMIN) | Gebruikers |
| `users/[id]/route.ts` | PATCH, DELETE | role(ADMIN) | Gebruikers |
| `settings/route.ts` | GET, PUT | auth / role(ADMIN) | Instellingen |
| `settings/logo/route.ts` | GET, PUT, DELETE | auth only ⚠️ | Instellingen — **GET at `lezen`, no exemption** (see note 3) |

**⚠️ marks the verified holes** the sweep closes: project edit/delete unguarded while create is guarded; anyone can read or delete another person's attesten; company IBAN/BTW readable by all; logo replaceable by all; price overrides writable by all; `GET /api/users` readable by every role.

### Three subtleties

1. **Field-level Kosten on booking PATCHes.** `periods/[id]/people/[assignmentId]` and `.../materials/[assignmentId]` accept `discountPct`, `discountAmount` and a re-snapshot action alongside ordinary booking fields — read both handlers in full before coding. A user with `Planning: wijzigen` but no Kosten access must be able to edit the booking and be **rejected on the money fields**, not handed blanket access because the endpoint is "Planning". Explicit field check, with a test.
2. **`functions/*` gains rates in phase 2.** Keep the module as Personen and **redact the rate fields** for users without `Kosten/Facturen: lezen` — a freelancer needs function names for their own callsheet. Leave a literal `TODO(L1)` comment at both function routes so the phase-2 worker cannot miss it.
3. **`GET /api/settings/logo` is mandated at `Instellingen: lezen` — do not exempt it.** It is excluded from the `proxy.ts` matcher (`src/proxy.ts:31`) and does its own `requireAuth()` (`settings/logo/route.ts:12-14`). The print views (pakbon, callsheet, and the future invoice) fetch it, so verify those still render for whoever must print them — if a printing role would lose the logo, that is a matrix configuration problem, not a reason to leave the route ungated. `PUT`/`DELETE` at `wijzigen`/`verwijderen`.

### Commits

**N2.1 — `feat(auth): redact commercial fields without Kosten access`** ← **do this first**
- New `src/lib/redact.ts`: given a resolved permission set, strip money fields from a payload. Covers `materialPrices`, `personPrices`, `dayPriceSnapshot`, `setupCostSnapshot`, `discountPct`, `discountAmount`, `travelCosts`, `dayPrice`, `basePrice`, `hasOverride`, `setupCost`, `bundlePriceOverride`, `costPrice`/`listPrice`/`revenueBefore` (forward: phase 2).
- Apply to the payloads of `projects` (both), `people`, `people/available`, `materials`, `materials/available`.
- Reject money fields on write for users without `Kosten/Facturen: wijzigen` on `people/[id]` and `materials/[id]`.
- Compose with Y1's serializer — redact then serialize, and do not reintroduce raw Decimals.
- **Verify:** a role with `Kosten/Facturen: geen` gets a project payload containing no price, discount or travel value anywhere in the tree (assert by walking the JSON, not by eyeballing it). This test is the point of the commit.

**Files to read before starting:**
- `src/lib/project-include.ts` (whole file, 31 lines) — the exact tree shape `redact.ts` walks; every nesting level below is verified against this file.
- `src/app/api/people/route.ts`, `src/app/api/people/available/route.ts`, `src/app/api/materials/route.ts`, `src/app/api/materials/available/route.ts` (all read in full) — the four other payload shapes redaction must cover.
- `src/app/api/materials/[id]/stock-items/route.ts` (whole file, 65 lines) — **not** on the brief's stated route list for this commit, but its `GET` (`:7-43`) returns `assignments: PeriodStockItem[]` via a bare `include` with no `select`, which returns every scalar column including `dayPriceSnapshot`, `setupCostSnapshot`, `discountPct`, `discountAmount` (confirmed against `types/index.ts:156-174`'s `StockItemAssignment` shape, which types exactly those fields). This is a live money leak the stated route list would miss.
- `src/types/index.ts:176-194` (`PeriodStockItem`, `PersonTravelCost`) and `:196-206` (`PeriodPerson`) — these fields are typed non-nullable `number` today; redaction cannot return `null` for a scalar without a type change (see traps below).

**Complete inventory of money-bearing fields per API payload (verified 2026-08-15):**

| Route | Payload path | Field(s) | Prisma source |
|---|---|---|---|
| `GET /api/projects`, `GET /api/projects/[id]` | `periods[].materials[]` (`PeriodStockItem`) | `dayPriceSnapshot`, `setupCostSnapshot`, `discountPct`, `discountAmount` | `schema.prisma:189-203` |
| — | `periods[].materials[].stockItem.material` | `dayPrice`, `setupCost`, `bundlePriceOverride` | `schema.prisma:145-162` |
| — | `periods[].people[]` (`PeriodPerson`) | `dayPriceSnapshot`, `discountPct`, `discountAmount` | `schema.prisma:227-240` |
| — | `periods[].people[].person` (`Person`) | `dayPrice` | `schema.prisma:127-143` |
| — | `periods[].people[].travelCosts[]` (`PersonTravelCost`) | `unitCost` (whole array disclosed even without it — see traps) | `schema.prisma:242-249` |
| — | `periods[].bundleBookings[]` (`PeriodBundleBooking`) | `dayPriceSnapshot` | `schema.prisma:216-225` |
| — | `periods[].bundleBookings[].material` + `.material.components[].child` | `dayPrice`, `setupCost`, `bundlePriceOverride` | same as above |
| — | `materialPrices[]` (`ProjectMaterialPrice`) | entire array is commercial (`dayPrice` + its existence) | `schema.prisma:93-102` |
| — | `materialPrices[].material` | `dayPrice`, `setupCost`, `bundlePriceOverride` | — |
| — | `personPrices[]` (`ProjectPersonPrice`) | entire array is commercial (`dayPrice` + its existence) | `schema.prisma:104-113` |
| — | `personPrices[].person` | `dayPrice` | — |
| `GET /api/people` | every array element | `dayPrice` | `people/route.ts:19-24`, `schema.prisma:137` |
| `PUT /api/people/[id]` | request body write | `dayPrice` | `people/[id]/route.ts:23,38` |
| `GET /api/people/available` | `results[].person` | `dayPrice` (effective), `basePrice`, `hasOverride` | `people/available/route.ts:34-37` |
| `GET /api/materials` | every array element | `dayPrice`, `setupCost`, `bundlePriceOverride`, computed `setPrice` | `materials/route.ts:60-77`, `schema.prisma:152-155` |
| — | `[].components[].child` | `dayPrice` | `materials/route.ts:28-33` |
| `GET /api/materials/[id]` | root object | `dayPrice`, `setupCost`, `bundlePriceOverride` | `materials/[id]/route.ts:19-27` |
| `PUT /api/materials/[id]` | request body write | `dayPrice`, `setupCost`, `bundlePriceOverride` | `materials/[id]/route.ts:44-49` |
| `GET /api/materials/available` | `results[].material` | `dayPrice` (effective), `basePrice`, `hasOverride` | `materials/available/route.ts:100-102` |
| `GET /api/materials/[id]/stock-items` **(not on the brief's stated list — add it)** | `[].assignments[]` (`PeriodStockItem`) | `dayPriceSnapshot`, `setupCostSnapshot`, `discountPct`, `discountAmount` | `stock-items/route.ts:16-37` returns a bare `include`, no `select` |

This table is the literal spec for `redact.ts`'s field list — every row must have a corresponding strip/omit rule.

**Concrete traps:**
- **The stated route list in this commit's own bullet ("projects (both), people, people/available, materials, materials/available") omits `materials/[id]/stock-items`.** Extend the redaction call to that route too, or a `Planning: wijzigen`/`Materialen: lezen` user with no Kosten access can see every historic price by opening a material's stock-item detail view even after this commit ships.
- **Type contract collision (flagged by the design doc, `own-data-scoping-design.md:112`, and not yet resolved anywhere):** `src/types/index.ts` types `dayPriceSnapshot`, `setupCostSnapshot`, `dayPrice`, `unitCost` etc. as non-nullable `number` (e.g. `:180`, `:123`, `:192`). Redacting a scalar to `null` breaks that contract; returning `0` is indistinguishable from a genuinely free line. **Pick one convention and apply it everywhere in one pass**: the design doc's recommendation is to omit whole array-level records where the entire record is commercial (`materialPrices` → `[]`, `personPrices` → `[]`, `travelCosts` → `[]`) and widen the TS type to `| null` for scalars nested inside otherwise-kept records (`dayPriceSnapshot` on a kept `PeriodStockItem`), with UI components null-guarding. This decision is inherited by N5.1b — do not make it ad hoc per field.
- **`travelCosts` must be dropped as a whole array, not stripped down to `{label, quantity}`** — a `PersonTravelCost` row with `unitCost` removed still discloses that a travel arrangement exists, which is itself commercial information the redacted user should not see (this exact reasoning is spelled out in `own-data-scoping-design.md:105` for the scoped case, but it applies equally to any `Kosten/Facturen: geen` role, not only scoped ones).
- Compose order matters: **redact before or after Y1's `serialize.ts`?** Redacting a `Decimal` object (not yet converted to `number`) versus redacting an already-serialized plain number both work, but must be decided consistently — the brief says "redact then serialize" (`02-phase1.md:174`); do not accidentally serialize first and then try to pattern-match on a value that's already a JS `number` vs a `Decimal` instance in different code paths.

**Verification commands:**
```bash
npx tsc --noEmit
npm test -- redact
```
Add `src/lib/redact.test.ts` walking a fixture project tree (built with every money field populated, including a bundle booking and a travel cost) and asserting, for a `Kosten/Facturen: geen` caller, that **zero** keys from the inventory table above survive anywhere in the JSON — write this as a recursive key-scan against a denylist, not a hand-written list of `expect(x).toBeUndefined()` assertions per field, so a field added later to `project-include.ts` without a matching redaction rule fails the test instead of silently passing.

**Definition of done:**
- [ ] `redact.ts` covers every row in the inventory table above, including `materials/[id]/stock-items`
- [ ] Whole-array strips (`materialPrices`, `personPrices`, `travelCosts`) return `[]`, not partially-redacted objects
- [ ] The null-vs-omit convention for nested scalars is decided and applied consistently; `types/index.ts` updated to match
- [ ] Recursive JSON-walk test proves no money key survives for a `Kosten/Facturen: geen` caller
- [ ] Write-side rejection: `people/[id]` and `materials/[id]` reject money-field writes without `Kosten/Facturen: wijzigen`
- [ ] `npx tsc --noEmit` and `npm test` clean

**N2.2 — `feat(auth): guard project and planning routes`**
- `projects/*`, `periods/*` (bookings, bundles, availability), including subtlety 1's field-level check.

**Files to read before starting:** every file in the table below (all read in full 2026-08-15) — `src/app/api/projects/route.ts`, `projects/[id]/route.ts`, `projects/[id]/periods/route.ts`, `periods/[id]/route.ts`, `periods/[id]/people/route.ts`, `periods/[id]/people/[assignmentId]/route.ts`, `periods/[id]/materials/route.ts`, `periods/[id]/materials/[assignmentId]/route.ts`, `periods/[id]/bundles/[bundleId]/route.ts`, `people/available/route.ts`, `materials/available/route.ts`.

**Per-file, per-method guard table (verified method lists and current state 2026-08-15):**

| File | Method | Current guard | New guard |
|---|---|---|---|
| `projects/route.ts` | GET (`:13`) | `requireAuth` only | `requireModule("projecten", "lezen")` |
| — | POST (`:28`) | `requireRole("ADMIN","PLANNER")` | `requireModule("projecten", "wijzigen")` — **remove the `requireRole` import/call** |
| `projects/[id]/route.ts` | GET (`:14`) | `requireAuth` only ⚠️ | `requireModule("projecten", "lezen")` |
| — | PUT (`:31`) | `requireAuth` only ⚠️ | `requireModule("projecten", "wijzigen")` |
| — | DELETE (`:71`) | `requireAuth` only ⚠️ | `requireModule("projecten", "verwijderen")` |
| `projects/[id]/periods/route.ts` | POST (`:7`) | `requireAuth` only | `requireModule("projecten", "wijzigen")` |
| `periods/[id]/route.ts` | PATCH (`:7`) | `requireAuth` only | `requireModule("projecten", "wijzigen")` |
| — | DELETE (`:26`) | `requireAuth` only | `requireModule("projecten", "verwijderen")` |
| `periods/[id]/people/route.ts` | POST (`:9`) | `requireAuth` only | `requireModule("planning", "wijzigen")` |
| `periods/[id]/people/[assignmentId]/route.ts` | PATCH (`:8`) | `requireAuth` only | `requireModule("planning", "wijzigen")` **+ field-level check**: reject `discountPct`/`discountAmount` in the body unless the caller also holds `Kosten/Facturen: wijzigen` |
| — | DELETE (`:38`) | `requireAuth` only | `requireModule("planning", "verwijderen")` |
| `periods/[id]/materials/route.ts` | POST (`:9`) | `requireAuth` only | `requireModule("planning", "wijzigen")` |
| `periods/[id]/materials/[assignmentId]/route.ts` | PATCH (`:8`) | `requireAuth` only | `requireModule("planning", "wijzigen")` **+ field-level check**: reject `discountPct`/`discountAmount`/`resnapshotPrice` unless `Kosten/Facturen: wijzigen` |
| — | DELETE (`:40`) | `requireAuth` only | `requireModule("planning", "verwijderen")` |
| `periods/[id]/bundles/[bundleId]/route.ts` | DELETE (`:12`) | `requireAuth` only | `requireModule("planning", "verwijderen")` |
| `people/available/route.ts` | GET (`:6`) | `requireAuth` only | `requireModule("planning", "lezen")` + N2.1's redaction (`dayPrice`/`basePrice`/`hasOverride`, `people/available/route.ts:34-37`) |
| `materials/available/route.ts` | GET (`:15`) | `requireAuth` only | `requireModule("planning", "lezen")` + N2.1's redaction (`materials/available/route.ts:100-102`) |

**Current behaviour:** `projects/[id]/route.ts`'s three handlers (`:14,31,71`) are genuinely `requireAuth()`-only today — confirmed by reading the file — meaning any authenticated user (including a future `scope: own` or low-access role) can currently `PUT`/`DELETE` any project. This is the sharpest hole this commit closes.

**Concrete traps:**
- `projects/route.ts:1-10` imports **both** `requireRole` and `forbidden` (`:5,7`) for the POST handler — when replacing `requireRole("ADMIN","PLANNER")` with `requireModule`, remove the now-unused `requireRole` import from this file specifically, or `npm run lint` fails on an unused import (this file, unlike the 38 others, actually has a `requireRole` call today to remove).
- The field-level check in `periods/[id]/people/[assignmentId]/route.ts` (`:14`, destructures `resnapshotPrice, discountPct, discountAmount, role`) and the materials equivalent (`:14`, `resnapshotPrice, discountPct, discountAmount`) must check **which fields are present in the parsed body**, not just "does the caller have Kosten access" — a caller without Kosten access must still be able to PATCH `role` (people) with no discount fields present, so the check is per-field-presence, not per-request-blanket-deny.
- `periods/[id]/materials/route.ts`'s POST (`:9-71`) and the people equivalent create a **new** assignment and always snapshot a price server-side (`effectivePersonPrice`/`effectiveMaterialPrice`) regardless of caller's Kosten access — that snapshotting is correct and must not be blocked by the field-level check (it's not a user-submitted field), but the **response** returned to the caller (`NextResponse.json(result)` / `NextResponse.json({ assignment, warnings })`) still contains the fresh `dayPriceSnapshot`. A `Planning: wijzigen` caller without `Kosten/Facturen: lezen` will see the price of the booking they just created unless this response is also redacted — apply N2.1's `redact.ts` to these two POST responses too, not only to GET payloads.
- `people/available/route.ts` and `materials/available/route.ts` both do a full `prisma.person.findMany`/`prisma.material.findMany` with **no `where`** (`:19`, `:27`) — i.e. every person/material in the company, priced, is returned regardless of `projectId`. Confirm this stays true after adding `requireModule("planning", "lezen")` — the module gate does not reduce the result set, only redaction does.

**Verification commands:**
```bash
npx tsc --noEmit
npm run lint
npm test -- projects periods
```
Success: every row in the table above rejects a caller whose role lacks the stated level (403 via `forbidden()`); the two booking-creation POST responses contain no money field for a caller without `Kosten/Facturen: lezen`; `projects/route.ts` has no remaining `requireRole` import.

**Definition of done:**
- [ ] All 17 handlers in the table above call `requireModule` with the stated module/level
- [ ] `projects/route.ts`'s `requireRole` import removed (only file in this commit where that applies)
- [ ] Field-level Kosten check implemented per-field-presence on both PATCH assignment routes, with a test proving a non-Kosten caller can still edit `role` but not `discountPct`
- [ ] Booking-creation POST responses (`periods/[id]/people`, `periods/[id]/materials`) redacted for non-Kosten callers
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

**N2.3 — `feat(auth): guard people, materials, client and location routes`**
- `people/*`, `documents/*`, `functions/*` (+ `TODO(L1)`), `materials/*`, `stock-items/*`, `categories/*`, `clients/*`, `locations/*`.

**Files to read before starting:** all 16 files in the table below (all read in full 2026-08-15).

**Per-file, per-method guard table (verified method lists and current state 2026-08-15):**

| File | Method | Current guard | New guard |
|---|---|---|---|
| `people/route.ts` | GET (`:10`) | `requireAuth` only | `requireModule("personen", "lezen")` + redact `dayPrice` |
| — | POST (`:30`) | `requireAuth` only | `requireModule("personen", "wijzigen")` + reject `dayPrice` write without `Kosten/Facturen: wijzigen` |
| `people/[id]/route.ts` | PUT (`:12`) | `requireAuth` only | `requireModule("personen", "wijzigen")` + same `dayPrice` field-level check |
| — | DELETE (`:64`) | `requireAuth` only | `requireModule("personen", "verwijderen")` |
| `people/[id]/documents/route.ts` | GET (`:9`) | `requireAuth` only ⚠️ | `requireModule("personen", "lezen")` |
| — | POST (`:21`) | `requireAuth` only | `requireModule("personen", "wijzigen")` |
| `documents/[id]/route.ts` | GET (`:7`) | `requireAuth` only ⚠️ | `requireModule("personen", "lezen")` |
| — | DELETE (`:25`) | `requireAuth` only ⚠️ | `requireModule("personen", "verwijderen")` |
| `functions/route.ts` | GET (`:13`) | `requireAuth` only | `requireModule("personen", "lezen")` + `TODO(L1)` comment for rate redaction |
| — | POST (`:26`) | `requireAuth` only | `requireModule("personen", "wijzigen")` + `TODO(L1)` |
| `functions/[id]/route.ts` | PUT (`:16`) | `requireAuth` only | `requireModule("personen", "wijzigen")` + `TODO(L1)` |
| — | DELETE (`:34`) | `requireAuth` only | `requireModule("personen", "verwijderen")` + `TODO(L1)` — keep the existing linked-people conflict guard (`:44-47`) untouched |
| `materials/route.ts` | GET (`:13`) | `requireAuth` only | `requireModule("materialen", "lezen")` + redact `dayPrice`/`setupCost`/`bundlePriceOverride`/`setPrice` |
| — | POST (`:85`) | `requireAuth` only | `requireModule("materialen", "wijzigen")` |
| `materials/[id]/route.ts` | GET (`:14`) | `requireAuth` only | `requireModule("materialen", "lezen")` + redact |
| — | PUT (`:33`) | `requireAuth` only | `requireModule("materialen", "wijzigen")` + reject `dayPrice`/`setupCost`/`bundlePriceOverride` writes without `Kosten/Facturen: wijzigen` |
| — | DELETE (`:79`) | `requireAuth` only | `requireModule("materialen", "verwijderen")` |
| `materials/[id]/stock-items/route.ts` | GET (`:7`) | `requireAuth` only | `requireModule("materialen", "lezen")` + **redact `assignments[].dayPriceSnapshot/setupCostSnapshot/discountPct/discountAmount`** (flagged as a gap in N2.1 above — this commit is where it must actually land if N2.1 didn't cover it) |
| — | POST (`:45`) | `requireAuth` only | `requireModule("materialen", "wijzigen")` |
| `materials/[id]/components/route.ts` | GET (`:18`) | `requireAuth` only | `requireModule("materialen", "lezen")` |
| — | POST (`:34`) | `requireAuth` only | `requireModule("materialen", "wijzigen")` |
| `materials/[id]/components/[componentId]/route.ts` | PATCH (`:16`) | `requireAuth` only | `requireModule("materialen", "wijzigen")` |
| — | DELETE (`:38`) | `requireAuth` only | `requireModule("materialen", "verwijderen")` |
| `stock-items/[id]/route.ts` | PATCH (`:7`) | `requireAuth` only | `requireModule("materialen", "wijzigen")` |
| — | DELETE (`:23`) | `requireAuth` only | `requireModule("materialen", "verwijderen")` |
| `categories/route.ts` | GET (`:16`) | `requireAuth` only | `requireModule("materialen", "lezen")` |
| — | POST (`:30`) | `requireAuth` only | `requireModule("materialen", "wijzigen")` |
| `categories/[id]/route.ts` | PUT (`:20`) | `requireAuth` only | `requireModule("materialen", "wijzigen")` |
| — | DELETE (`:38`) | `requireAuth` only | `requireModule("materialen", "verwijderen")` — keep the existing linked-materials conflict guard (`:48-51`) untouched |
| `clients/route.ts` | GET (`:23`) | `requireAuth` only | `requireModule("klanten", "lezen")` |
| — | POST (`:37`) | `requireAuth` only | `requireModule("klanten", "wijzigen")` |
| `clients/[id]/route.ts` | GET (`:27`) | `requireAuth` only | `requireModule("klanten", "lezen")` |
| — | PUT (`:43`) | `requireAuth` only | `requireModule("klanten", "wijzigen")` |
| — | DELETE (`:62`) | `requireAuth` only | `requireModule("klanten", "verwijderen")` — keep the existing linked-projects conflict guard (`:70-74`) untouched |
| `locations/route.ts` | GET (`:20`) | `requireAuth` only | `requireModule("locaties", "lezen")` |
| — | POST (`:34`) | `requireAuth` only | `requireModule("locaties", "wijzigen")` |
| `locations/[id]/route.ts` | GET (`:24`) | `requireAuth` only | `requireModule("locaties", "lezen")` |
| — | PUT (`:40`) | `requireAuth` only | `requireModule("locaties", "wijzigen")` |
| — | DELETE (`:58`) | `requireAuth` only | `requireModule("locaties", "verwijderen")` — keep the existing linked-projects conflict guard (`:66-69`) untouched |

**Current behaviour:** all 16 files above are `requireAuth()`-only today (verified by reading each in full) — none call `requireRole` at all, so this commit introduces the first authorisation beyond "logged in" for every one of them. `people/[id]/documents/route.ts` and `documents/[id]/route.ts` are the two ⚠️-marked holes from the brief's route map (anyone can read/delete another person's uploaded PDFs, e.g. attesten/contracts).

**Concrete traps:**
- `functions/route.ts` and `functions/[id]/route.ts` (91 lines combined) carry **no money field today** (`Function { id, name }` only, `schema.prisma:46-50`) — the `TODO(L1)` is purely a forward marker for phase 2's `dayRate`/`hourRate` addition; do not attempt to redact anything on these routes now, only leave the comment. Adding a redaction call against a field that doesn't exist yet is dead code that `tsc` will flag as unused once L1 lands, or worse, silently wrong if written speculatively.
- `categories/[id]/route.ts:47-51` and `clients/[id]/route.ts:70-74` and `locations/[id]/route.ts:66-69` and `functions/[id]/route.ts:44-47` each have an **existing conflict-guard** (block deletion while rows are still linked) that must survive this commit unchanged — the new `requireModule("...", "verwijderen")` call goes *before* these existing checks, not instead of them.
- `materials/[id]/stock-items/route.ts`'s redaction (flagged above) must be added **somewhere** in the phase — if N2.1 didn't add it, this commit is the last realistic place before N2.5's exemption-list test starts asserting every handler is guarded (that test does not check *redaction*, only *authorisation*, so a guarded-but-unredacted handler would pass N2.5 while still leaking money — do not rely on N2.5 to catch this).
- `people/[id]/documents/route.ts` and `documents/[id]/route.ts` deal with `PersonDocument` (attesten) — gating them under `personen` is correct per the brief's module map, but note N5 (§5, Personen bucket) later **denies this route outright for scope:own regardless of module level**, flagged there as "pending explicit PO sign-off" — do not treat this commit's module-level gating as the final word on who can read another colleague's documents.

**Verification commands:**
```bash
npx tsc --noEmit
npm run lint
npm test -- people materials categories clients locations functions
```
Success: every row in both tables (this commit's 16 files, N2.2's 11) rejects a caller lacking the stated level; the four existing conflict-guards (categories/clients/locations/functions delete-blocked-while-linked) still fire with their original Dutch messages, unchanged; `materials/[id]/stock-items` no longer returns raw price snapshots to a non-Kosten caller.

**Definition of done:**
- [ ] All handlers in the table above call `requireModule` with the stated module/level
- [ ] Four existing conflict-guards (functions/categories/clients/locations delete) untouched and still tested green
- [ ] `materials/[id]/stock-items` redaction gap closed (here or confirmed already closed by N2.1)
- [ ] `people/[id]/documents` and `documents/[id]` now require `Personen` access (closing the ⚠️ hole)
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

**N2.4 — `feat(auth): guard cost, user and settings routes`**
- `projects/[id]/prices/*`, travel routes, `users/*`, `settings/*`, `settings/logo` per subtlety 3. Remove now-dead `requireRole` calls; delete `requireRole` itself **only when it has no callers left** — if anything still needs it (login is exempt and does not use it), say why in the body. Deleting it while a caller remains is a red commit.

**Files to read before starting:** all 8 files in the table below (all read in full 2026-08-15), plus `src/lib/api-auth.ts:13-25` (`requireRole` itself, to confirm every caller is accounted for before deleting it).

**Per-file, per-method guard table (verified method lists and current state 2026-08-15):**

| File | Method | Current guard | New guard |
|---|---|---|---|
| `projects/[id]/prices/material/[materialId]/route.ts` | PUT (`:7`) | `requireAuth` only ⚠️ | `requireModule("kosten_facturen", "wijzigen")` |
| — | DELETE (`:35`) | `requireAuth` only ⚠️ | `requireModule("kosten_facturen", "verwijderen")` |
| `projects/[id]/prices/person/[personId]/route.ts` | PUT (`:7`) | `requireAuth` only ⚠️ | `requireModule("kosten_facturen", "wijzigen")` |
| — | DELETE (`:35`) | `requireAuth` only ⚠️ | `requireModule("kosten_facturen", "verwijderen")` |
| `periods/[id]/people/[assignmentId]/travel/route.ts` | GET (`:20`) | `requireAuth` only | `requireModule("kosten_facturen", "lezen")` |
| — | POST (`:35`) | `requireAuth` only | `requireModule("kosten_facturen", "wijzigen")` |
| `periods/[id]/people/[assignmentId]/travel/[travelId]/route.ts` | PATCH (`:20`) | `requireAuth` only | `requireModule("kosten_facturen", "wijzigen")` |
| — | DELETE (`:41`) | `requireAuth` only | `requireModule("kosten_facturen", "verwijderen")` |
| `users/route.ts` | GET (`:22`) | `requireRole("ADMIN","PLANNER","VIEWER")` (i.e. every role — effectively `requireAuth`) ⚠️ | `requireModule("gebruikers", "lezen")` |
| — | POST (`:39`) | `requireRole("ADMIN")` | `requireModule("gebruikers", "wijzigen")` |
| `users/[id]/route.ts` | PATCH (`:17`) | `requireRole("ADMIN")` | `requireModule("gebruikers", "wijzigen")` — self-promotion guard (`:27-29`) stays, extended per N1.4 to cover `roleId` |
| — | DELETE (`:58`) | `requireRole("ADMIN")` | `requireModule("gebruikers", "verwijderen")` — self-deletion guard (`:65`) stays |
| `settings/route.ts` | GET (`:11`) | `requireAuth` only | `requireModule("instellingen", "lezen")` |
| — | PUT (`:22`) | `requireRole("ADMIN")` | `requireModule("instellingen", "wijzigen")` |
| `settings/logo/route.ts` | GET (`:12`) | `requireAuth` only ⚠️ **not exempt — see subtlety 3** | `requireModule("instellingen", "lezen")` |
| — | PUT (`:26`) | `requireAuth` only ⚠️ | `requireModule("instellingen", "wijzigen")` |
| — | DELETE (`:45`) | `requireAuth` only ⚠️ | `requireModule("instellingen", "verwijderen")` |

**Current behaviour:** `users/route.ts:23`'s `GET` handler calls `requireRole("ADMIN", "PLANNER", "VIEWER")` — every role in the current three-value system, so it is authorisation in name only; confirmed this is the exact hole the brief's route map calls "readable by every role". Both price-override routes and all three `settings/logo` verbs are genuinely `requireAuth()`-only (verified) — company IBAN/BTW-adjacent settings and price overrides are writable/readable by anyone logged in today.

**Concrete traps:**
- **`requireRole` has exactly five call sites before this commit**: `projects/route.ts:29` (removed in N2.2), `users/route.ts:23,40`, `users/[id]/route.ts:18,59`, `settings/route.ts:23`. This commit removes the last four; N2.2 already removed the first. Only delete the `requireRole` function itself from `api-auth.ts` after confirming `grep -rn "requireRole" src/` returns zero hits — if this commit lands before N2.2 in whatever order a worker picks, `requireRole` still has a caller and deleting it is a red commit. The brief's stated order (N2.1 → N2.2 → N2.3 → N2.4) avoids this, but a worker parallelising commits must not delete `requireRole` until literally the last reference is gone.
- `src/proxy.ts:31`'s matcher excludes `api/settings/logo` from the Edge-level auth check entirely (`"...|api/settings/logo).*"`) — this is unrelated to and unaffected by adding `requireModule` inside the route handler itself (the route's own `requireAuth()`/`requireModule()` call is what protects it, per subtlety 3); do not attempt to "fix" this by editing the proxy matcher, which would change unrelated routing behaviour outside this commit's scope.
- `settings/logo`'s three handlers being gated at `Instellingen: lezen`/`wijzigen`/`verwijderen` means **any role without `Instellingen: lezen`** (e.g. a future "Freelancer" role) will 403 on `GET /api/settings/logo` — verify the pakbon, callsheet and Kosten print views (all fetch the logo) still render for whichever roles are actually expected to print them, per subtlety 3's own instruction. This is a matrix-configuration concern for the PO, not a reason to change the gating here, but it must be **checked**, not assumed.
- `users/[id]/route.ts:27-29`'s self-promotion guard only checks `body.role !== undefined` — if N1.4 added a parallel `roleId` check, both must still work together here; do not let this commit's `requireModule` swap-in silently bypass either.

**Verification commands:**
```bash
grep -rn "requireRole" src/   # must be empty after this commit
npx tsc --noEmit
npm run lint
npm test -- users settings prices travel
```
Success: `requireRole` has zero remaining references anywhere in `src/`, and the function is deleted from `api-auth.ts` in this same commit (not left as dead exported code); `GET /api/users` now requires `Gebruikers: lezen` rather than accepting all three legacy roles; both price-override routes and all three `settings/logo` verbs reject a caller without `Kosten/Facturen`/`Instellingen` access respectively; pakbon/callsheet/Kosten print views manually verified to still fetch the logo for an admin-equivalent role.

**Definition of done:**
- [ ] All 16 handlers in the table above call `requireModule` with the stated module/level
- [ ] `requireRole` deleted from `api-auth.ts`; zero remaining references confirmed by grep
- [ ] `settings/logo`'s three verbs gated per subtlety 3 (not exempted); print-view logo fetch manually verified for an admin-equivalent role
- [ ] Self-promotion (`users/[id]/route.ts:27-29`) and self-deletion (`:65`) guards still pass their existing tests
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

**N2.5 — `test(auth): assert every handler declares a module guard`**
- Walk `src/app/api/**/route.ts` and assert **per exported handler**, not per file — several files export 2–3 methods (`materials/route.ts` GET+POST, `clients/[id]/route.ts` GET+PUT+DELETE), so a file-level "contains the string `requireModule`" check would pass a file where only one method is guarded. Parse the exported functions individually.
- Exemption list: `auth/login`, `auth/logout`, `auth/register`, plus forward entries `auth/me` (N4.1) and the ICS feed prefix **`/api/calendar/`** (O1, phase 4 — pinned in both briefs so this test cannot go red when O1 merges). **`settings/logo` is not exempt** (subtlety 3).
- Without the exemption list the test is unsatisfiable — login cannot require a permission, and `/api/auth/me` is how a client *discovers* its permissions, so gating it is circular.
- Failure message must name the file, the handler and what to add.

**Files to read before starting:**
- Every route file this phase touched (N2.1–N2.4's tables above are the authoritative list — 40 files total, one exemption list) — this commit's job is to walk `src/app/api/**/route.ts` at runtime/compile-time and assert coverage, so the exemption list must match the phase's own tables exactly or the test either false-fails on exempt routes or false-passes on a missed one.
- `src/app/api/auth/login/route.ts`, `logout/route.ts`, `register/route.ts` (all read in full) — confirms these three have no `requireAuth`/`requireModule` call today by design (login/logout must work pre-auth; register is a stub returning `notFound()`), so the exemption list is not a workaround but a structural necessity.

**Current behaviour:** no such coverage test exists today for any authorisation pattern — `requireAuth`-only coverage has never been asserted by a test, only by manual code reading (which is exactly how the ⚠️-marked holes in the route map went unnoticed).

**Concrete traps:**
- A file-level "does this file's source contain the string `requireModule`" check is insufficient and the brief already says so (`02-phase1.md:187`) — but the more subtle failure is a check that greps for `requireModule` **anywhere in the file** and treats the whole file as covered the moment *any* handler calls it. `clients/[id]/route.ts` (GET/PUT/DELETE, all now guarded) is a false-negative risk in the *other* direction if a future edit adds a fourth handler without a guard — the test must parse each exported `function GET/POST/PUT/PATCH/DELETE` individually and check each one's own body, not the file as a whole.
- The exemption list must be **exactly** `auth/login`, `auth/logout`, `auth/register`, `auth/me` (forward, N4.1), and the `/api/calendar/` prefix (forward, O1, phase 4) — no other route, however special-looking, gets silently added. `settings/logo` looks like a plausible exemption candidate (it's excluded from the `proxy.ts` matcher) but subtlety 3 explicitly rules it in, not out — a worker pattern-matching "routes excluded from the proxy matcher are exempt" would wrongly add it here.
- This test must be written to **fail loudly and specifically** — assert per-handler, and the failure message names the file and the handler (e.g. `"materials/[id]/route.ts: PUT is missing a requireModule/requireAuth guard"`), not a generic "some route unguarded" message a future maintainer has to grep to locate.

**Verification commands:**
```bash
npx tsc --noEmit
npm test -- route-guards
```
Success: the new test enumerates all 40 route files' exported handlers, asserts every one calls `requireModule` except the five named exemptions (login/logout/register/me/calendar-prefix), and — as a regression check — temporarily removing a `requireModule` call from any one handler (e.g. comment out the line in `clients/[id]/route.ts`'s `DELETE`) makes this specific test fail with a message naming that file and method.

**Definition of done:**
- [ ] Test parses exported handlers individually, not file-level string matching
- [ ] Exemption list is exactly the five named routes/prefixes, each with a one-line reason in a comment
- [ ] Failure message includes file + handler name
- [ ] Manually verified: removing one `requireModule` call anywhere makes the test fail specifically on that handler
- [ ] `npx tsc --noEmit` and `npm test` clean

**Out of scope:** UI gating (N4), scoping (N5), any behaviour change beyond authorisation and redaction.

---

## N3 — Roles and matrix UI

**Branch:** `n3-permission-ui` · runs parallel with N2 · skill: `design`

`src/app/(app)/settings/page.tsx` is 14 lines and composes `SettingsForm` + `LogoUpload`. Add the permissions section as its own components — do not inline (150-line limit).

**Files to read before starting (whole-phase context for N3):**
- `src/app/(app)/settings/page.tsx` (14 lines, whole file) — confirmed: `SettingsPage` returns a `<div>` composing `<SettingsForm />` and `<LogoUpload />` (`:6-13`), nothing else. New permission sections (`RolesManager`, `PermissionMatrix`, `OpenPermissionsBanner`) are added as siblings here, e.g. `<SettingsForm /><LogoUpload /><RolesManager /><PermissionMatrix /><OpenPermissionsBanner />` (or a wrapping section) — never merged into `SettingsForm`.
- `src/components/settings-form.tsx` (whole file) — **`wc -l` confirms this file is already 163 lines, i.e. already over the 150-line limit today, before this phase touches anything.** It is not on the round-2 plan's Y3 list of over-limit files (`planning/page.tsx` 173, `project-costs-tab.tsx` 183, `person-split-editor.tsx` 230, `projects/[id]/page.tsx` 168, `material-detail-pane.tsx` 131 — `settings-form.tsx` is a separate, previously-unflagged violation). **N3 must not add anything to this file** — every new section is a wholly separate component, which the brief's own instruction ("do not inline") already implies, but the existing overage makes it a hard constraint rather than a style preference: touching this file at all triggers the per-commit checklist's 150-line rule on a file already 13 over.
- `src/app/api/functions/[id]/route.ts:44-47` — the exact linked-record conflict-guard pattern N3.1 mirrors: `if (fn._count.people > 0) return conflict("Functie kan niet verwijderd worden: er zijn nog personen gekoppeld.")`. `RolesManager`'s delete-blocked-with-users-assigned message should read the same way (verb + "kan niet verwijderd worden" + reason), for UI consistency.
- `src/hooks/use-users.ts` (55 lines, whole file) — the house pattern for a CRUD hook (`useQuery` + three `useMutation`s, each invalidating the same query key) that a new `use-roles.ts` should follow for `GET/POST/PUT/DELETE /api/roles`.

**N3.1 — `feat(settings): manage custom roles`**
- List/create/rename/delete roles. `isSystem` roles are renameable but not deletable. Deleting a role with users assigned is refused with a clear message (mirror `src/app/api/functions/[id]/route.ts:44`, which blocks deletion while people are linked).
- API: `GET/POST /api/roles`, `PUT/DELETE /api/roles/[id]` under **Gebruikers** (roles are about who may do what — keep it with user administration, and make N2's map agree).

**Current behaviour:** no `Role` model, no `/api/roles` route, no `RolesManager` component exist today (confirmed: `ls src/app/api/roles` and `find src -iname "*role*"` outside `types/index.ts:8`'s unused `Role` union both return nothing). This is the first UI consumer of N1.2's schema.

**Concrete traps:**
- If N1.5 already added a minimal read-only `GET /api/roles` (the brief allows this: "if N3.1 has not landed yet, add the read-only endpoint here and let N3.1 extend it", `02-phase1.md:98`), **check for it before creating a duplicate** — extend the existing route file rather than adding a second one; the phase's own dependency note (`N1 ... └─► N3 (roles + matrix UI, parallel with N2)`) means N1.5 could land before or after N3.1 depending on worker scheduling.
- The delete-blocked message must check **`User.roleId`**, not `RolePermission` rows — a role can have `RolePermission` rows (matrix entries) with zero users assigned, which should be freely deletable; the guard is specifically "are any `User` rows pointing at this role", mirroring `functions/[id]/route.ts:44`'s `_count.people` shape but counted against `User`, not `RolePermission`.
- `isSystem` roles being "renameable but not deletable" needs both a client-side disabled delete button/icon **and** a server-side check — do not rely on the UI alone to prevent deleting `ADMIN`/`PLANNER`/`VIEWER` (a direct API call must also be rejected).

**Verification commands:**
```bash
npx tsc --noEmit
npm run lint
npm test -- roles
```
Success: creating, renaming, and deleting a custom role all work end-to-end from the settings UI; deleting a system role is rejected both in the UI (disabled control) and via a direct `DELETE /api/roles/[id]` call (403/409); deleting a role with an assigned user is refused with a Dutch message naming the reason, mirroring `functions/[id]/route.ts:44-47`'s phrasing style.

**Definition of done:**
- [ ] `GET/POST /api/roles`, `PUT/DELETE /api/roles/[id]` exist (or the N1.5 stub is extended, not duplicated), gated under `Gebruikers`
- [ ] `isSystem` roles renameable, not deletable — enforced server-side, not only in the UI
- [ ] Delete-blocked-with-users check joins through `User.roleId`, not `RolePermission`
- [ ] New components only — `settings-form.tsx` untouched
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

**N3.2 — `feat(settings): edit the role × module permission matrix`**
- Modules as rows, roles as columns, a four-level select per cell. Invalidate the permission query on save so the change is visible immediately.
- **Self-lockout guard — must cover both administrative modules and must check user reachability:**
  - Refuse a save that would leave **no role holding `Instellingen: verwijderen`** *and* refuse one leaving **no role holding `Gebruikers: verwijderen`**. Locking Gebruikers is just as terminal: nobody can then reassign roles to recover.
  - Check that **an actual user** can still reach each of those permissions — join through `User.roleId`. Counting `RolePermission` rows alone is defeated by an unassigned throwaway role holding the permission while every real user's role is stripped.
  - Warn before a change that removes the current user's own access.

**Current behaviour:** no matrix UI, no `/api/roles/[id]` permission-update endpoint, no self-lockout check exist today — greenfield, same as N3.1.

**Concrete traps:**
- The two self-lockout checks (`Instellingen: verwijderen`, `Gebruikers: verwijderen`) are **independent** — a save that fixes one while breaking the other must still be refused. Test both directions separately, not just "at least one admin permission survives".
- "Join through `User.roleId`" means the query is `RolePermission` rows for the module/level **joined against `User` where `User.roleId` matches**, not merely `RolePermission.access = 'verwijderen'` — a role satisfying the permission with zero users assigned must not count as coverage. Write this as a single query (e.g. `count of User where roleId in (roles holding the permission)`), not two separate checks that could disagree.
- "Warn before a change that removes the current user's own access" needs the **current user's own role and permissions**, resolved via the same `requireModule`/`/api/auth/me` path as everywhere else in the phase — do not add a second, bespoke "who am I" lookup for this one warning.
- Matrix save must be **atomic** (`prisma.$transaction`) — a partial write (some `RolePermission` rows updated, the process crashes or a validation fails midway) that leaves the matrix in a mixed state is worse than rejecting the whole save.

**Verification commands:**
```bash
npx tsc --noEmit
npm run lint
npm test -- roles permissions
```
Success: attempting to strip `Instellingen: verwijderen` from every role is refused with a clear message; attempting to strip `Gebruikers: verwijderen` from every role is refused independently of the first case; a save that would leave `Instellingen: verwijderen` only on a role with zero assigned users is refused (not just "at least one `RolePermission` row exists"); saving a valid change invalidates the permission query and the UI reflects it without a page reload.

**Definition of done:**
- [ ] Self-lockout check covers `Instellingen` and `Gebruikers` independently, both joined through `User.roleId`
- [ ] Save is transactional — no partial-matrix state possible on failure
- [ ] A change removing the current user's own access triggers a warning before save
- [ ] Query invalidation makes the change visible immediately, no refresh needed
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

**N3.3 — `feat(settings): warn about open permissions and offer recommended defaults`** ← **required, not optional**
- A visible banner while any role exceeds the recommended baseline: *"Alle rollen hebben momenteel volledige toegang."*
- One-click **"pas aanbevolen standaarden toe"** showing a diff before applying: VIEWER = `lezen` everywhere; PLANNER = `wijzigen` everywhere except `Kosten/Facturen`, `Gebruikers`, `Instellingen` (`geen`); ADMIN = `verwijderen` everywhere.
- This commit is what actually closes the hole the PO reported. Without it the phase installs a mechanism nobody turns on.

**Current behaviour:** confirmed nothing resembling this banner, diff view, or "apply defaults" action exists anywhere in the codebase — this is a wholly new UI surface with no precedent component to model beyond ordinary shadcn `Card`/`Dialog`/`Badge` usage already used throughout `settings-form.tsx` and `user-form.tsx`.

**Concrete traps:**
- "While any role exceeds the recommended baseline" needs a precise definition of "exceeds" — it is not "differs from" (a role configured *more restrictively* than the recommended baseline should not trigger the warning). Compare each role's actual matrix against its recommended-default counterpart using the access-level ordering from N1.1's `satisfies()`, per module, and warn only if any cell is *above* the recommendation for that role.
- The three recommended defaults (VIEWER/PLANNER/ADMIN) are keyed by role **name**, but this phase's headline feature is custom roles with arbitrary names — decide and state explicitly how "apply recommended defaults" behaves for a custom role that isn't literally named VIEWER/PLANNER/ADMIN (most defensible: the one-click action only touches the three system roles; custom roles are left for the PO to configure by hand, since there is no principled default for a role nobody named yet).
- The diff preview before applying must be **exact per cell**, not a prose summary — the PO reads this before committing to a security-relevant change; render it as a before/after table (module × role), not "12 permissions will change".

**Verification commands:**
```bash
npx tsc --noEmit
npm run lint
```
Success: with the fully-open seed (C1) untouched, the banner is visible on `/settings`; clicking "pas aanbevolen standaarden toe" shows a diff naming every cell that will change before any write happens; confirming the diff applies exactly VIEWER=lezen-everywhere / PLANNER=wijzigen-except-Kosten-Gebruikers-Instellingen / ADMIN=verwijderen-everywhere; re-opening the banner after applying shows it gone (or reduced to whatever custom roles remain wide open).

**Definition of done:**
- [ ] Banner text matches the brief's exact Dutch copy: *"Alle rollen hebben momenteel volledige toegang."*
- [ ] "Exceeds baseline" comparison uses `satisfies()`'s ordering, not a naive inequality
- [ ] Diff is a per-cell before/after table, shown before any write
- [ ] Custom-role behaviour under "apply defaults" is decided and stated in the commit body
- [ ] `npx tsc --noEmit` and `npm run lint` clean

---

## N4 — Server-side page guards and the client hook

**Branch:** `n4-page-guards` · **after N2**

Today `/users` and `/settings` are `"use client"` with **no server guard** (`users/page.tsx` 126 lines, `settings/page.tsx` 14 lines), and `src/proxy.ts:9-27` only verifies the JWT signature — no role logic. A non-admin navigating directly sees the page shell, the whole user list and all company settings.

Two different nav components, in two different states:
- `src/components/sidebar.tsx:10-20` decodes the JWT inline (`getRole()`) → `isAdmin` (`:39`) → hides `/users` and `/settings` (`:51-54`).
- `src/components/mobile-sidebar.tsx:12-19` has **no gating whatsoever** — `NAV_LINKS` hardcodes `/users` ("Gebruikers") for every role. This is a live hole today, not something to "replace".

**Files to read before starting:** `src/components/sidebar.tsx` (84 lines, whole file), `src/components/mobile-sidebar.tsx` (79 lines, whole file), `src/proxy.ts` (33 lines, whole file), `src/lib/auth.ts` (18 lines, whole file) — all read in full 2026-08-15.

**Current nav-gating code, quoted exactly (`src/components/sidebar.tsx`):**
```ts
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function getRole(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rentflow_token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload.role as string | undefined) ?? null;
  } catch {
    return null;
  }
}

const BASE_LINKS = [ /* Dashboard, Projecten, Planning, Personen, Materialen, Klanten, Locaties */ ] as const;

const ADMIN_LINKS = [
  { href: "/users", label: "Gebruikers", icon: "👤" },
  { href: "/settings", label: "Instellingen", icon: "⚙️" },
] as const;

export async function Sidebar() {
  const role = await getRole();
  const isAdmin = role === "ADMIN";
  // ...
  {isAdmin && ADMIN_LINKS.map(...)}
```
(`sidebar.tsx:8-20,22-35,37-54`) — a Server Component that decodes the JWT itself with its own `jose` instance (a **second** `JWT_SECRET` `TextEncoder` alongside `proxy.ts`'s own, `sidebar.tsx:8` vs `proxy.ts:4` — two independent encodings of the same secret today).

**Current nav-gating code, quoted exactly (`src/components/mobile-sidebar.tsx`):**
```ts
const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/projects", label: "Projecten", icon: "📁" },
  { href: "/planning", label: "Planning", icon: "📅" },
  { href: "/people", label: "Personen", icon: "👥" },
  { href: "/materials", label: "Materialen", icon: "📦" },
  { href: "/users", label: "Gebruikers", icon: "👤" },
] as const;
```
(`mobile-sidebar.tsx:12-19`) — note this list does not even include `/settings` (an existing inconsistency with the desktop sidebar, separate from the missing role check) and unconditionally renders `/users` regardless of role. The whole component is `"use client"` (`:1`) with no server-side involvement at all.

**N4.1 — `feat(auth): add /api/auth/me`**
- Returns the current user, resolved permissions and scope. On N2.5's exemption list (it is the discovery endpoint) but still requires authentication.

**Files to read before starting:** `src/lib/api-auth.ts` (`requireAuth`, `:6-11`), N1.3's `requireModule` (once landed, for its resolved-permission-set shape), `.plans/own-data-scoping-design.md:60-64` (§2, "Where scope is resolved" — this route is the one N5.1 later extends with `scope`/`personId`/`linkedPersonMissing`, so shape it now to avoid a breaking response-shape change then).

**Current behaviour:** no `/api/auth/me` route exists (confirmed: `find src/app/api -iname "me"` returns nothing). The closest existing pattern is `login/route.ts:34-41`'s response body shape (`{ user: { id, email, name, role } }`) — `/api/auth/me` should return a superset of this shape plus `permissions`/`scope`, not a differently-named sibling shape.

**Concrete traps:**
- This route must call `requireAuth()` (still requires authentication, per the brief) but **not** `requireModule` for any specific module — it is the discovery endpoint a client calls *before* knowing what it's allowed to see, so gating it behind a module permission is circular (the same reasoning N2.5 states for the exemption list).
- Design the response shape to include `scope`, `personId`, and `linkedPersonMissing` (`own-data-scoping-design.md:64,214`) **even though N5 doesn't land until after N4** — retrofitting this route's shape after N4.2's `usePermissions()` hook is already built against a narrower shape means editing two commits instead of one.

**Verification commands:**
```bash
npx tsc --noEmit
npm test -- auth-me
```
Success: an authenticated request returns `{ user, permissions, scope, personId, linkedPersonMissing }` (or equivalent); an unauthenticated request gets 401; the response never includes a raw JWT or the password hash.

**Definition of done:**
- [ ] `GET /api/auth/me` returns user + resolved permissions + scope fields, shaped to match N5's future needs
- [ ] Requires `requireAuth()` only, no module gate (documented why in the commit body)
- [ ] Added to N2.5's exemption list in the same phase (cross-reference, not a duplicate edit if N2.5 already lists it forward)
- [ ] `npx tsc --noEmit` and `npm test` clean

**N4.2 — `feat(nav): drive both sidebars from module permissions`**
- A `usePermissions()` hook over `/api/auth/me`. **Replace** the inline decode in `sidebar.tsx`; **add** gating to `mobile-sidebar.tsx`, which has none. Render nav from `MODULES` filtered by access, removing the hard-coded `ADMIN_LINKS`/`isAdmin` split and the hardcoded mobile list.

**Current behaviour:** quoted in full above — `sidebar.tsx` decodes the JWT itself and branches on `isAdmin`; `mobile-sidebar.tsx` has zero gating and a shorter, inconsistent link list that omits `/settings`, `/clients`, `/locations` entirely (a pre-existing content gap, separate from the security hole).

**Concrete traps:**
- `sidebar.tsx` is a **Server Component** (`async function Sidebar()`, no `"use client"` directive) while `mobile-sidebar.tsx` is `"use client"`. A single `usePermissions()` React hook cannot be called from `sidebar.tsx` as-is — either convert `Sidebar`'s nav-link filtering to a client sub-component that calls the hook, or fetch permissions server-side in `Sidebar` (via `requireAuth`/a direct resolved-permissions call, not through the client hook) and pass them down as props. Decide and state which, since "replace the inline decode" does not by itself resolve the server/client mismatch.
- `mobile-sidebar.tsx`'s `NAV_LINKS` (`:12-19`) is missing `/clients` and `/locations` compared to `sidebar.tsx`'s `BASE_LINKS` (`:22-30`) even before considering permissions — when both are replaced with "render nav from `MODULES` filtered by access", this existing content gap disappears automatically (both sidebars derive from the same `MODULES` list), which is worth confirming explicitly rather than assuming it "just works".
- Two independent `JWT_SECRET` `TextEncoder` instances exist today (`sidebar.tsx:8`, `proxy.ts:4`) — once `sidebar.tsx`'s inline `getRole()`/`jwtVerify` call is removed in favour of `usePermissions()`, confirm `sidebar.tsx` no longer imports `jose` or references `JWT_SECRET` at all (a leftover unused import fails `npm run lint`).
- `usePermissions()` must handle the loading/error state for both sidebars (a `useQuery` against `/api/auth/me` is async) — decide what renders while permissions are resolving (e.g. render `BASE_LINKS`-equivalent always-visible items immediately, gate only the admin-adjacent links) rather than either sidebar flashing empty then populating.

**Verification commands:**
```bash
npx tsc --noEmit
npm run lint
grep -n "jose\|JWT_SECRET" src/components/sidebar.tsx   # should be empty after this commit
```
Success: both sidebars render identical nav sets for identical permission profiles; a VIEWER-equivalent role with `Gebruikers: geen`/`Instellingen: geen` sees neither `/users` nor `/settings` in **either** sidebar (today only the desktop one hides them); `sidebar.tsx` no longer imports `jose`.

**Definition of done:**
- [ ] `usePermissions()` hook exists over `/api/auth/me`
- [ ] `sidebar.tsx`'s inline `getRole()`/`jose` decode removed entirely
- [ ] `mobile-sidebar.tsx` gated identically to `sidebar.tsx` — same link set for the same role
- [ ] Server/client boundary for `Sidebar` explicitly resolved (documented in commit body which approach was taken)
- [ ] `npx tsc --noEmit`, `npm run lint` clean; `jose`/`JWT_SECRET` grep in `sidebar.tsx` returns nothing

**N4.3 — `feat(auth): guard pages server-side and retire the legacy role column`**
- Per-page server-side checks plus a Dutch 403 page. **Recommendation: per-page checks, not `proxy.ts`** — the proxy runs on Edge and cannot reach Prisma for the matrix.
- Retiring `User.role` has a strict order, or the commit is red:
  1. Stop signing and returning it: `src/app/api/auth/login/route.ts:31` and `:39`.
  2. Remove `role` from `TokenPayload` (`src/lib/auth.ts:9`).
  3. Confirm no reader remains (`requireRole` is gone in N2.4; the sidebar decode in N4.2; `users/[id]/route.ts:27-33`'s self-promotion check must move to `roleId`).
  4. Only then drop the column from both schemas + `seed.ts`, and delete the stale `Role` union at `src/types/index.ts:8`.
  If that is more than one reviewable change, split it: `refactor(auth): stop signing role into the token` then `feat(db): drop the legacy role column`.
- **Verify:** a non-admin navigating to `/users` and `/settings` gets 403, not a page shell with data; the mobile menu no longer shows Gebruikers to a VIEWER.

**Files to read before starting:**
- `src/app/api/auth/login/route.ts` (whole file, 53 lines) — `role` is signed into the token at `:27-32` and echoed in the response body at `:34-40`; both must stop.
- `src/lib/auth.ts` (whole file, 18 lines) — `TokenPayload.role?: string` (`:9`) must be removed.
- `src/app/api/users/[id]/route.ts:27-29` — the self-promotion check (`if (body.role !== undefined && auth.id === userId)`) currently reads `auth.role`/`body.role`; per N1.4 this may already be dual-checking `roleId`, but this commit is where the **legacy** half of that check must be deleted, not just left dormant.
- `src/types/index.ts:8` — the `Role` union to delete once nothing imports it (confirm via `grep -rn "types.*Role\b\|from \"@/types\".*Role" src/` — note this must not false-match the unrelated `Role` **model** import from `@/generated/prisma` or a `RoleSelect` component name).
- `prisma/schema.prisma:15` / `prisma/schema.dev.prisma:15` — `role String @default("PLANNER")` on `User`, the column being dropped, in both files.
- `prisma/seed.ts:279-282` — the two seeded users' `role:` field, to remove once the column is gone.

**Current behaviour:** `role` is read from six distinct places today: the JWT payload (`auth.ts:9`), signed at `login/route.ts:31`, echoed at `login/route.ts:39`, decoded in `sidebar.tsx`'s `getRole()` (removed in N4.2), checked in the now-deleted `requireRole` (`api-auth.ts:13-25`, removed in N2.4), and read directly off `User.role` in `users/[id]/route.ts:27-29`'s self-promotion guard and `users/page.tsx:65`'s badge (fixed in N1.4, but confirm it now reads `roleId`/the role's label, not the legacy string, before this commit drops the column).

**Concrete traps:**
- **This is the second schema-changing commit in the phase and it is destructive** (`00-README.md`'s discipline: "a schema-changing commit lands alone") — it must be its own commit, separate from the token/payload changes per the brief's own instruction ("If that is more than one reviewable change, split it"). Given the number of readers involved (six, listed above), splitting into `refactor(auth): stop signing role into the token` then `feat(db): drop the legacy role column` is very likely necessary, not merely offered as an option.
- **Order matters and is strict, per the brief's own four-step list** (`02-phase1.md:239-243`) — dropping the column before confirming zero readers remain (step 3) produces `PrismaClientValidationError`s on any lingering `select: { role: true }`/`data: { role }` reference. `grep -rn "\.role\b" src/app/api/users prisma/seed.ts` (scoped to avoid false-matching `Person.role`/`PeriodPerson.role`, which are unrelated legacy free-text fields that survive this phase — see workstream L, phase 2, Q33) before dropping the column.
- **`Person.role` and `PeriodPerson.role` are unrelated to `User.role`** and must survive this commit untouched — they are the legacy free-text crew-role fields retired separately in phase 2 (Q33, workstream L). A broad find-and-delete on the string `role` across the schema or seed would wrongly touch these.
- Confirm `docker compose run --rm app sh -c "npx prisma migrate deploy"` (per `CLAUDE.md`'s validation step) succeeds against the dropped column — this is the second Postgres-only migration in the phase, and per N1.2's own trap, the `db` service publishes no port by default, so plan the same manual-verification workaround.

**Verification commands:**
```bash
grep -rn "\.role\b" src/app/api/users/ src/lib/auth.ts src/components/sidebar.tsx src/components/mobile-sidebar.tsx prisma/seed.ts
# expect zero hits referring to User.role after the column drop (Person.role / PeriodPerson.role hits elsewhere are fine and expected)
npx tsc --noEmit
npm run lint
npm test
docker compose up -d db
docker compose run --rm app sh -c "npx prisma migrate deploy"
```
Success: a non-admin (any role, including a custom one with `Gebruikers: geen`/`Instellingen: geen`) navigating directly to `/users` or `/settings` gets the Dutch 403 page, not the page shell; the mobile menu shows no "Gebruikers"/"Instellingen" entries for a VIEWER-equivalent role; the login response body and JWT no longer contain `role` (inspect with `jwt.io` or a manual decode); `User.role` no longer exists in either schema file, `prisma/seed.ts`, or any TS type; `types/index.ts`'s `Role` union is deleted.

**Definition of done:**
- [ ] Per-page server-side checks added for `/users` and `/settings`, with a Dutch 403 page
- [ ] Token/payload changes and the column drop are separate commits if the four-step retirement can't land as one green commit
- [ ] All six historical readers of `User.role` confirmed gone before the column drops (grep evidence in the commit body)
- [ ] `Person.role`/`PeriodPerson.role` (unrelated legacy fields) untouched
- [ ] Both schema files + `seed.ts` updated; `types/index.ts`'s `Role` union deleted
- [ ] `docker compose run --rm app sh -c "npx prisma migrate deploy"` succeeds against the drop
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

---

## N5 — Own-data-only scoping `design doc first`

**Branch:** `n5-own-data-scoping` · **after N4** · ✅ **`.plans/own-data-scoping-design.md` is written — read it in full; it is authoritative over this summary**

A freelancer sees only the projects/periods they are booked on. This is **data scoping, not module toggling** — every list query needs a filter, and one miss leaks the whole company's planning. `User.personId` (`prisma/schema.prisma:16`) is the link.

**Decided by the design doc + the PO (2026-08-15):**
- **Mechanism: an explicit `scopeFilter(user)` helper, not a Prisma client extension.** `src/lib/prisma.ts:13-17` is a `globalThis` singleton, so an extension cannot be request-scoped without `AsyncLocalStorage`, would silently reach the deliberately company-wide queries in `src/lib/availability.ts` and `src/lib/booking.ts`, and cannot see the raw `$executeRawUnsafe` at `booking.ts:37`.
- **Scope depth (Q54):** a scoped user sees **all periods** of any project they are booked on, not only their own periods.
- **Visible (Q53):** crew names + functions, crew phone/contact, the materials on the period, the client and location. **Plus (Q60): hide colleagues' home address and internal notes.**
- **No money at all** — composes with `src/lib/redact.ts` from N2.1.
- **Read-only (Q55):** `scope: own` denies every write regardless of the module matrix — including their own hours and travel costs. Enforce this **once, inside `requireModule()`**, so it cannot be forgotten per route.
- **Standalone catalogues are denied outright (Q59):** materials, people, clients, locations, functions, categories and documents carry no project/period FK, so they cannot be filtered. A scoped user gets a clear "geen toegang" on those pages; crew and equipment remain visible embedded in their own periods.
- **Own attesten are readable (decided 2026-08-15):** a scoped user reads their own person documents; everyone else's are denied. `/api/stats` is denied outright for `scope: own` regardless of the matrix.
- A scoped user requesting a project they are not booked on gets **404, not 403** (do not leak that the project exists).

**Files to read before starting (whole-N5 context):**
- `.plans/own-data-scoping-design.md` **in full** — restated here as absolutely required, not optional; the table below is a compression of its §5 for quick reference only, and its §1–§4 and §6–§10 reasoning (why `scopeFilter` beats a Prisma extension, the field-by-field visibility table, the no-linked-person handling, the 404-vs-403 reasoning) is not reproduced here.
- `prisma/schema.prisma:10-19` (`User.personId Int? @unique`) — the join key every scoping decision hangs off.
- `src/lib/availability.ts` and `src/lib/booking.ts` (both whole files) — confirmed by the design doc (§1.3) and independently by this brief's own N2 work: these two libraries **must never** receive a `scopeFilter` clause; they compute company-wide conflict/availability by design.
- Every route file already read and tabulated in N2.2–N2.4's tables above — N5 reuses that same file set; no new route files are introduced by N5 beyond `/api/auth/me` (N4.1, already read).

**Consolidated surface inventory (compressed from the design doc's §5 — the doc's own tables, per-module, remain authoritative for reasoning; verified against the same route files read for N2 above, 2026-08-15):**

| Route | Bucket | Filter / treatment for `scope: own` | What a scoped user sees |
|---|---|---|---|
| `GET /api/projects` (`projects/route.ts:13`) | (a) scoped | `where: { periods: { some: { people: { some: { personId } } } } }` | Only projects they're booked on, each with **every** period (not just their own) |
| `POST /api/projects` (`:28`) | (w) deny | read-only override in `requireModule` | 403 |
| `GET /api/projects/[id]` (`projects/[id]/route.ts:14`) | (a) scoped | same filter folded into `findUnique` | Own project in full; not-booked project → 404 |
| `PUT`/`DELETE /api/projects/[id]` (`:31,71`) | (w) deny | — | 403 |
| `POST /api/projects/[id]/periods` (`:7`), `PATCH`/`DELETE /api/periods/[id]` (`:7,26`) | (w) deny | no GET exists on these paths | 403 |
| `POST /api/periods/[id]/people` (`:9`), `PATCH`/`DELETE .../people/[assignmentId]` (`:8,38`), `POST /api/periods/[id]/materials` (`:9`), `PATCH`/`DELETE .../materials/[assignmentId]` (`:8,40`), `DELETE /api/periods/[id]/bundles/[bundleId]` (`:12`) | (w) deny | — | 403 (subsumes N2.2's field-level Kosten check — moot once the whole write is blocked) |
| `GET /api/people/available` (`:6`), `GET /api/materials/available` (`:15`) | (c)-like, deny | denied regardless of `Planning` level | 403 — whole-roster/whole-catalogue price disclosure, not owned data |
| `GET/POST /api/people` (`:10,30`), `PUT/DELETE /api/people/[id]` (`:12,64`) | (c)/(w) deny | — | 403 — crew visible only embedded in own periods |
| `GET/POST /api/people/[id]/documents` (`:9,21`), `GET/DELETE /api/documents/[id]` (`:7,25`) | (c) deny — **flagged for PO sign-off**, not a literal decided requirement | — | 403 |
| `GET/POST /api/functions` (`:13,26`), `PUT/DELETE /api/functions/[id]` (`:16,34`) | (c)/(w) deny | — | 403 — function names still arrive embedded via `PeriodPerson.role` |
| `GET/POST /api/materials` (`:13,85`), `GET/PUT/DELETE /api/materials/[id]` (`:14,33,79`) | (c)/(w) deny | — | 403 |
| `GET/POST /api/materials/[id]/stock-items` (`:7,45`) | (c) deny | **also a cross-project leak vector** — `assignments` include returns every period/project a unit has ever been booked into, including projects the caller isn't booked on | 403 |
| `GET/POST /api/materials/[id]/components` (`:18,34`), `PATCH/DELETE .../components/[componentId]` (`:16,38`), `PATCH/DELETE /api/stock-items/[id]` (`:7,23`), `GET/POST /api/categories` (`:16,30`), `PUT/DELETE /api/categories/[id]` (`:20,38`) | (c)/(w) deny | — | 403 |
| `GET/POST /api/clients` (`:23,37`), `GET/PUT/DELETE /api/clients/[id]` (`:27,43,62`), `GET/POST /api/locations` (`:20,34`), `GET/PUT/DELETE /api/locations/[id]` (`:24,40,58`) | (c)/(w) deny | — | 403 — own project's client/location arrive embedded via `clientRel`/`locationRel` |
| `PUT/DELETE /api/projects/[id]/prices/material/[materialId]` (`:7,35`), `.../person/[personId]` (`:7,35`) | (w) + money deny | — | 403 |
| `GET/POST /api/periods/[id]/people/[assignmentId]/travel` (`:20,35`) | money, deny GET too | GET denied outright regardless of `Kosten/Facturen` level — route returns nothing but money | 403 both |
| `PATCH/DELETE .../travel/[travelId]` (`:20,41`) | (w) + money deny | — | 403 |
| `GET/PUT/DELETE /api/settings`, `/api/settings/logo` | out of scope for the scoping mechanism | governed by module matrix only, not `scope` | Whatever `Instellingen` level says; note `settings/logo`'s `Instellingen: geen` interaction with print views (N2 subtlety 3) |
| Forward: `/api/auth/me` | n/a | surfaces `scope`, `personId`, `linkedPersonMissing` | — |
| Forward: `GET /api/stats` (K1, phase 3) | deny entirely | — | 403 regardless of matrix |
| Forward: `/api/calendar/` company feed (O1, phase 4) | deny entirely | re-checked per request, not only at token issue | 403 / feed refused |
| Forward: exports (P2, phase 4) | (a) scoped / (c) deny per same bucket rule | — | Bucket-a exports filtered; bucket-c exports 403, not an empty file |

**This table is a compression for quick reference only — the design doc's §5 per-module tables carry the full reasoning per row (e.g. why `people/[id]/documents` denial is flagged for explicit sign-off rather than treated as fully decided) and remain authoritative on any conflict.**

The design doc splits N5 into **six** commits, not four — it adds a money-override commit in `redact.ts` and a catalogue-denial commit. Follow the doc's sequence.

**N5.1 — `feat(auth): add scope to roles`** — surface `Role.scope` (added in N1.2) in the matrix UI; resolve it in `/api/auth/me`.

*Files to read:* N3.2's matrix UI component (once landed) — `scope` is a per-role toggle (`all`/`own`), not a per-module cell, so it needs its own control, not a fifth access level squeezed into the four-level select. *Current behaviour:* `Role.scope` exists in the schema since N1.2 but nothing reads or writes it anywhere (`grep -rn "\.scope\b" src/` returns nothing pre-N5). *Trap:* `/api/auth/me`'s response shape was already designed in N4.1 to include `scope`/`personId`/`linkedPersonMissing` — confirm those fields are populated here, not left as placeholders; a `personId: null` scoped user must get `linkedPersonMissing: true` computed as `scope === "own" && personId === null` (design doc §6), not left `false` by default. *Verify:* `npx tsc --noEmit`; `npm test -- auth-me roles`; toggling a role's scope in the matrix UI changes `/api/auth/me`'s response for a user with that role on their *next* request, no re-login. *DoD:* `[ ]` `Role.scope` editable in the matrix UI · `[ ]` `/api/auth/me` returns real `scope`/`personId`/`linkedPersonMissing` values · `[ ]` `npx tsc --noEmit` and `npm test` clean.

**N5.1b — `feat(auth): force money redaction under scope:own`** *(new commit, per the design doc's revised 6-commit sequence, `own-data-scoping-design.md:245` — not in the original 4-commit list above; this is the money-override commit the doc adds)*

- One-line addition to `redact.ts` (N2.1)'s money-visibility check: `const moneyVisible = access.scope !== "own" && hasLevel(access, "kosten_facturen", "lezen")` — `scope: own` forces the same code path as `Kosten/Facturen: geen`, **regardless of the role's actual configured level** (design doc §3).
- *Files to read:* `src/lib/redact.ts` (N2.1, by now landed) — the exact call site this one-liner touches. *Current behaviour:* N2.1's redaction checks only `Kosten/Facturen` level; scope does not yet exist as an input to that function. *Trap:* this must be tested against a **deliberately wide-open matrix** (`Kosten/Facturen: verwijderen`) to prove the override actually overrides rather than merely agreeing with a sensible default (design doc §7) — a test that only checks the `geen` case would pass even if this commit did nothing. *Verify:* `npx tsc --noEmit`; `npm test -- redact` with a case asserting a `scope: own` caller whose role holds `Kosten/Facturen: verwijderen` still receives zero money fields. *DoD:* `[ ]` money-override line added to `redact.ts` · `[ ]` test proves override fires even against `verwijderen` · `[ ]` commit body states explicitly that this *removes* an ability for a matrix configuration that would otherwise grant it (per `00-README.md:28`'s rule on commits that remove abilities) · `[ ]` `npx tsc --noEmit` and `npm test` clean.

**N5.2 — `feat(auth): scope project and period queries`** — `/api/projects` (list + `[id]`), `/api/projects/[id]/periods`, `/api/periods/*`.

*Files to read:* `src/app/api/projects/route.ts`, `projects/[id]/route.ts`, `projects/[id]/periods/route.ts`, `periods/[id]/route.ts` (all already read in full for N2.2). *Current behaviour:* post-N2.2 these are `requireModule`-gated but not scope-filtered; `projects/route.ts:18-21`'s `findMany` and `projects/[id]/route.ts:20-23`'s `findUnique` both query with no ownership filter. *Concrete traps:* per the design doc's narrowing (§8), `projects/[id]/periods/route.ts` (POST-only) and `periods/[id]/route.ts` (PATCH/DELETE-only) need **no new scoping code** — they're write-only and already covered by N1.3's centralised read-only rule; this commit's work there is limited to a *test* proving that rule fires, not new route code — do not write a redundant scope check on top of the already-centralised one. The one genuine new-code surface is `scopeFilter` on `projects/route.ts`'s `GET` and `projects/[id]/route.ts`'s `GET`, and the **404-not-403** handling on the latter (fold the ownership clause into the same `findUnique` `where`, so "not booked on it" and "doesn't exist" both produce `null` → `notFound()` through one code path, per design doc §7's reasoning — a bolted-on second query is both extra code and an extra place to get it wrong). *Verify:* `npx tsc --noEmit`; `npm run lint`; `npm test -- projects periods` — a `scope: own` user booked on project X and not Y: `GET /api/projects` lists X only; `GET /api/projects/[Y.id]` → 404; `GET /api/projects/[X.id]` → X with **every** period of X (not only the booked-on one — the design doc flags this as the most regression-prone assertion, §7). *DoD:* `[ ]` `scopeFilter` applied to `projects/route.ts` GET and `projects/[id]/route.ts` GET only · `[ ]` 404 (not 403) confirmed for a not-booked project, via the same query path as the not-found case · `[ ]` full period tree returned for an owned project, tested explicitly · `[ ]` `projects/[id]/periods` and `periods/[id]` confirmed covered by the centralised read-only rule via test, no redundant new code · `[ ]` `npx tsc --noEmit`, `npm run lint`, `npm test` clean.

**N5.2b — `feat(auth): deny catalogue-wide reads for scope:own`** *(new commit, per the design doc's revised sequence, `own-data-scoping-design.md:247`)*

- One mechanical rule ("if `scope === "own"`, `forbidden()` before touching Prisma, regardless of module level") applied across: `people/route.ts`, `people/[id]/route.ts`, `materials/route.ts`, `materials/[id]/route.ts`, `materials/[id]/stock-items/route.ts`, `materials/[id]/components/route.ts`, `clients/route.ts`, `clients/[id]/route.ts`, `locations/route.ts`, `locations/[id]/route.ts`, `categories/route.ts`, `categories/[id]/route.ts`, `functions/route.ts`, `functions/[id]/route.ts`, `people/[id]/documents/route.ts`, `documents/[id]/route.ts`.
- *Files to read:* the same 16 files already read and tabulated for N2.3 above — no new files. *Current behaviour:* post-N2.3 these are `requireModule`-gated at the module/level the caller's role happens to hold; none currently check `scope`. *Traps:* this is the largest single-commit file count in the phase (16 files) but is reviewable as one diff **only** because the rule is identical and mechanical everywhere — do not vary the check's wording or placement per file, or the "one rule, one diff" property that makes 16 files reviewable in one commit is lost. The `people/[id]/documents`/`documents/[id]` denial is explicitly flagged by the design doc (§10, risk 1) as "pending explicit PO sign-off" rather than a literally stated decision — implement it per the doc's recommendation, but note this in the commit body so the PO sees it was an inference, not a decision they made. *Verify:* `npx tsc --noEmit`; `npm run lint`; `npm test -- people materials clients locations categories functions documents` — a `scope: own` caller with a **deliberately wide-open** role (`verwijderen` on every listed module) still gets 403 on all 16, proving the deny is scope-driven, not level-driven. *DoD:* `[ ]` all 16 files deny outright for `scope: own`, tested against a wide-open matrix, not just a restrictive one · `[ ]` `people/[id]/documents`/`documents/[id]` denial flagged in the commit body as an inference pending PO sign-off · `[ ]` `npx tsc --noEmit`, `npm run lint`, `npm test` clean.

**N5.3 — `feat(auth): scope planning, dashboard and availability`** — planning views, dashboard counts, `people/available`, `materials/available`.

*Files to read:* `src/app/api/people/available/route.ts`, `materials/available/route.ts` (both already read in full for N2.2); `src/app/(app)/page.tsx` (dashboard, whole file — not yet read in this brief's verification pass, read it now); `src/app/(app)/planning/page.tsx:25-29` (already cited elsewhere in the round-2 plan as fetching `GET /api/projects` unfiltered). *Current behaviour (design doc §5, Dashboard):* the dashboard fetches `GET /api/projects`, `GET /api/people`, and `GET /api/materials` — once N5.2 scopes the first and N5.2b denies the latter two outright, the "Personen"/"Materialen" count tiles have **no legal data source** for a scoped user. *Concrete trap:* do not fetch the company-wide catalogues and hide the count client-side — that still leaks the true count over the network response even if the UI never renders it. Replace those two tiles for `scope: own` with something scope-native (e.g. a count of the user's own upcoming bookings), per the design doc's explicit recommendation. *Verify:* `npx tsc --noEmit`; `npm run lint`; `npm test -- planning dashboard available` — `people/available`/`materials/available` return 403 for `scope: own` regardless of `Planning` level (same wide-open-matrix test pattern as N5.2b); the dashboard renders with no network request for company-wide people/material counts when the caller is scoped. *DoD:* `[ ]` `people/available`/`materials/available` denied outright for `scope: own` · `[ ]` dashboard's Personen/Materialen tiles replaced with scope-native data, not hidden-but-fetched · `[ ]` planning page requires no code change (inherits scoping from N5.2), confirmed by test · `[ ]` `npx tsc --noEmit`, `npm run lint`, `npm test` clean.

**N5.4 — `test(auth): assert scoped endpoints filter`** — an enumeration test over the design doc's surface inventory, plus the no-linked-person case (a `scope: own` user with `personId` null sees nothing and is told why, rather than staring at an empty screen).

*Files to read:* the consolidated surface table above (and the design doc's §5/§7 in full) — this commit's job is to walk that exact list. *Concrete traps:* mirror N2.5's per-handler (not per-file) parsing discipline; the money-anywhere test must run **both** with `Kosten/Facturen: geen` and, deliberately, at `verwijderen` (design doc §7) to prove N5.1b's override actually overrides; the no-linked-person case must assert `[]` (not a 500, not an unfiltered list) from every bucket-(a) list route and `linkedPersonMissing: true` from `/api/auth/me` — test this against a **real** user row with `roleId` pointing at a `scope: own` role and `personId: null`, not a mocked payload, since the null-check must survive an actual Prisma round-trip. *Verify:* `npx tsc --noEmit`; `npm test -- scope-enumeration`. *DoD:* `[ ]` every row in the consolidated table above has a corresponding assertion · `[ ]` 404-vs-403 for project ownership explicitly tested · `[ ]` money-override tested against both `geen` and `verwijderen` · `[ ]` no-linked-person case tested against a real DB row · `[ ]` forward placeholders (`/api/stats`, `/api/calendar/`, exports) added as not-yet-existing entries so those phases cannot forget · `[ ]` `npx tsc --noEmit` and `npm test` clean.

**Forward note:** `/api/stats` (K1, phase 3), the ICS company feed (`/api/calendar/`, O1) and every export (P2) must honour scope too. Add them to the enumeration test as forward entries so those phases cannot forget.

---

## Phase 1 exit report

1. Branch + commit list per item.
2. **State explicitly that the matrix shipped fully open**, and whether the PO applied the recommended defaults (N3.3) — if not, the reported hole is still open.
3. The route × module × level table as built, with any deviation from the map above and why.
4. **Proof of redaction:** the assertion output showing a `Kosten/Facturen: geen` role receives a project payload with no money fields anywhere in the tree.
5. How `role`/`roleId` were kept in sync during the phase, and confirmation that the legacy column is gone by the end of N4.3.
6. Confirmation that the `functions/*` `TODO(L1)` markers are in place for phase 2.
7. What a PLANNER and a VIEWER can each still do, tested, so the PO can sanity-check against expectations.
