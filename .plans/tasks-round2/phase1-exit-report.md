# Phase 1 exit report

RBAC + own-data scoping, all planned items (N1–N5) implemented, 24 commits, on `main` (each item's branch fast-forward merged, no squashing, branches deleted after merge). `npx tsc --noEmit`, `npm run lint`, `npm test` (343 tests + 3 forward `it.todo()` placeholders, SQLite dev DB) are green after every commit.

## 1. Branch and commit list per item

| Item | Branch (merged, deleted) | Commits |
|---|---|---|
| N1 — Roles, module registry, permission model (`DDL`) | `n1-roles-module-registry` | 6: `02935ea` module registry, `b977302` Role/RolePermission schema + migration, `cd17117` resolve permissions per request, `51b71d9` fix role-assignment validation + admin badge, `20be177` assign roles from the roles table, `6c4d066` end-to-end permission resolution test |
| N2 — Redaction + enforcement sweep | (continued on same branch) | 5: `e536975` redact commercial fields, `1a5b9af` guard project/planning routes, `817da4f` guard people/materials/client/location routes, `5d9fcc3` guard cost/user/settings routes, `e4dfb33` AST test asserting every handler declares a module guard |
| N3 — Roles and matrix UI (+ N4.1 built ahead of schedule) | (continued) | 4: `3676723` manage custom roles, `121739d` `/api/auth/me` (N4.1, built early — N3.2's own-access warning needed it), `6abdc5d` permission matrix editor, `9c1ac51` open-permissions banner + recommended defaults |
| N4.2 — Sidebar/nav driven by permissions | `n4-page-guards` | 1: `90df5a5` |
| N4.3 — Server-side page guards + retire legacy role | (continued on `n4-page-guards`) | 3: `f829a60` Dutch 403 page + guard `/users`/`/settings`, `a51c4a5` stop signing role into the JWT, `b962179` drop the legacy `User.role` column |
| N5 — Own-data-only scoping | `n5-own-data-scoping` | 6: `56bbf9a` scope on roles + read-only override, `81aab62` force money redaction under scope:own, `15fb0d8` scope project/period queries, `ade456b` deny catalogue-wide reads, `1a3419c` scope planning/dashboard/availability, `051152e` enumeration test (+ found-and-fixed travel-cost GET gap) |

## 2. The matrix shipped fully open — still true, nothing tightened yet

Decision C1 (round-2 PO feedback) seeded all three system roles (ADMIN/PLANNER/VIEWER) with `verwijderen` on every one of the 10 modules — confirmed still the case in `prisma/seed.ts` and untouched by any phase-1 commit. **This means PLANNER and VIEWER currently have identical effective permissions to ADMIN** on every module in the matrix (see §7 below). N3.3 built the tooling to change this (the open-permissions banner, the recommended-defaults diff/apply dialog, and a fully custom matrix editor) but nothing in this phase applied it — that is explicitly a PO action, not something this phase does on the PO's behalf. **This is the single most important open item for the PO to act on before relying on the matrix for anything:** log in as `admin@rentflow.dev`, go to Instellingen, and either accept the recommended defaults or configure the matrix by hand. Until then, every user with a system role can read and write everything, including money.

## 3. Route × module × level table — built as specified, two deviations

Every route in N2's own map (`02-phase1.md` N2.2–N2.4 tables) was gated exactly as specified: `requireModule(module, level)` per handler, verified by the AST-based `route-guards.test.ts` (N2.5) which parses each handler's own body rather than checking file-level text presence.

Deviations from the brief, both reasoned in their commit bodies at the time:
1. **Redact-then-serialize order (N2.1):** the brief's literal wording was "redact then serialize"; this was inverted (serialize, then redact) because Prisma's `Decimal` fields are non-nullable at the type level and can't be set to `null` pre-serialization without an unsafe cast. Documented as a deliberate deviation, not a silent change.
2. **Two money-leak gaps closed beyond the brief's stated 16-file list (N2.3):** `materials/[id]/components/route.ts`'s GET and `materials/[id]/components/[componentId]/route.ts`'s PATCH both returned unredacted `dayPrice`/`setupCost`/`bundlePriceOverride` on nested `child`/`component.child` — same shape as the `stock-items` gap the brief did flag. Found and closed in the same commit.

A third, more serious gap was found later, during N5.4 (own-data scoping, not the original N2 sweep): `periods/[id]/people/[assignmentId]/travel/route.ts`'s GET never called `redactMoney()`/`moneyVisible()` at all — it's the raw source of travel-cost money, not a payload those functions strip fields from. A `scope: own` role with `Kosten/Facturen: lezen` granted (a plausible misconfiguration, not even the wide-open default) would have seen full travel costs, since N5.1's read-only override only vetoes `wijzigen`/`verwijderen`, never `lezen`. Fixed in the same commit that found it (`051152e`), with an explicit `if (access.scope === "own") return forbidden();`.

## 4. Proof of redaction

`src/lib/redact.test.ts` builds a fixture project tree with every money field from N2's inventory table populated (including a bundle booking and a travel cost) and recursively walks the redacted result asserting **zero** money keys survive anywhere — not a hand-written per-field assertion list, so a field added later to `project-include.ts` without a matching redaction rule fails this test instead of silently leaking. Verified output (`npx vitest run src/lib/redact.test.ts --reporter=verbose`):

```
✓ redactMoney > is a no-op when the caller has Kosten/Facturen access
✓ redactMoney > strips every money field for a caller with Kosten/Facturen: geen
✓ redactMoney > strips every money field for a caller with no kosten_facturen permission at all
✓ redactMoney > preserves non-money fields (names, quantities, ids) unredacted
✓ redactMoney > strips every money field for scope: own even against Kosten/Facturen: verwijderen
✓ moneyVisible > true for lezen/wijzigen/verwijderen, false for geen or unset
✓ moneyVisible > false for scope: own regardless of the caller's kosten_facturen level (N5.1b)
✓ findRejectedMoneyWrite > rejects a dayPrice write without Kosten/Facturen: wijzigen
✓ findRejectedMoneyWrite > allows a dayPrice write with Kosten/Facturen: wijzigen
✓ findRejectedMoneyWrite > allows a write with no money fields present, regardless of access
✓ findRejectedField (N2.2) > a caller without Kosten access can still edit role on a person booking
✓ findRejectedField (N2.2) > the same caller is rejected for discountPct on a person booking
✓ findRejectedField (N2.2) > a material booking PATCH also rejects resnapshotPrice without Kosten access
✓ findRejectedField (N2.2) > a material booking PATCH with Kosten/Facturen: wijzigen allows all three fields

Test Files  1 passed (1)
     Tests  14 passed (14)
```

The `scope: own` case is tested specifically against `Kosten/Facturen: verwijderen` (the widest possible grant), not just `geen` — a test that only checked `geen` would pass even if the N5.1b override did nothing.

## 5. `role`/`roleId` sync during the phase — legacy column confirmed gone

- **N1.2** added `Role`/`RolePermission`/`User.roleId` alongside the existing `User.role String`, deliberately **not** dropping the old column mid-phase — every reader (`requireRole`, the sidebar's role decode, the self-promotion check) still depended on it at that point.
- **N1.4** kept the two in sync via `resolveRoleAssignment()`, with one restriction: while both columns existed, `roleId` could only be pointed at a **system** role (`isSystem: true`) — assigning a custom role was rejected with a Dutch message explaining the restriction was temporary. This meant custom roles could be *created* and *configured* (matrix-wise) throughout N1–N3, just not *assigned to a user*, until N4.3.
- **N2** replaced every remaining `requireRole`/role-string authorization check with `requireModule()` (reading from `roleId → Role.permissions`, never the legacy string) — by the end of N2, `User.role` was informational only, read solely by the login route (for the JWT) and a couple of display fallbacks.
- **N4.3** (3 commits) retired it for good: guarded `/users`/`/settings` server-side first, then stopped signing `role` into the JWT, then dropped the column itself (`ALTER TABLE "User" DROP COLUMN "role"`, `roleId` promoted from optional to required) — and, since the legacy string was gone, lifted N1.4's system-role-only restriction in the same commit (`resolveRoleAssignment()` now accepts any `roleId`, custom roles included).
- **Confirmed gone:** `grep -rn "\.role\b" src/` today matches only `Person.role`/`PeriodPerson.role` (unrelated legacy free-text crew-role fields, never in scope for this work) and the Prisma-generated `prisma.role.*` client calls (the new `Role` model, not the old column). No reader of the dropped column remains.

## 6. `functions/*` `TODO(L1)` markers — in place

`src/app/api/functions/route.ts` and `functions/[id]/route.ts` both carry `TODO(L1)` comments (added in N2.3) flagging that phase 2's `Function.dayRate`/`hourRate` fields will need the same redaction/write-rejection treatment once they exist. Confirmed present and unchanged by N5 (own-data-scoping-design.md §9 explicitly notes this is the tracking mechanism it defers to, not a new N5 concern).

## 7. What a PLANNER and a VIEWER can each still do — tested against the current (fully open) matrix

Because the matrix has not been tightened (§2), **PLANNER and VIEWER can currently do everything ADMIN can**, module-wise — every system role holds `verwijderen` on all 10 modules. The one thing that varies by role today is **scope**, not the matrix: a role's `scope` field (`all` by default) is a separate, PO-configurable toggle, and none of the three seeded system roles has been switched to `own` — that's expected to be configured on a new "Freelancer"-style custom role, not on PLANNER/VIEWER themselves.

So, concretely, until the PO tightens the matrix:
- **PLANNER** can create/edit/delete projects, periods, bookings, people, materials, clients, locations, categories, functions, users, and settings, and sees all money figures (Kosten/Facturen: verwijderen).
- **VIEWER** can do the exact same things today — the "Viewer" label does not yet mean read-only in practice, because nothing has set its matrix row to `lezen`.

This is the expected, documented state of a freshly-seeded fully-open matrix (§2) — not a bug in this phase's work. The PO should treat "apply the recommended defaults" (which does set PLANNER to `wijzigen` everywhere except `kosten_facturen`/`gebruikers`/`instellingen`, and VIEWER to `lezen` everywhere) as the very next action, separate from and after this phase's code.

## 8. Own-data scoping (N5) — what a `scope: own` role sees today

No system role is currently `scope: own` — this only takes effect once the PO creates a custom role (e.g. "Freelancer") and sets its scope via the roles table's new "Zichtbaarheid" selector (N5.1). Once one exists and a user is linked to it:
- Sees only the projects they're booked on via `User.personId`, with **every** period of an owned project (not only the one they're personally on) — proven against a real SQLite database in `scope-enumeration.integration.test.ts`, not a mock.
- Sees fellow crew names/functions/phone, the period's materials, and the client/location — but never a colleague's home address, internal notes, or any money field, regardless of what the matrix's `Kosten/Facturen` level says for their role (N5.1b's override).
- Is read-only everywhere, enforced once inside `requireModule()` (N5.1) rather than per-route.
- Gets `403` on every standalone catalogue (people/materials/clients/locations/categories/functions + the two `available` endpoints) and on the travel-cost endpoint even at `lezen` — proven by the static enumeration test (`scope-enumeration.test.ts`, 55 assertions).
- Can still read their own uploaded attesten (`people/[id]/documents`, `documents/[id]`) but not anyone else's — the one place N5 uses an ownership check instead of a blanket deny, per the design doc's resolved 2026-08-15 decision.
- A user with `scope: own` and no linked person (`personId: null`) gets an empty result from every list route (never a 500, never an unfiltered list) and `linkedPersonMissing: true` from `/api/auth/me` — also proven against a real database row, not a mocked payload.

Forward placeholders (`/api/stats`, the ICS company feed, phase-4 exports) are recorded as `it.todo()` entries in `scope-enumeration.test.ts` so those phases cannot silently forget the scoping rule they must follow.

## 9. Environment caveats (unchanged from phase 0)

No Docker/Postgres daemon and no live browser session were available in this execution environment for the whole of phase 1, same as phase 0. Every Postgres-only step (the two hand-authored migrations in this phase — `add_roles_permissions`, `drop_legacy_user_role`) was validated by re-reading the SQL against the schema diff, not by running `prisma migrate deploy` against a live Postgres instance. All functional verification was done via `npx tsc --noEmit` (both Prisma schemas), `npm run lint`, and `npm test` against the local SQLite dev DB, stated honestly in each commit rather than overclaimed.
