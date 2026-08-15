# Own-data-only scoping (N5) — design doc

> Status: draft for approval. Blocks N5 only; N1–N4 may proceed without this doc (`.plans/tasks-round2/02-phase1.md:6`).
> Source decisions: `.plans/2026-08-po-feedback-round2.md` Q40, C1 (own-data scoping in scope, matrix seeded fully open); `.plans/tasks-round2/02-phase1.md` N5 (`:248-262`) and N1–N4 (`:49-246`).
> No implementation code below — this settles the mechanism, the exhaustive surface, and the edge cases per the phase-1 brief's requirement (`02-phase1.md:6,254`).

## 0. Decided requirements this doc must satisfy (verbatim from the brief, not re-litigated)

1. A scoped ("own") user sees only projects they are booked on via `User.personId` → `PeriodPerson`.
2. A scoped user sees **all periods** of a project they are booked on, not just their own periods.
3. Within those, they see: fellow crew names + functions, crew phone/contact details, the materials on the period, and the client + location details.
4. They see **no money at all** anywhere — no rates, discounts, travel costs, totals — composing with the Phase-1 redaction layer (`src/lib/redact.ts`, N2.1).
5. A scoped user is **read-only**, including their own hours/travel costs. `scope: own` overrides the module matrix for writes.
6. The company-wide ICS feed must never be issued to a scoped role; `/api/stats` and every export must honour scope.

---

## 1. Mechanism: explicit `scopeFilter(user)` vs a global Prisma extension

### 1.1 The two options

**Option A — Prisma client extension (`$extends` with a `query` component)** that inspects the model name and injects a `where` clause on every `findMany`/`findFirst`/`findUnique` call for scoped models (`Project`, and by extension anything reachable from it).

**Option B — an explicit `scopeFilter(user): Prisma.ProjectWhereInput | undefined` helper**, called by hand inside the small, enumerated list of routes that need it, composed into the existing `where` with `{ ...baseWhere, ...(scopeFilter(user) ?? {}) }`.

### 1.2 Recommendation: **Option B, the explicit helper.**

### 1.3 Why B fails safe and A does not, in this codebase specifically

**`prisma` is a single `globalThis` singleton, not a per-request client** (`src/lib/prisma.ts:13-17`): `export const prisma = globalForPrisma.prisma ?? new PrismaClient(...)`. Any `$extends()` applied to it is applied **once, at module load, for the whole process** — it cannot know which HTTP request is currently in flight unless request identity is threaded through `AsyncLocalStorage`. That threading is not free:

- Every code path that queries through `prisma` — including `src/lib/availability.ts` and `src/lib/booking.ts`, which **deliberately** query across every booking in the company regardless of who is asking (`checkPersonAvailability` at `availability.ts:78-105` finds *any* conflicting `PeriodPerson` for a `personId`; `findAvailableStockItems` at `availability.ts:10-42` and `bundleAvailableCount` at `:44-76` compute company-wide stock availability) — would silently run inside whatever `AsyncLocalStorage` context happens to be active. If a request-scoping context is not explicitly cleared before calling into `availability.ts`/`booking.ts`, a global extension keyed on model name (`Project`, `Period`, `PeriodPerson`, `PeriodStockItem` are all reachable from a scoped `Project` query) would filter out the very rows availability checking is *supposed* to see. **A missed unset is a correctness bug in double-booking prevention, not just a data-visibility bug** — exactly the "silently break unrelated queries" failure mode the brief warns about.
- `booking.ts` also issues raw SQL directly: `tx.$executeRawUnsafe(...pg_advisory_xact_lock...)` (`booking.ts:37`). Prisma extensions' `query` component wraps model operations; it does not see `$executeRaw`/`$queryRaw` calls at all. An extension-based scheme is therefore **inconsistent by construction** — model reads get filtered, raw SQL does not — which is its own fail-unsafe property: a reviewer skimming for "is scoping applied" cannot tell from the extension's presence alone whether a given code path is covered.
- To scope only *some* callers (the list-y routes) and not others (`availability.ts`, `booking.ts`, the seed script, seed-adjacent scripts), the extension needs either a second, unscoped client instance (at which point you have written as much wiring as Option B, plus two clients to keep straight) or a context flag that every route must remember to set — which is the same "one missed call site" risk the brief attributes to the explicit approach, except now the default-open/default-closed choice for "context not set" has to be made globally and wrongly for someone: default-closed breaks `availability.ts`/`booking.ts` (which never set it, because they must never be scoped); default-open leaks for any scoped route that forgets to set it.

**The explicit helper has one failure mode — a route that should scope but doesn't — and it is directly testable**: N5.4's enumeration test (§7) walks the exact route list in §5 and asserts each one calls `scopeFilter`. There is no equivalent single test for "does the extension's implicit context ever leak or get skipped", because the failure surface is the entire call graph, not an enumerable list of route files.

**Where `scopeFilter` is applied vs never applied:**

| Code | Ever pass through `scopeFilter`? | Why |
|---|---|---|
| `src/lib/availability.ts` (`findAvailableStockItems`, `bundleAvailableCount`, `checkPersonAvailability`, `checkStockItemSameProject`) | **Never** | These compute conflicts/availability across the whole company by design — round-1 Q16 half-open interval logic (`availability.ts:28,65,92,125`) already relies on seeing every booking. Scoping this would let two people double-book each other purely because a scoped viewer's query hid the conflicting row. |
| `src/lib/booking.ts` (`bookFlatMaterial`, `bookBundleMaterial`, `lockMaterials`, `freeStockItemIds`) | **Never** | Same reason, plus these paths are write paths that a scoped user cannot reach anyway (§3) — but even if called on a scoped user's behalf by an admin-side reservation, correctness requires the full picture. |
| Route handlers in the surface inventory (§5, bucket **a**) | **Yes, explicitly, one line each** | `GET /api/projects`, `GET /api/projects/[id]` (and the forward `/api/stats`, ICS company feed, exports) are the only places "what does this viewer own" is a meaningful question. |

### 1.4 Shape of `scopeFilter` (signature only, no implementation)

```
scopeFilter(access: { scope: "all" | "own"; personId: number | null }): Prisma.ProjectWhereInput | undefined
```

- `scope === "all"` → returns `undefined` (spread as `...(scopeFilter(access) ?? {})`, a no-op).
- `scope === "own"` and `personId` set → returns `{ periods: { some: { people: { some: { personId } } } } }`, applied **only at the `Project` level** — never additionally applied to the `periods`, `people`, or `materials` sub-`include`s, per decided requirement 2 (a matched project's full period tree is returned unfiltered by this clause; only field redaction, §4, prunes it further).
- `scope === "own"` and `personId === null` → returns a where-fragment that can never match (or the caller short-circuits before querying at all — see §6). Never falls back to "no filter".

`access` is resolved once per request (same DB round-trip that resolves module permissions per N1.3's "resolve once at the top, pass down" rule, `02-phase1.md:85`) so `scopeFilter` and `requireModule` read a consistent snapshot of the same role row.

---

## 2. Where scope is resolved

- `Role.scope` (added by N1.2) is read server-side on every request, **never cached, never taken from the JWT** — identical reasoning to N1.3's permission resolution (`02-phase1.md:85`: "a matrix change must apply on the next request, not after re-login"). A downgrade from `all` to `own` must take effect immediately.
- The JWT continues to carry only enough for cheap nav rendering (existing pattern, `auth.ts:5-10`); authorisation and scoping are both resolved from the database inside the request.
- `GET /api/auth/me` (N4.1) returns the resolved `{ role, permissions, scope, personId, linkedPersonMissing }` so the client hook (`usePermissions()`, N4.2) can drive UI affordances — but the server remains authoritative per N4.3's existing rule ("no client-side check is the only thing protecting data", `02-phase1.md:224`).

---

## 3. The read-only rule: where it is enforced, and which wins

**Decided: `scope: own` implies read-only, full stop, regardless of the role's module levels.** This must be enforced in **exactly one place** so no route can forget it.

**Enforcement point: inside `requireModule(module, level)` itself** (`src/lib/api-auth.ts`, added in N1.3, sits beside the existing `requireRole` at `api-auth.ts:13-25`). Every route already calls this function first (it is the mandated pattern, `02-phase1.md:552,559` and the per-commit checklist at `00-README.md:40`). The rule:

> After resolving the caller's `RolePermission` row for `module`, if the **requested** `level` is `wijzigen` or `verwijderen` (i.e. not a `GET`) **and** the caller's `Role.scope === "own"`, return `forbidden()` — irrespective of what `RolePermission.access` says for that module.

This is the same "which wins" answer for both money and write access: **`scope: own` overrides the matrix, not the other way round.** A future admin who accidentally grants a scoped "Freelancer" role `Projecten: verwijderen` does not thereby grant it delete rights — `requireModule` still refuses, because the scope check runs after (and vetoes) the level check, in the one function every route already calls.

**Composition with money (extends the same principle to field visibility):** decided requirement 4 says a scoped user sees **no money anywhere**, not "no money unless their role happens to have `Kosten/Facturen: lezen`". So the redaction layer must apply the same override: `redact.ts` (N2.1) strips money fields when the caller lacks `Kosten/Facturen: lezen` **or** when `scope === "own"`, whichever is true — i.e. scope forces an *effective* `Kosten/Facturen: geen` for redaction purposes, regardless of the row's actual configured level. Concretely: `const moneyVisible = access.scope !== "own" && hasLevel(access, "Kosten/Facturen", "lezen")`. This is a one-line addition to the existing redaction call site, not a new mechanism (§4 details exactly which fields this affects).

**UI affordances:** `usePermissions()` (N4.2) should expose an `effectiveLevel(module)` helper that returns `min(matrixLevel, scope === "own" ? "lezen" : matrixLevel)`, so every existing "can I show the edit button" check in the UI (edit/delete icons on projects, people, materials, the booking editors, `LinePricePopover`, `PersonTravelEditor`) gets the right answer automatically without each component needing its own scope-awareness. This is client-side affordance only; §1–3 already make the server authoritative.

---

## 4. What is visible in detail — field-by-field against `project-include.ts`

`src/lib/project-include.ts:3-31` is the tree returned by `GET /api/projects` and `GET /api/projects/[id]` (`projects/route.ts:20`, `projects/[id]/route.ts:22`). Every field below is walked against the decided visible set (§0.3–0.4). "Strip" means N2.1's `redact.ts` removes/zeroes it under the money-override (§3); a second, independent list ("privacy strip", new to N5) removes fields that are not money but are outside the decided visible set.

| Include path | Field | Keep / Strip | Reason |
|---|---|---|---|
| `clientRel` (`project-include.ts:4`) | `name`, `contactName`, `email`, `phone`, `address`, `postalCode`, `city` | **Keep** | Decided: "client + location details" — a scoped crew member needs the client's site contact. |
| `clientRel` | `vatNumber` | Keep | Not money (no rate/amount); not on N2.1's redaction key list either. |
| `clientRel` | `notes` (`schema.prisma:31`) | **Strip (privacy, new)** | Free-text internal remarks about the commercial relationship — outside the decided "client details" set; no legitimate crew use. |
| `locationRel` (`:5`) | `name`, `address`, `postalCode`, `city`, `phone` | **Keep** | Needed for logistics — this is exactly what the callsheet already prints (`callsheet/page.tsx:66-86`). |
| `locationRel` | `notes` | **Strip (privacy, new)** | Same reasoning as `Client.notes`. |
| `periods[].materials[]` = `PeriodStockItem` (`:9-16`) | `id`, `periodId`, `stockItemId`, `bundleBookingId` | Keep | Structural keys, not money. |
| `periods[].materials[]` | `dayPriceSnapshot`, `setupCostSnapshot`, `discountPct`, `discountAmount` | **Strip (money)** | Already on N2.1's key list (`02-phase1.md:171`). |
| `…stockItem` | `id`, `unitNumber`, `identifier`, `notes` | Keep | Physical-unit identity needed for a pack list. |
| `…stockItem.material` | `name`, `category`, `categoryId`, `code`, `notes`, `isBundle`, `categoryRel` | Keep | Materials on the period — decided visible. |
| `…stockItem.material` | `dayPrice`, `setupCost`, `bundlePriceOverride` | **Strip (money)** | On N2.1's key list. |
| `periods[].people[]` = `PeriodPerson` (`:17-20`) | `id`, `periodId`, `personId`, `role` | Keep | Fellow crew + function (legacy `role` field until L2 lands `functionId` in phase 2 — same treatment applies to `functionId`/`Function.name` then). |
| `periods[].people[]` | `dayPriceSnapshot`, `discountPct`, `discountAmount` | **Strip (money)** | On N2.1's key list. |
| `…person` (`Person`) | `name`, `role`, `email`, `phone` | **Keep** | Decided: "crew names + functions, crew phone/contact details". |
| `…person` | `address`, `postalCode`, `city`, `country` | **Strip (privacy, new)** | Home address of a fellow freelancer is not "contact details" — the existing callsheet, the one document this data is genuinely needed for, never renders it (`callsheet/page.tsx:105-115` prints only name/role/times/phone). Minimise to what the app itself already treats as operationally necessary. |
| `…person` | `dayPrice` | **Strip (money)** | On N2.1's key list. |
| `…travelCosts[]` = `PersonTravelCost` | entire array | **Strip (money) — drop the array, not just `unitCost`** | Decided: "no travel costs" at all. Leaving `{label, quantity}` behind without `unitCost` is both meaningless and still discloses that a travel arrangement exists; suppress the whole array. |
| `periods[].bundleBookings[]` = `PeriodBundleBooking` (`:21-26`) | `id`, `periodId`, `materialId`, `quantity` | Keep | |
| `periods[].bundleBookings[]` | `dayPriceSnapshot` | **Strip (money)** | |
| `…material`, `…material.components[].child` | Same `Material` rules as above | Keep name/category/code/notes/isBundle; strip `dayPrice`/`setupCost`/`bundlePriceOverride` | |
| `materialPrices[]` = `ProjectMaterialPrice[]` (`:29`) | **entire array** | **Strip (money) — return `[]`, not a redacted copy** | This array's only content beyond ids is a per-project commercial override; even the fact that "material X has a custom price on this project" is commercial information. No partial-keep makes sense. |
| `personPrices[]` = `ProjectPersonPrice[]` (`:30`) | **entire array** | **Strip (money) — return `[]`** | Same reasoning. |

**Implementation note carried into N2.1/N5.1 (not a new mechanism, but a gap to close):** `src/types/index.ts` types these money fields as non-nullable `number` (e.g. `PeriodStockItem.dayPriceSnapshot: number`, `:180`). Returning `null` for a scoped payload breaks that contract; returning `0` is indistinguishable from a genuinely free line. `redact.ts` should **omit the array-level items entirely** where the whole record is commercial (`materialPrices`, `personPrices`, `travelCosts` — return `[]`) and, for scalar fields nested inside otherwise-kept records (`dayPriceSnapshot` on a kept `PeriodStockItem`), the type needs a scoped variant (`| null`, with UI components already null-guarding, e.g. `LinePricePopover`) — flagged as an open risk in §9, since it is N2.1's mechanism that N5 inherits and depends on, not something N5 invents.

---

## 5. Complete surface inventory

Bucket key: **(a)** naturally filterable by `scopeFilter` (project → period → booking ownership) · **(b)** never independently queried — visible only nested inside a bucket-(a) payload · **(c)** standalone catalogue-wide read/write with no per-project ownership concept — **denied outright for `scope: own`, regardless of the role's module level** (the module matrix cannot express "my own materials" for a model that has no `projectId`/`periodId`, so the only safe answer is deny) · **(w)** write endpoint, denied for `scope: own` purely by the read-only rule (§3), independent of bucket.

### Projecten

| Route | Methods | Bucket | Filter / treatment | What a scoped user sees |
|---|---|---|---|---|
| `projects/route.ts` (`:13,28`) | GET, POST | GET **(a)**, POST **(w)** | GET: `where: { periods: { some: { people: { some: { personId } } } } }` | GET: only projects they're booked on, each with **every** period (decided req. 2), fields per §4. POST: 403 always. |
| `projects/[id]/route.ts` (`:14,31,71`) | GET, PUT, DELETE | GET **(a)**, PUT/DELETE **(w)** | GET: same filter folded into the `findUnique` where; no match → `null` → `notFound()` (see §6 for 404-vs-403). | GET of own project: full period tree, redacted fields. GET of a project not booked on: 404. PUT/DELETE: 403 always. |
| `projects/[id]/periods/route.ts` (`:7`) | POST | **(w)** | n/a (no GET exists on this path) | 403 always. |
| `periods/[id]/route.ts` (`:7,26`) | PATCH, DELETE | **(w)** | n/a (no GET exists on this path) | 403 always. |

### Planning

| Route | Methods | Bucket | Filter / treatment | What a scoped user sees |
|---|---|---|---|---|
| `periods/[id]/people/route.ts` (`:9`) | POST | **(w)** | — | 403 always. |
| `periods/[id]/people/[assignmentId]/route.ts` (`:8,38`) | PATCH, DELETE | **(w)** | — | 403 always (subsumes N2's field-level Kosten check — moot once the whole write is blocked). |
| `periods/[id]/materials/route.ts` (`:9`) | POST | **(w)** | — | 403 always. |
| `periods/[id]/materials/[assignmentId]/route.ts` (`:8,40`) | PATCH, DELETE | **(w)** | — | 403 always. |
| `periods/[id]/bundles/[bundleId]/route.ts` (`:12`) | DELETE | **(w)** | — | 403 always. |
| `people/available/route.ts` (`:6`) | GET | **(c)-like, deny** | Deny for `scope:own` regardless of `Planning` level | 403. A read-only user has no booking workflow this endpoint serves; it is also a whole-roster + price disclosure (`people:available:34-37` returns `dayPrice`/`basePrice`/`hasOverride` for every person in the company). |
| `materials/available/route.ts` (`:15`) | GET | **(c)-like, deny** | Same as above | 403. Same reasoning — whole-catalogue availability computation, not owned data. |
| Planning page (`planning/page.tsx:25-29`) | — | inherits **(a)** | Fetches `GET /api/projects` unfiltered today (`:26`) | Once `/api/projects` is scoped, the page automatically shows only booked projects. I2/I3 (phase 3) must preserve this — already flagged as a forward dependency in `02-phase1.md:312` ("Respect N5 scoping"). |

### Personen

| Route | Methods | Bucket | Treatment | What a scoped user sees |
|---|---|---|---|---|
| `people/route.ts` (`:10,30`) | GET, POST | **(c)** | Deny GET and POST for `scope:own` | 403. `Person` carries no project/period FK (`schema.prisma:127-143`) — there is no "my own people" query to express. Crew is visible only embedded per §4. |
| `people/[id]/route.ts` (`:12,64`) | PUT, DELETE | **(c)/(w)** | Deny | 403 (both bucket-c and read-only rule apply). |
| `people/[id]/documents/route.ts` (`:9,21`) | GET, POST | **(c), deny** | Deny entirely | 403. `PersonDocument` (attesten/contracts) is not in the decided visible set (§0.3) and is sensitive personal data of colleagues — no stated crew use case. **Flagged for explicit PO sign-off**, since it is an inference beyond the literal decided list, not a directly stated requirement. |
| `documents/[id]/route.ts` (`:7,25`) | GET, DELETE | **(c), deny** | Deny | 403, same reasoning. |
| `functions/route.ts` (`:13,26`) | GET, POST | **(c), deny** | Deny standalone catalogue | 403. Function **names** for a scoped user's own crew still arrive embedded via `PeriodPerson.role` today (`callsheet/page.tsx:109`, `person-split-editor.tsx:151`) and via `PeriodPerson.functionId → Function.name` once L2 lands (phase 2) — no standalone `/api/functions` call is needed for that. Rates arrive on this model in phase 2 (L1) — already flagged `TODO(L1)` in N2 (`02-phase1.md:137-138`); once added they are money and follow §3's override regardless of this route being denied. |
| `functions/[id]/route.ts` (`:16,34`) | PUT, DELETE | **(c)/(w)** | Deny | 403. |

### Materialen

| Route | Methods | Bucket | Treatment | What a scoped user sees |
|---|---|---|---|---|
| `materials/route.ts` (`:13,85`) | GET, POST | **(c), deny** | Deny | 403. Materials on a scoped user's period arrive embedded (§4); the standalone catalogue is company-wide. |
| `materials/[id]/route.ts` (`:14,33,79`) | GET, PUT, DELETE | **(c)/(w)** | Deny | 403. |
| `materials/[id]/stock-items/route.ts` (`:7,45`) | GET, POST | **(c), deny** | Deny | 403. **Also a direct cross-project leak vector**: this route's `assignments` include (`stock-items/route.ts:16-37`) returns every period/project a given physical unit has ever been booked into — including projects the scoped user is not booked on. Denying the whole route is simpler and safer than trying to filter the nested `assignments` array. |
| `materials/[id]/components/route.ts` (`:18,34`) | GET, POST | **(c), deny** | Deny | 403. |
| `materials/[id]/components/[componentId]/route.ts` (`:16,38`) | PATCH, DELETE | **(w)** | Deny | 403. |
| `stock-items/[id]/route.ts` (`:7,23`) | PATCH, DELETE | **(c)/(w)** | Deny | 403. |
| `categories/route.ts` (`:16,30`) | GET, POST | **(c), deny** | Deny | 403. |
| `categories/[id]/route.ts` (`:20,38`) | PUT, DELETE | **(w)** | Deny | 403. |
| Materials labels page (`materials/labels/page.tsx`) | — | **(c), deny** | No route access → page has nothing to render | Not a scoped-user surface; out of scope for N5 beyond ensuring the underlying `materials`/`categories` reads it depends on are denied. |

### Klanten / Locaties

| Route | Methods | Bucket | Treatment | What a scoped user sees |
|---|---|---|---|---|
| `clients/route.ts` (`:23,37`) | GET, POST | **(c), deny** | Deny | 403. Reveals **every** client company-wide, including ones unrelated to the scoped user. Their own project's client arrives embedded via `clientRel` (§4). |
| `clients/[id]/route.ts` (`:27,43,62`) | GET, PUT, DELETE | **(c)/(w)** | Deny | 403. |
| `locations/route.ts` (`:20,34`) | GET, POST | **(c), deny** | Deny | 403. Same reasoning; own project's location via `locationRel`. |
| `locations/[id]/route.ts` (`:24,40,58`) | GET, PUT, DELETE | **(c)/(w)** | Deny | 403. |

### Kosten/Facturen

| Route | Methods | Bucket | Treatment | What a scoped user sees |
|---|---|---|---|---|
| `projects/[id]/prices/material/[materialId]/route.ts` (`:7,35`) | PUT, DELETE | **(w) + money** | Deny (both rules apply) | 403. |
| `projects/[id]/prices/person/[personId]/route.ts` (`:7,35`) | PUT, DELETE | **(w) + money** | Deny | 403. |
| `periods/[id]/people/[assignmentId]/travel/route.ts` (`:20,35`) | GET, POST | **money, deny GET too** | Deny GET outright regardless of `Kosten/Facturen` level (§3 money-override); POST denied by read-only rule | 403 on both — this route returns nothing but money (`label`, `unitCost`, `quantity`), so there is no partial-keep. |
| `periods/[id]/people/[assignmentId]/travel/[travelId]/route.ts` (`:20,41`) | PATCH, DELETE | **(w) + money** | Deny | 403. |
| Forward: `J2b` invoices (phase 3) | all | **deny module entirely** | A scoped role's `Kosten/Facturen` access is always treated as `geen`, so no invoice route should ever return data to it, independent of matrix configuration. Record now so J2b's design doesn't have to re-derive it. | — |

### Gebruikers / Instellingen

Out of scope for the scoping *mechanism*: `User` and `Setting` carry no project/period ownership concept, so `scope` does not apply to them structurally — access is governed purely by the module matrix, which the PO configures directly (a "Freelancer" role would ordinarily have both at `geen`). One cross-reference: `GET /api/settings/logo` is deliberately **not exempt** and sits at `Instellingen: lezen` (N2 subtlety 3, `02-phase1.md:158,166`) because pakbon/callsheet print views fetch it; if a scoped role's `Instellingen` access is `geen`, its own-project print views will 404 on the logo. N2's own brief already calls this "a matrix configuration problem, not a reason to leave the route ungated" — N5 does not need to solve it, only to note the interaction for N3.3's recommended-defaults design.

### Cijfers (forward, K1, phase 3)

`GET /api/stats` — **deny entirely for `scope: own`, regardless of matrix**, same reasoning as invoices: aggregate company revenue/utilisation figures have no "my own" reading a freelancer has legitimate use for, and every figure on that page is money-shaped. Record now per the phase-1 brief's forward-note instruction (`02-phase1.md:261`).

### Dashboard

`src/app/(app)/page.tsx` fetches `GET /api/projects` (`:23`, becomes bucket-a scoped — free), `GET /api/people` (`:25`, bucket-c denied) and `GET /api/materials` (`:27`, bucket-c denied). **This breaks the dashboard for a scoped user unless N5.3 adjusts it**: the "Personen" and "Materialen" count tiles have no legal data source once those two routes are denied. Recommendation for N5.3: for `scope: own`, replace those two tiles (or the whole stats row) with something scope-native — e.g. a count of the user's own upcoming bookings — rather than fetching company-wide catalogues and hiding the number client-side (which would still leak the count via the network response). The "Aankomende projecten" list (`page.tsx:34-36,90-119`) needs no change beyond the already-scoped `/api/projects`.

### Forward: ICS feeds (O1, phase 4)

- Personal "my shifts" feed: appropriate for `scope: own` by construction (already the strictest possible scope — one person's bookings). Depends on `User.personId` non-null; ties to §6.
- Company-wide feed: **must never be issued to a `scope: own` role**, per the decided requirement. Enforce at two points, not one: (i) the settings screen that issues/reveals a feed token must refuse to generate a company-feed token for a scope-own role; (ii) the feed-serving route itself must re-check the token owner's *current* scope on every request (not only at issue time) — consistent with N1.3's "no caching, resolve on every call" doctrine, so that a role changed to `scope: own` *after* a token was issued cannot keep using it.

### Forward: exports (P2, phase 4)

Apply the same bucket classification used in this doc: exports of `Project`/booking data go through `scopeFilter` (bucket a); exports of `Person`/`Material`/`Client`/`Location` catalogues are bucket (c) — denied for `scope: own`, not silently filtered to an empty file. The phase-4 brief's own acceptance criterion ("an own-scoped user's export contains only their own data", `02-phase1.md` roadmap `P2`) is satisfied for bucket-a exports and is superseded by an outright 403 for bucket-c ones.

---

## 6. The no-linked-person case

A `scope: own` user whose `User.personId` (`schema.prisma:16`) is `null` has no booking to filter by. Decided behaviour: **sees nothing, and is told why** — not an unexplained empty screen.

- `scopeFilter` is never asked to "try" a null `personId` against the database — the calling route short-circuits: if `access.scope === "own" && access.personId == null`, return the empty result (`[]` for list routes, `notFound()`-shaped response is wrong here since there's nothing to look up — return `[]`/empty, not 404) **without querying**, and set a response-level marker consumed by the client.
- `GET /api/auth/me` (N4.1) surfaces `linkedPersonMissing: true` explicitly (derived from `scope === "own" && personId === null`) so every scoped page can render one consistent banner — e.g. *"Je account is nog niet gekoppeld aan een persoon — neem contact op met de beheerder."* — instead of each page inventing its own "no data" empty state.
- This mirrors O1's own stated requirement for the personal ICS feed ("surface a clear message when an account has no linked person", `02-phase1.md:595` in the source roadmap) — one shared signal (`linkedPersonMissing`), reused by the dashboard, planning, projects list, and the personal feed, rather than four bespoke checks.

---

## 7. Enforcement + tests

**N5.4's enumeration test**, mirroring N2.5's pattern of asserting per exported handler rather than per file (`02-phase1.md:187`): walk the route table in §5 and, for every row not marked "n/a", assert:

- **Bucket (a) GET routes**: calling as a `scope: own` user booked on project X and not on project Y returns X in the list and not Y; calling `GET /projects/[Y.id]` returns 404 (see below); calling `GET /projects/[X.id]` returns X with **every** period of X present (not just the one the user is booked on) — this specific assertion is the one most likely to regress into "only my periods", since it is the least intuitive of the decided requirements.
- **Bucket (c) and (w) routes**: calling as a `scope: own` user (any matrix level, including a deliberately-misconfigured `verwijderen`) returns 403.
- **Money-anywhere test**: reuse N2.1's "walk the JSON, don't eyeball it" technique (`02-phase1.md:175`) against every bucket-(a) response for a `scope: own` caller, asserting none of the money keys from §4's table appear anywhere in the tree — run this **both** with the role's `Kosten/Facturen` at `geen` and, deliberately, at `verwijderen`, to prove the money-override in §3 actually overrides rather than merely agreeing with a sensible default.
- **No-linked-person test**: a `scope: own` user with `personId: null` gets `[]` from every bucket-(a) list route (not a 500, not an unfiltered list) and `linkedPersonMissing: true` from `/api/auth/me`.
- **Forward placeholders** (so the exemption/coverage list cannot silently go stale, per N2.5's own reasoning): `/api/stats`, `/api/calendar/*` (company feed), and each phase-4 export route are added to the same enumeration **as soon as they exist**, each asserted 403 for `scope: own`.

### Decided: a scoped user requesting a project they are **not** booked on, by id, gets **404, not 403**

Reasoning:
1. **Least information disclosure.** A 403 confirms "this project exists but you can't see it" — for a freelancer, that leaks the existence and numeric id-space of other clients' bookings, which a 404 ("nothing here") does not.
2. **Free implementation, not an extra check.** Folding the ownership clause directly into the same `findUnique`/`findFirst` `where` used for the id lookup means "not booked on it" and "doesn't exist" produce the *same* Prisma result (`null`) through the *same* code path (`notFound()`), with no separate `if (!isOwnedByCaller)` branch to forget. A bolted-on 403 would require a second query (fetch unfiltered, then check ownership, then 403) — more code, and a second place to get the check wrong.
3. **Consistent with the rest of the codebase's style** — every existing route already reaches for `notFound()` on a missing/mismatched id (`categories/[id]/route.ts:47`, `clients/[id]/route.ts:36`, `locations/[id]/route.ts:33`, etc.); this is not a new pattern.

---

## 8. Implementation order, mapped onto N5.1–N5.4

The phase-1 brief's four commits (`02-phase1.md:256-259`) cover the bulk of this design, but two of this doc's findings don't fit cleanly into any of the four as titled — proposing **two additional, narrowly-scoped commits** rather than overloading N5.1/N5.3, per the repo's "one logical change per commit" rule (`00-README.md:13`).

| Commit | Scope (as briefed / as revised) |
|---|---|
| **N5.1** | As briefed: surface `Role.scope` in the matrix UI; resolve it in `/api/auth/me` alongside `linkedPersonMissing` (§6). |
| **N5.1b — new** `feat(auth): force money redaction under scope:own` | One-line addition to `redact.ts`'s money-visibility check (§3): `scope === "own"` forces the same code path as `Kosten/Facturen: geen`, regardless of the role's actual configured level. Small, independently reviewable, and the commit body should state explicitly that this *overrides* the matrix — the PO reads commit bodies (`00-README.md:28`) and this is exactly the kind of "removes an ability" change that rule calls out. |
| **N5.2** | As briefed, narrowed by this doc's findings: `GET /api/projects` (list) and `GET /api/projects/[id]` get `scopeFilter` (§1.4, §5). `/api/projects/[id]/periods` (POST) and `/api/periods/[id]` (PATCH/DELETE) need **no new scoping logic** — they are write-only routes already covered by the centralised read-only rule (§3); N5.2's job there is limited to confirming `requireModule`'s scope-override (built in N1.3/§3) actually fires, via a test, not new route code. |
| **N5.2b — new** `feat(auth): deny catalogue-wide reads for scope:own` | The bucket-(c) denials in §5: `people`, `materials` (+ `stock-items`, `components`), `clients`, `locations`, `categories`, `functions`, `people/[id]/documents`, `documents/[id]`. One commit, one mechanical rule ("if `scope === own`, `forbidden()` before touching Prisma, regardless of module level") applied across a named list of routes — reviewable as a single diff because the rule is identical everywhere it's applied. |
| **N5.3** | As briefed, scoped precisely: `people/available` and `materials/available` denied outright for `scope: own` (§5, Planning bucket); the dashboard's Personen/Materialen tiles reworked per §5's Dashboard note; planning page requires no code change (inherits scoping from N5.2). |
| **N5.4** | As briefed: the enumeration test in §7, including the 404-vs-403 assertion, the money-override assertion (tested against a deliberately wide-open matrix), the no-linked-person assertion, and the forward placeholders for `/api/stats` / ICS / exports. |

Six commits instead of four; the split keeps each one's diff mechanically checkable against a single rule stated in its own body, rather than N5.1 quietly also changing redaction semantics or N5.3 quietly also denying six unrelated catalogue routes.

---

## 9. Out of scope

- Building `/api/stats`, the ICS feeds, or the export routes themselves — this doc only records the scoping rule they must follow when their own phases build them (§5 forward sections).
- `PeriodPerson.functionId` / rate fields on `Function` (L1/L2, phase 2) — the redaction key list in §4 will need the same two additions N2's own `TODO(L1)` already flags (`02-phase1.md:137-138`); no new mechanism.
- Deciding the exact null-vs-omit representation of a redacted scalar money field in the TypeScript contract (§4's implementation note) — that is N2.1's mechanism; N5 only adds keys to its list and is blocked by the same open question N2.1 already has.
- Changing `person-split-editor.tsx`, `material-split-editor.tsx`, or any other booking-editor component to hide their controls for `scope: own` — that is UI affordance work driven by `usePermissions()` (§3), sequenced with N4.2, not a new N5 concern.

## 10. Open risks

1. **Bucket-(c) denial is broader than the decided list literally states.** The brief's decided requirements describe what a scoped user *does* see; this doc infers what they must *not* see (whole-company `Person`/`Material`/`Client`/`Location` catalogues, `PersonDocument`) by elimination. The `PersonDocument` denial in particular (§5, Personen) is flagged for explicit PO sign-off rather than treated as settled — it is a reasonable inference, not a stated decision.
2. **Redaction's null-vs-omit contract is unresolved** (§4's implementation note) and is shared with N2.1; if N2.1 lands with a different convention (e.g. sentinel `0` instead of omission), N5's field list must be re-verified against whatever N2.1 actually ships, not against this doc's assumption.
3. **`Instellingen: geen` breaking print views for a scoped role** (§5, Gebruikers/Instellingen) is real but explicitly out of N5's remit per N2's own subtlety-3 ruling; it needs to be caught by whoever writes N3.3's recommended-defaults copy, or a scoped freelancer's callsheet print silently loses the company logo.
4. **`functions` rates arriving in phase 2** change the money surface of a currently name-only model; the `TODO(L1)` marker (N2) is the tracking mechanism, and this doc's field table (§4) will need a corresponding row added at that time — noted here so the phase-2 worker doesn't have to rediscover the scoping angle from scratch.
5. **Six commits instead of four** (§8) is a deviation from the phase-1 brief's stated commit count for N5; flagged for the reviewer to confirm the split is worth the extra review overhead before N5 starts.
