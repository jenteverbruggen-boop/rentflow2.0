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

**N1.3 — `feat(auth): resolve module permissions per request`**
- `requireModule(module: ModuleKey, level: AccessLevel)` in `src/lib/api-auth.ts`, beside the existing `requireRole` (leave that until N2 has removed its last caller).
- **Resolve from the database on every call. Do not add a cache.** The existing `requireRole` (`api-auth.ts:13-25`) already re-queries per call and that is the right pattern here: it is one indexed lookup, and a matrix change must apply on the *next request*, not after re-login (7-day tokens). **Do not use React `cache()`** — route handlers are not part of a Server Component render pass, so it does not reliably scope per request and risks serving stale permissions across requests. If a handler needs the permission set more than once, resolve it once at the top and pass it down within that request.
- The JWT keeps carrying the role for nav rendering only; never trust it for authorisation.
- Return `forbidden()` (`api-auth.ts:31-36`). Keep the `.catch(() => null)` call pattern so route code stays uniform.
- **Verify:** unit tests — each level satisfies those below; unknown module fails closed; user with no role fails closed; downgrading a role blocks the *next* call with no re-login.

**N1.4 — `fix(users): validate role assignment and fix the admin badge`**
- `POST /api/users` / `PATCH /api/users/[id]`: accept `roleId`, validate it exists (zod + existence check), reject unknown with `badRequest`. **Also close the pre-existing hole**: the legacy `role` string currently accepts anything — validate or stop accepting it.
- **Keep `role` and `roleId` in sync while both columns exist.** Between N1.2 and N4.3, authorisation still partly flows through the legacy string (`requireRole` in `api-auth.ts:13-25`, the sidebar decode at `sidebar.tsx:38-39`, the self-promotion check at `users/[id]/route.ts:27-33`). If `roleId` points at a custom role with no legacy equivalent, either refuse it until N4.3 or map it to the nearest system string — **pick one and state it in the commit body**, otherwise a user's effective access silently diverges from the matrix for the rest of the phase.
- Fix the lower-case comparison at `users/page.tsx:65`.

**N1.5 — `feat(users): assign roles from the roles table`**
- Without this, custom roles — the headline decision of this phase — are reachable only by raw API call. `src/components/user-form.tsx` hardcodes three `SelectItem`s (`:62-64`) and posts a string.
- Convert `RoleSelect` to fetch `GET /api/roles` and submit `roleId`; update `src/hooks/use-users.ts`, the `User` type in `src/types/index.ts`, and the users table's role column to show the role label.
- Requires `GET /api/roles` — if N3.1 has not landed yet, add the read-only endpoint here and let N3.1 extend it.

**N1.6 — `test(auth): cover permission resolution end to end`**
- Fully-open seed grants everything; a role downgraded to `lezen` blocks writes on the next call; `geen` blocks reads; a custom role behaves exactly like a system role.

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

**N2.2 — `feat(auth): guard project and planning routes`**
- `projects/*`, `periods/*` (bookings, bundles, availability), including subtlety 1's field-level check.

**N2.3 — `feat(auth): guard people, materials, client and location routes`**
- `people/*`, `documents/*`, `functions/*` (+ `TODO(L1)`), `materials/*`, `stock-items/*`, `categories/*`, `clients/*`, `locations/*`.

**N2.4 — `feat(auth): guard cost, user and settings routes`**
- `projects/[id]/prices/*`, travel routes, `users/*`, `settings/*`, `settings/logo` per subtlety 3. Remove now-dead `requireRole` calls; delete `requireRole` itself **only when it has no callers left** — if anything still needs it (login is exempt and does not use it), say why in the body. Deleting it while a caller remains is a red commit.

**N2.5 — `test(auth): assert every handler declares a module guard`**
- Walk `src/app/api/**/route.ts` and assert **per exported handler**, not per file — several files export 2–3 methods (`materials/route.ts` GET+POST, `clients/[id]/route.ts` GET+PUT+DELETE), so a file-level "contains the string `requireModule`" check would pass a file where only one method is guarded. Parse the exported functions individually.
- Exemption list: `auth/login`, `auth/logout`, `auth/register`, plus forward entries `auth/me` (N4.1) and the ICS feed prefix **`/api/calendar/`** (O1, phase 4 — pinned in both briefs so this test cannot go red when O1 merges). **`settings/logo` is not exempt** (subtlety 3).
- Without the exemption list the test is unsatisfiable — login cannot require a permission, and `/api/auth/me` is how a client *discovers* its permissions, so gating it is circular.
- Failure message must name the file, the handler and what to add.

**Out of scope:** UI gating (N4), scoping (N5), any behaviour change beyond authorisation and redaction.

---

## N3 — Roles and matrix UI

**Branch:** `n3-permission-ui` · runs parallel with N2 · skill: `design`

`src/app/(app)/settings/page.tsx` is 14 lines and composes `SettingsForm` + `LogoUpload`. Add the permissions section as its own components — do not inline (150-line limit).

**N3.1 — `feat(settings): manage custom roles`**
- List/create/rename/delete roles. `isSystem` roles are renameable but not deletable. Deleting a role with users assigned is refused with a clear message (mirror `src/app/api/functions/[id]/route.ts:44`, which blocks deletion while people are linked).
- API: `GET/POST /api/roles`, `PUT/DELETE /api/roles/[id]` under **Gebruikers** (roles are about who may do what — keep it with user administration, and make N2's map agree).

**N3.2 — `feat(settings): edit the role × module permission matrix`**
- Modules as rows, roles as columns, a four-level select per cell. Invalidate the permission query on save so the change is visible immediately.
- **Self-lockout guard — must cover both administrative modules and must check user reachability:**
  - Refuse a save that would leave **no role holding `Instellingen: verwijderen`** *and* refuse one leaving **no role holding `Gebruikers: verwijderen`**. Locking Gebruikers is just as terminal: nobody can then reassign roles to recover.
  - Check that **an actual user** can still reach each of those permissions — join through `User.roleId`. Counting `RolePermission` rows alone is defeated by an unassigned throwaway role holding the permission while every real user's role is stripped.
  - Warn before a change that removes the current user's own access.

**N3.3 — `feat(settings): warn about open permissions and offer recommended defaults`** ← **required, not optional**
- A visible banner while any role exceeds the recommended baseline: *"Alle rollen hebben momenteel volledige toegang."*
- One-click **"pas aanbevolen standaarden toe"** showing a diff before applying: VIEWER = `lezen` everywhere; PLANNER = `wijzigen` everywhere except `Kosten/Facturen`, `Gebruikers`, `Instellingen` (`geen`); ADMIN = `verwijderen` everywhere.
- This commit is what actually closes the hole the PO reported. Without it the phase installs a mechanism nobody turns on.

---

## N4 — Server-side page guards and the client hook

**Branch:** `n4-page-guards` · **after N2**

Today `/users` and `/settings` are `"use client"` with **no server guard** (`users/page.tsx` 126 lines, `settings/page.tsx` 14 lines), and `src/proxy.ts:9-27` only verifies the JWT signature — no role logic. A non-admin navigating directly sees the page shell, the whole user list and all company settings.

Two different nav components, in two different states:
- `src/components/sidebar.tsx:10-20` decodes the JWT inline (`getRole()`) → `isAdmin` (`:39`) → hides `/users` and `/settings` (`:51-54`).
- `src/components/mobile-sidebar.tsx:12-19` has **no gating whatsoever** — `NAV_LINKS` hardcodes `/users` ("Gebruikers") for every role. This is a live hole today, not something to "replace".

**N4.1 — `feat(auth): add /api/auth/me`**
- Returns the current user, resolved permissions and scope. On N2.5's exemption list (it is the discovery endpoint) but still requires authentication.

**N4.2 — `feat(nav): drive both sidebars from module permissions`**
- A `usePermissions()` hook over `/api/auth/me`. **Replace** the inline decode in `sidebar.tsx`; **add** gating to `mobile-sidebar.tsx`, which has none. Render nav from `MODULES` filtered by access, removing the hard-coded `ADMIN_LINKS`/`isAdmin` split and the hardcoded mobile list.

**N4.3 — `feat(auth): guard pages server-side and retire the legacy role column`**
- Per-page server-side checks plus a Dutch 403 page. **Recommendation: per-page checks, not `proxy.ts`** — the proxy runs on Edge and cannot reach Prisma for the matrix.
- Retiring `User.role` has a strict order, or the commit is red:
  1. Stop signing and returning it: `src/app/api/auth/login/route.ts:31` and `:39`.
  2. Remove `role` from `TokenPayload` (`src/lib/auth.ts:9`).
  3. Confirm no reader remains (`requireRole` is gone in N2.4; the sidebar decode in N4.2; `users/[id]/route.ts:27-33`'s self-promotion check must move to `roleId`).
  4. Only then drop the column from both schemas + `seed.ts`, and delete the stale `Role` union at `src/types/index.ts:8`.
  If that is more than one reviewable change, split it: `refactor(auth): stop signing role into the token` then `feat(db): drop the legacy role column`.
- **Verify:** a non-admin navigating to `/users` and `/settings` gets 403, not a page shell with data; the mobile menu no longer shows Gebruikers to a VIEWER.

---

## N5 — Own-data-only scoping `design doc first`

**Branch:** `n5-own-data-scoping` · **after N4** · ⛔ **requires `.plans/own-data-scoping-design.md` approved**

A freelancer sees only the projects/periods they are booked on. This is **data scoping, not module toggling** — every list query needs a filter, and one miss leaks the whole company's planning. `User.personId` (`prisma/schema.prisma:16`) is the link.

The design doc must settle, before code: the mechanism (a Prisma extension injecting a where-clause globally versus an explicit `scopeFilter(user)` per query — and which fails safe); the exhaustive surface inventory; and the edge cases (does a scoped user see the other crew on their own period? their rates? the project's client/location? other periods of the same project? costs anywhere?).

**N5.1 — `feat(auth): add scope to roles`** — surface `Role.scope` (added in N1.2) in the matrix UI; resolve it in `/api/auth/me`.
**N5.2 — `feat(auth): scope project and period queries`** — `/api/projects` (list + `[id]`), `/api/projects/[id]/periods`, `/api/periods/*`.
**N5.3 — `feat(auth): scope planning, dashboard and availability`** — planning views, dashboard counts, `people/available`, `materials/available`.
**N5.4 — `test(auth): assert scoped endpoints filter`** — an enumeration test over the design doc's surface inventory, plus the no-linked-person case (a `scope: own` user with `personId` null sees nothing and is told why, rather than staring at an empty screen).

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
