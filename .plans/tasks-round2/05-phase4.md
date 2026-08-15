# Phase 4 — Calendar feeds, data export/import, cleanup

> Read `00-README.md` first. Source decisions: `.plans/2026-08-po-feedback-round2.md` (Q41, Q42, Q44a/b, Q45a, Q49, Q49b, Q33).
> **v2 — one adversarial review round folded in (8 findings, 2 high-severity).**
> 5 items, ~16 commits. Mostly optional/nice-to-have — the PO's core asks are done by the end of phase 3.
> **Gate to start:** phase 3 merged · ✅ **`.plans/data-import-export-design.md` is written — read it in full; it is authoritative over this summary**.

## Order

**This phase contains TWO schema-changing commits — O1.1 (feed tokens) and L4.2 (drop legacy role columns) — so they must be serialised**, and both touch `prisma/seed.ts`. Run O1 first, then L4; a single worker owns `seed.ts` across both, or O1 and L4 are assigned to the same person.

```
O1 (ICS feeds: O1.1 = schema)  ──►  L4 (retire role: L4.2 = schema)
P2 (exports) ──► P3 (import + replace, design doc first)
Y2 (storage façade)             [optional — no consumer this round]
```

## Inherited obligations

1. **Every new route needs `requireModule(...)`** or N2.5's enumeration test fails — except the ICS feed, which was registered as a **forward exemption** in N2.5's list (it is token-authenticated, not cookie-authenticated).
2. **N5 scoping** (`.plans/own-data-scoping-design.md`): the ICS *company* feed and every export must honour scope. Both were registered as forward entries in N5.4's enumeration test.
3. **Y1's serializer + `src/lib/redact.ts`** apply to exports — an export must not become a way around the module matrix or the money redaction.

---

## O1 — ICS calendar feeds

**Branch:** `o1-ics-feeds`

Decided: **subscription feeds only** (Q41 — no OAuth, no scheduler), and **both** a personal "my shifts" feed and a company-wide feed (Q42).

### Current state (verified)

- **Zero outbound HTTP calls exist** anywhere; all 75 `fetch(` uses in `src/` target the app's own routes. No `googleapis`, no `axios`.
- No `externalId`/`googleEventId`/`syncedAt`/`icalUid` column on any model.
- `Period` carries `name`, `startDate`, `endDate` (`prisma/schema.prisma:115-125`); location lives on the parent `Project`.
- `src/proxy.ts` redirects unauthenticated requests to `/login` (`:17,23`) — an **HTML redirect**, which is wrong for a calendar client. Exemption happens either via `PUBLIC_API_PREFIX` (`:7`) or the matcher's negative lookahead (`:31`).
- Round-1 recorded inconsistent date parsing and legacy midnight timestamps as a known hazard.

**O1.1 — `feat(db): add revocable calendar feed tokens`**
- Schema (both files + seed): a random, unguessable token per user per feed kind — e.g. `User.calendarTokenPersonal String? @unique` and `User.calendarTokenCompany String? @unique`, or a small `CalendarFeed { id, userId, kind, token @unique, createdAt }` table if you prefer one row per feed (preferred: it makes revoke-and-reissue trivial).
- **Never reuse the JWT as a feed token** — it would sit in a URL, in Google's logs, and in browser history, and it cannot be revoked.
- Tokens are generated with `node:crypto` randomness, not `Math.random`.

**O1.2 — `feat(calendar): serve a personal ICS feed`**
- `GET /api/calendar/[token].ics` resolving the token to a user + feed kind. Emit valid iCalendar: `VCALENDAR` wrapper, one `VEVENT` per period the user's linked person is booked on, `SUMMARY` (project + period name), `DTSTART`/`DTEND` in UTC with a `VTIMEZONE` block, `LOCATION` from the parent project, `DESCRIPTION`, a **stable `UID` per period**, and `SEQUENCE` incremented when the period changes.
- Use the assignment's own hours (H1's `startAt`/`endAt`) when set, else the period window.
- **Route path: `src/app/api/calendar/[token]/route.ts`** — *not* `[token].ics`. A folder literally named `[token].ics` is not a Next.js dynamic segment and would only ever match the literal string. Serve the `.ics` identity via headers: `Content-Type: text/calendar; charset=utf-8` and `Content-Disposition: inline; filename="rentflow.ics"`.
- Exempt in `proxy.ts`. **Note `PUBLIC_API_PREFIX` is a scalar string** (`const PUBLIC_API_PREFIX = "/api/auth"` at `:7`, checked with `startsWith` at `:14`) — there is no list to append to. Convert it to an array (mirroring `PUBLIC_PATHS` at `:6,12`) and add `/api/calendar`, or extend the matcher's negative lookahead at `:31`. The route authenticates by token itself and must return a **JSON/plain 401 or 404 — never an HTML redirect**, which is what `proxy.ts:17,23` currently does.
- **Pin the exempt prefix as `/api/calendar/`** — phase 1's N2.5 exemption list and N5.4 forward entry reference this exact prefix, so it must match byte-for-byte or that test goes red the moment O1 merges.
- **iCalendar generation:** nothing in the repo emits iCalendar today and no library is installed. Prefer hand-rolling it — the format is line-oriented text and one `VEVENT` per period is modest — but if you add a library, justify it in the commit body (same rule as M1.1's parser).
- **Apply the Time rule:** verify emitted times against **Postgres**, and check the result in a real calendar client. An off-by-one-timezone feed is worse than no feed. Legacy periods store midnight timestamps — confirm a full-day period renders sensibly rather than as a zero-length event.
- **Personal feed requires `User.personId`.** When it is null, return a calendar containing a single explanatory event (or a clear 409) rather than an empty file that looks broken.

**O1.3 — `feat(calendar): serve a company-wide ICS feed`**
- All projects/periods. **Gate it:** issue a company token only to users whose role has the appropriate module access, and **never to an own-scoped role** (N5) — a freelancer subscribing to the company feed would defeat the scoping built in phase 1.
- Because a token in a URL cannot be re-checked against a changing matrix on every poll, **revoke the token when a user's role or scope changes**. State how you do this in the commit body — it is the one place where the feed model and the permission model can silently diverge.

**O1.4 — `feat(settings): manage calendar feed links`**
- Show the user their feed URL(s) with copy-to-clipboard, a revoke-and-reissue action, and the honest caveat in Dutch: **Google refreshes external feeds on its own schedule, often only every few hours** (Apple/Outlook poll more often). Set expectations here or it will be reported as a bug.

**Out of scope:** OAuth, two-way sync, writing to Google, push notifications. That is O2/O3, which the PO parked (Q41).

### O1 — implementation depth

**Files to read before starting**

| File | Why |
|---|---|
| `src/proxy.ts` (33 lines, quoted in full below) | The file O1.2/O1.3 must edit; shows exactly why an HTML redirect is currently unavoidable for any unauthenticated request. |
| `prisma/schema.prisma:10-18` (`User`), `:74-83` (`Project`), `:115-125` (`Period`) | Exact current shape O1.1 extends — confirms no feed-token column exists yet and that `location` (string) / `locationRel` (FK) live on `Project`, not `Period`. |
| `prisma/schema.dev.prisma` | SQLite mirror; O1.1 is a schema commit and both files move together (project convention). |
| `prisma/seed.ts` | O1.1 must seed at least one feed token per seeded user (and per kind) so O1.2/O1.3 have something to hit against the dev DB without hand-inserting rows. |
| `src/lib/auth.ts` (17 lines) | Shows exactly what the JWT (`signToken`/`verifyToken`, `jsonwebtoken`, 7-day `expiresIn`) is — the concrete reason it must never double as a feed token: no revoke path, 7-day blast radius, ends up in a calendar client's URL history. |
| `src/lib/api-auth.ts:27-52` | The existing `unauthorized()`/`notFound()`/`serverError()` JSON helpers — style to mirror for the ICS route's failure responses (plain-text/JSON, never a redirect). |
| `.plans/tasks-round2/02-phase1.md:84` | `requireModule(module, level)` — the guard O1.3 gates the company feed's *token issuance* on (not the feed request itself, which is token-authenticated) — lands here, in phase 1, already merged by the time O1 starts. |
| `.plans/own-data-scoping-design.md` | Defines the "own-scoped role" vocabulary O1.3's "never to an own-scoped role" rule depends on. |

**Current behaviour — `src/proxy.ts` in full**

```ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIX = "/api/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)))
    return NextResponse.next();
  if (pathname.startsWith(PUBLIC_API_PREFIX)) return NextResponse.next();

  const token = request.cookies.get("rentflow_token")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("rentflow_token");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|api/settings/logo).*)",
  ],
};
```

`PUBLIC_PATHS` (line 6) is an **array**, tested with `.some()` at line 12. `PUBLIC_API_PREFIX` (line 7) is a **single scalar string**, tested with one `.startsWith()` at line 14 — there is nothing to `.push()` into. Two compliant fixes, pick one:
- **(a)** widen `PUBLIC_API_PREFIX` into `PUBLIC_API_PREFIXES: string[] = ["/api/auth", "/api/calendar/"]`, mirroring `PUBLIC_PATHS`'s own shape and checked the same way; or
- **(b)** leave both constants untouched and extend the matcher's negative lookahead at line 31 with `|api/calendar` — precedent already exists there for `api/settings/logo`, a route with its own non-cookie-gated GET.

Whichever fix, **any request whose pathname does not start with `/api/calendar` must still hit the existing branches unchanged** — do not widen the exemption further than the literal prefix, or every other route silently loses its auth check.

**iCalendar worked example** — a minimal, RFC 5545–valid document this app can populate today from `Period`/`Project` fields already on the schema (`name`, `startDate`, `endDate` on `Period`; `name`, `locationRel`/`location` on `Project`):

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RentFlow//Calendar Feed//NL
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VTIMEZONE
TZID:Europe/Brussels
X-LIC-LOCATION:Europe/Brussels
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:period-482@rentflow.app
DTSTAMP:20260814T090000Z
DTSTART:20260901T080000Z
DTEND:20260901T180000Z
SUMMARY:Zomerfestival Gent - Opbouw
LOCATION:Feestweide 12\, 9000 Gent
DESCRIPTION:Project: Zomerfestival Gent\nPeriode: Opbouw
SEQUENCE:3
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

Field-by-field source mapping:

| ICS field | Source | Notes |
|---|---|---|
| `UID` | `` `period-${period.id}@rentflow.app` `` | Stable per period (brief's own requirement) — domain-qualified per RFC 5545 §3.8.4.7's recommendation. Never regenerate on each poll or every calendar client will show duplicate events. |
| `DTSTAMP` | "now", at generation time | Required on every `VEVENT`; not the period's own dates. |
| `DTSTART`/`DTEND` | `PeriodPerson.startAt`/`endAt` (H1, phase 2) when set, else `Period.startDate`/`endDate` | Existing brief text, unchanged. Both emitted here in UTC (`Z` suffix) — simplest, unambiguous, matches how the values are stored in Postgres. |
| `SUMMARY` | `` `${project.name} - ${period.name}` `` | |
| `LOCATION` | `project.locationRel?.name` (fallback `project.location`) | A comma inside the value is escaped `\,` per RFC 5545 §3.3.11. |
| `DESCRIPTION` | project + period + (assignment function, once L2/L4 land) | A newline inside a text value is the **literal two characters `\n`**, not a real line break — a real CRLF here would itself need folding and would corrupt the field. |
| `SEQUENCE` | see trap below | |

**Two RFC 5545 mechanics that break a hand-rolled generator if skipped:**
1. **Line folding (§3.1):** no content line may exceed **75 octets** (not characters — a multi-byte UTF-8 character counts as its byte length). A longer line is folded by inserting `CRLF` followed immediately by a single space or tab; the reader unfolds by stripping that `CRLF + whitespace`. `SUMMARY`/`DESCRIPTION` built from a project + period name are the fields most likely to exceed 75 octets in practice — a generic `foldLine(line: string): string` helper applied to every emitted line (not just these two) is the only safe approach.
2. **Line endings:** every content line, folded or not, ends in `CRLF` (`\r\n`) — a plain `\n` join (JavaScript's default template-literal/`Array.join("\n")` behaviour) produces a file several real-world parsers (older Outlook builds) reject outright, even though it looks fine in a text editor.

**Concrete trap — `SEQUENCE` has nothing to read from today.** Neither `Period` (`schema.prisma:115-125`) nor `Project` (`:74-83`) carries an `updatedAt` column — verified: neither model declares one. "Increment `SEQUENCE` when the period changes" therefore has no source of truth to increment from yet. Two options, pick one and say which in the O1.1 commit body:
- add `updatedAt DateTime @updatedAt` to `Period` in the same O1.1 migration (it is already a schema-changing commit) and derive `SEQUENCE` from `Math.floor(period.updatedAt.getTime() / 1000)` (monotonically increasing, satisfies RFC 5545's "must increase on each revision" requirement even though it isn't a small sequential integer); or
- accept `SEQUENCE:0` on every emission (RFC-legal, but calendar clients may not always detect an edited event as changed — a known trade-off, not a silent bug, if documented).

**Verification commands**

```bash
npx tsc --noEmit && npm run lint

# structural checks against a running dev server (npm run dev)
curl -s -D - -o feed.ics "http://localhost:3000/api/calendar/<token>"
#   expect: 200, Content-Type: text/calendar; charset=utf-8,
#   Content-Disposition: inline; filename="rentflow.ics"

curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/calendar/bogus-token"
#   expect: 404 or 401 (JSON body) — NOT 307/302 to /login

grep -c 'BEGIN:VEVENT' feed.ics; grep -c 'END:VEVENT' feed.ics   # must match
file feed.ics   # sanity: confirms it's read as text, not binary-mangled

# CRLF check — every line must end \r\n; a bare \n join fails this
awk 'BEGIN{RS="\n"} {if ($0 !~ /\r$/) print NR": missing CR"}' feed.ics

# 75-octet line-folding check (pre-unfold, raw bytes per physical line)
awk '{ print length($0)-1, NR }' feed.ics | awk '$1>75 {print "line "$2" is "$1" octets — must be folded"}'
```
Import `feed.ics` into a real calendar client (Google Calendar "Add by URL", Apple Calendar, or Outlook) as the brief already requires, and cross-check displayed times against Brussels wall-clock and against the value in Postgres directly (`SELECT "startDate","endDate" FROM "Period" WHERE id = …;`), per the project's own Time rule.

**Definition of done**
- [ ] `feed.ics` parses in at least one real calendar client with correct Brussels wall-clock times, verified against Postgres.
- [ ] A bogus/expired/revoked token returns 401/404 JSON — never an HTML redirect.
- [ ] `/api/calendar/` is the exempted prefix in `proxy.ts`, matching N2.5/N5.4's forward-registered literal exactly.
- [ ] Feed tokens are `node:crypto`-random, unique, revocable, never the JWT.
- [ ] Company feed token issuance is gated on module access and refused to an own-scoped role; revocation-on-role-change is implemented and stated in the O1.3 commit body.
- [ ] Every emitted line is CRLF-terminated and folded at 75 octets.
- [ ] `User.personId == null` yields an explanatory single event or a 409, never a blank file.
- [ ] `npx tsc --noEmit` and `npm run lint` clean on every commit in the sequence.

---

## P2 — Per-entity data export

**Branch:** `p2-exports`

Decided (Q44b): a download button per overview screen exporting the **currently filtered** list to Excel.

**P2.1 — `feat(export): add an Excel export helper`**
- `src/lib/export.ts` producing **real `.xlsx`** via one small maintained library (Q61 — CSV was rejected as a downgrade given the round-trip requirement). Typed number and date columns so Excel can sum them immediately. Reuse the column semantics of the PO's own equipment export where they overlap (`.plans/tools/Export_Equipment_normal.csv`) so an export can be re-imported by P3 without translation.
- **Money as real numbers, dates as real dates** — not strings. Y1's serializer applies; a string in a money column makes Excel refuse to sum it.
- Unit tests on the helper (headers, types, empty input).

**P2.2 — `feat(export): export materials, people and clients`**
- Download buttons on those overview screens, exporting what is on screen (current filters applied, archived excluded unless the toggle is on — M1.3's rule).
- Gate each on `read` for its module, and **apply scope** (N5): an own-scoped user exports only their own rows.

**P2.3 — `feat(export): export projects, bookings and invoices`**
- Same pattern. Invoices and any money-bearing column additionally require `Kosten/Facturen: lezen` — otherwise the export is a hole straight through the redaction layer built in N2.1.
- **Verify:** a role with `Kosten/Facturen: geen` gets an export with no money columns at all (not blank ones — omit them, so the file is honest about what it contains).

### P2 — implementation depth

**Files to read before starting**

| File | Why |
|---|---|
| `.plans/data-import-export-design.md` §1, §8, §9.3 (read in full) | Authoritative column contract and route list — the tables below are copied from it verbatim; if the two ever disagree, the design doc wins. |
| `prisma/schema.prisma:127-143` (`Person`), `:21-33` (`Client`), `:35-44` (`Location`), `:145-162` (`Material`) | Confirms today's actual column set P2 exports from — note `Material.archived`/`costPrice`/`listPrice`/`revenueBefore` do **not exist yet** on this branch; they land as DDL-2 in phase 2, which must be merged before P2 starts (phase gate: phase 3 merged, which is after phase 2). |
| `src/components/materials-filter-bar.tsx` (90 lines) | Defines `MaterialSort`/`MaterialTypeFilter` (`:7-8`) — the on-screen filter state P2.2's "export what is on screen" must mirror as query params. |
| `src/app/api/materials/route.ts` (146 lines — see trap below), `src/app/api/clients/route.ts` (52), `src/app/api/locations/route.ts` (46), `src/app/api/people/route.ts` (76) | The existing list endpoints P2.2/P2.3 sit beside — confirms current field selection and that none of them touch scope/redaction yet (N5/Y1 are forward dependencies from phases 1 and 0 respectively, already merged by the time P2 starts). |
| `src/lib/api-auth.ts` (52 lines) | Response-helper conventions every new export route must reuse — never an inline `NextResponse.json({error}, {status})`. |

**Current behaviour**

`Material.dayPrice` is already `Decimal @default(0) @db.Decimal(10, 2)` (`schema.prisma:152`) — confirms Y1's Decimal→number conversion at the route boundary (already shipped in phase 0) is the pattern the export helper must reuse for every money column, not reimplement.

**Round-trip column contract** (brought forward from `.plans/data-import-export-design.md` §1 — copied verbatim; the design doc is authoritative if this ever drifts):

*Materials* (design doc §1.2):

| Column | Target | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `Material.id` | integer | optional | informational only — not the match key |
| `code` | `Material.code` | string\|null | recommended | match key (Q36a); `@unique`, `schema.prisma:150` |
| `name` | `Material.name` | string | required | |
| `category` | `Category.name` | string\|null | optional | auto-created if new (Q36b) |
| `categoryPrefix` | `Category.prefix` | string\|null | optional | only consulted for a new category |
| `dayPrice` | `Material.dayPrice` | number | required (default 0) | |
| `setupCost` | `Material.setupCost` | number\|null | optional | |
| `costPrice` | `Material.costPrice` *(DDL-2)* | number\|null | optional | feeds K4 payback |
| `listPrice` | `Material.listPrice` *(DDL-2)* | number\|null | optional | |
| `revenueBefore` | `Material.revenueBefore` *(DDL-2)* | number\|null | optional | never overwritten by re-import unless present and non-blank |
| `isBundle` | `Material.isBundle` | boolean | optional (default false) | |
| `bundlePriceOverride` | `Material.bundlePriceOverride` | number\|null | optional | |
| `archived` | `Material.archived` *(DDL-2)* | boolean | optional (default false) | |
| `notes` | `Material.notes` | string\|null | optional | |
| `stockCount` | count of `StockItem` rows | integer | optional | write-only on create (import side; irrelevant to export except as a read-back column) |

*People* (design doc §1.3):

| Column | Target | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `Person.id` | integer | optional | match key |
| `name` | `Person.name` | string | required | |
| `role` | `Person.role` | string\|null | optional, **transitional** | drop from export the same commit L4.2 drops the column |
| `email` | `Person.email` | string\|null | optional | not unique — never a match key |
| `phone` / `address` / `postalCode` / `city` / `country` | `Person.*` | string\|null | optional | |
| `dayPrice` | `Person.dayPrice` | number | required (default 0) | money — **omit** for callers without `Kosten/Facturen: lezen` |
| `functions` | `PersonFunction` via `Function.name` | comma-separated string | optional | |

*Clients* (design doc §1.4):

| Column | Target | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `Client.id` | integer | optional | match key |
| `name` | `Client.name` | string | required | |
| `contactName` / `email` / `phone` / `address` / `postalCode` / `city` | `Client.*` | string\|null | optional | |
| `vatNumber` | `Client.vatNumber` | string\|null | optional | J2b will snapshot this onto invoices — keep the column name stable |
| `notes` | `Client.notes` | string\|null | optional | |

*Locations* (design doc §1.5):

| Column | Target | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `Location.id` | integer | optional | match key |
| `name` | `Location.name` | string | required | |
| `address` / `postalCode` / `city` / `phone` / `notes` | `Location.*` | string\|null | optional | |

None of Client/Location/Person carry a money column other than `Person.dayPrice` — verified directly against `schema.prisma:21-44,127-143` — so P2.3's "no money columns exist on Client/Location" claim (design doc §9.3) is confirmed, not merely asserted.

**Concrete traps**
- **`src/app/api/materials/route.ts` is 146 lines** — 4 lines under the 150-line cap. Do **not** add the export handler inline here; the design doc already specifies a separate path (`GET /api/materials/export`, §9.3), which as a Next.js route handler is its own file (`src/app/api/materials/export/route.ts`) — confirm this is the plan before writing any code, since inlining would blow the limit immediately.
- **Export format is settled: real `.xlsx`** (Q61). The design doc's §8/§13-risk-5 CSV recommendation is marked superseded in that document. Add one small maintained xlsx *writer* library — `package.json` has none today (verified: no `xlsx`/`exceljs`/`papaparse`/`sheetjs`) — and keep the hand-rolled xlsx *reader* for imports. Record the chosen library and version in the commit body.
- Export routes must reuse Y1's Decimal→number conversion (already shipped, `schema.prisma:152` example above) — never format a `Decimal` with `.toString()` or string-concatenate it into a cell value, or Excel/the CSV reader receives a string, not a number.

**Verification commands**

```bash
npx tsc --noEmit && npm run lint && npm test

# money-column redaction — role without Kosten/Facturen: lezen
curl -s -b <viewer-cookie> http://localhost:3000/api/materials/export | head -1
#   header row must NOT contain dayPrice,costPrice,listPrice,bundlePriceOverride

# money-column presence — role WITH Kosten/Facturen: lezen
curl -s -b <admin-cookie> http://localhost:3000/api/materials/export | head -1
#   header row DOES contain them

# on-screen filter parity
curl -s -b <cookie> "http://localhost:3000/api/materials/export?archived=false" | wc -l
#   compare against the on-screen filtered count for the same filter state
```

**Definition of done**
- [ ] Every export column matches the table above exactly (name, order not required, but presence/absence is).
- [ ] Money columns are typed numbers/dates, never strings — verified by opening the file in a spreadsheet app and summing a money column directly.
- [ ] A role without `Kosten/Facturen: lezen` gets a header row with money columns **omitted**, not blanked.
- [ ] Own-scoped callers (N5) get only their own rows in the export.
- [ ] Archived rows excluded by default, included only when the on-screen toggle is on (M1.3's rule).
- [ ] Unit tests on the export helper: headers, types, empty input.
- [ ] Format decision (xlsx vs CSV, per the trap above) has explicit sign-off recorded in the commit body.

---

## P3 — Data import with update / replace modes

**Branch:** `p3-import-replace` · ⛔ **requires `.plans/data-import-export-design.md` approved** · **destructive**

Decided: two modes per entity — `update` (upsert, never delete) and `replace` (truncate that entity, then load). **Per entity only; there is no system-wide reset** (Q49). A replace that would remove records still referenced by bookings or invoices is **refused with a list of exactly what blocks it** — no cascade even behind a second confirmation, no archive-instead-of-delete fallback (Q49b).

Build on M1's parse → preview → apply pipeline (phase 2) rather than a second implementation. If M1 shipped before the design doc, P3 adopts M1's shape.

**P3.1 — `feat(import): generalise the import pipeline`**
- Lift M1's parser/preview/apply into an entity-agnostic pipeline with a per-entity adapter (match key, column mapping, validation, referential checks). Materials become the first adapter — **and M1's behaviour must not change**: assert that by re-running M1.6's tests unchanged.

**P3.2 — `feat(import): update-mode imports for people, clients and locations`**
- Three more adapters, upsert only (Q56: everything exportable is importable, same format). Module `wijzigen` for the entity concerned.

**P3.3 — `feat(import): replace mode with referential guards`**
- Truncate-then-load per entity, with the guards **all** enforced server-side:
  - ADMIN-only via the matrix, plus a **typed confirmation** (the user types the entity name), not merely an OK button.
  - Mandatory preview showing exactly what will be deleted and created.
  - **Referential integrity:** refuse when bookings or invoices reference records that would be removed, and return the blocking list (what, where, how many). ⚠️ **The application guard is the only protection, not a backstop** — the design doc checked the migration SQL: `Material` and `Person` dependents cascade `ON DELETE` all the way down to `PeriodStockItem`/`PeriodBundleBooking`, and `Project.clientId`/`locationId` are `ON DELETE SET NULL`. A raw truncate would therefore silently destroy booking history rather than erroring. Booking history underpins the cost figures, the invoices and K4's payback — it is never collateral damage of an import.
  - One transaction: a mid-file failure leaves the database untouched.
  - Audit log: who replaced what, when, how many rows.
- **`replace` is never available for invoices** — numbering must stay gapless and sent invoices are immutable (J2b).

**P3.4 — `feat(import): import screen with mode selection`**
- Entity picker, mode picker, file upload, preview, confirm. Replace mode visually distinct and clearly dangerous.

**P3.5 — `test(import): cover replace guards and rollback`**
- A refused replace lists its blockers and changes nothing; a permitted replace leaves exactly the file's contents; a mid-file error rolls back completely; an invoice replace is rejected outright.

### P3 — implementation depth

**Files to read before starting**

| File | Why |
|---|---|
| `.plans/data-import-export-design.md` §4-§7, §11 (read in full) | Authoritative pipeline shape, preview contract, replace guardrails and test plan — P3 builds this, does not redesign it. |
| `prisma/migrations/0001_init/migration.sql:140-167` | Original FK set (`ProjectMaterialPrice`, `ProjectPersonPrice`, `Period`, `StockItem`, `PeriodStockItem`, `PeriodPerson`) — all `ON DELETE CASCADE`, independently re-verified below. |
| `prisma/migrations/20260711000000_phase2_entity_foundations/migration.sql:71-74` | `Project.clientId`/`Project.locationId` FKs — both `ON DELETE SET NULL`, independently re-verified below; the one the design doc calls out as "the DB will not refuse this delete". |
| `prisma/migrations/20260711030000_phase4_e6_bundles/migration.sql:19-38` | `MaterialComponent`/`PeriodBundleBooking` FKs added for bundles (E6) — all `CASCADE`, independently re-verified below. |
| `prisma/migrations/20260711010000_phase3_codes_rbac/migration.sql:26` | `User.personId` FK — `ON DELETE SET NULL`, independently re-verified below; informational-only in the replace guard, not blocking. |
| `src/lib/booking.ts:34,61,120` | The existing `$transaction` + `pg_advisory_xact_lock` pattern P3.3 must reuse for the one-transaction replace, rather than inventing a second transaction/locking approach — independently re-read: line 34 is the SQLite early-return guard inside `lockMaterials`, line 37 the actual `pg_advisory_xact_lock` call, lines 61 and 120 the two `client.$transaction(async (tx) => …)` call sites. |
| `src/lib/material-code.ts` (14 lines) | `nextCode()`'s hard-coded `"01"` middle segment — M1/DDL-2's fix to this (2-digit → 4-digit prefix, design doc §2.3) must already be in place before P3.2's people/clients/locations adapters are built on top of the same pipeline; confirm it landed in phase 2. |

**Current behaviour — referential integrity, independently re-verified against the migration SQL** (design doc §7 point 4, re-checked directly against the files rather than trusted):

| Entity | Relation | `ON DELETE` as migrated | Verified at | App-level check required |
|---|---|---|---|---|
| Material | `StockItem.materialId` → `Material` | `CASCADE` | `0001_init/migration.sql:155` | count `PeriodStockItem` via `stockItem.materialId` |
| Material | `PeriodStockItem.stockItemId` → `StockItem` | `CASCADE` | `0001_init/migration.sql:161` | (chains from the above) |
| Material | `PeriodBundleBooking.materialId` → `Material` | `CASCADE` | `20260711030000_phase4_e6_bundles/migration.sql:35` | count `PeriodBundleBooking` by `materialId` |
| Material | `PeriodStockItem.bundleBookingId` → `PeriodBundleBooking` | `CASCADE` | `20260711030000_phase4_e6_bundles/migration.sql:38` | (chains from the above) |
| Material | `ProjectMaterialPrice.materialId` → `Material` | `CASCADE` | `0001_init/migration.sql:143` | count `ProjectMaterialPrice` by `materialId` |
| Material | `MaterialComponent.parentId`/`childId` → `Material` | `CASCADE` | `20260711030000_phase4_e6_bundles/migration.sql:20,22` | count rows where this material is parent or child |
| Person | `PeriodPerson.personId` → `Person` | `CASCADE` | `0001_init/migration.sql:167` | count `PeriodPerson` by `personId` |
| Person | `ProjectPersonPrice.personId` → `Person` | `CASCADE` | `0001_init/migration.sql:149` | count `ProjectPersonPrice` by `personId` |
| Person | `User.personId` → `Person` | `SET NULL` | `20260711010000_phase3_codes_rbac/migration.sql:26` | not blocking — surface informationally ("N linked user accounts will be unlinked") |
| Client | `Project.clientId` → `Client` | **`SET NULL`** | `20260711000000_phase2_entity_foundations/migration.sql:72` | count `Project` by `clientId` — **the DB will not refuse this**, the app check is the only protection |
| Client | `Invoice.clientId` → `Client` (J2b, phase 3) | not yet migrated on this branch | n/a today | must exist and be checked before P3 ships — confirm the phase-3 migration landed |
| Location | `Project.locationId` → `Location` | **`SET NULL`** | `20260711000000_phase2_entity_foundations/migration.sql:74` | count `Project` by `locationId` — same silent-orphan risk as Client |

Every row above was independently re-read from the actual migration files for this task (not merely copied from the design doc) — all match the design doc's §7 table exactly. No discrepancy found.

**Concrete traps**
- **Invoices are never an import target, in either mode** (design doc §1.6, §7.7) — stricter than the prompt's literal minimum (which only forbids *replace*). The P3.4 entity picker must not list Invoices at all, not merely grey out "replace" for it.
- **`Invoice.clientId` does not exist on this branch yet** — verified: no `Invoice` model anywhere in `prisma/schema.prisma` at the time of this review. It lands in phase 3 (J2b/DDL-3). P3.3's client replace-guard is **incomplete** without it; re-verify this FK exists and is included in the referential check before merging P3.3, or a replace can silently orphan invoiced clients (design doc §13 risk 6).
- **No audit-log infrastructure exists today** — verified: no file or model matching `audit`/`AuditLog` anywhere in `src/lib/` or either schema file. `ImportAudit { id, entity, mode, userId, fileName, rowCounts Json, blockedBy Json?, createdAt }` (design doc §7.6) is new in this commit, in both schema files, written inside the same transaction as the apply step.
- **`src/lib/booking.ts:34,61,120`'s transaction pattern is the one to reuse** for "one transaction, mid-file failure leaves the database untouched" — do not hand-roll a second `$transaction`/advisory-lock convention.

**Verification commands**

```bash
npx tsc --noEmit && npm run lint && npm test

# refused replace — seed a booked material, attempt replace, expect 409 + blockers, count unchanged
# (exact seed/attempt steps per design doc §11 test 5)

# permitted replace — unbooked materials only
# (design doc §11 test 6) — assert Material.count() and code set match the file, and an ImportAudit row exists:
psql "$DATABASE_URL" -c 'select * from "ImportAudit" order by "createdAt" desc limit 1;'

# mid-file rollback
# (design doc §11 test 7) — Material.count() identical before/after a crafted constraint violation

# permission levels
# wijzigen-but-not-verwijderen role: 200 on mode=update, 403 on mode=replace specifically
```

**Definition of done**
- [ ] `EntityAdapter<T>` interface implemented for materials, people, clients, locations (design doc §4.1) — pipeline itself unchanged from M1.
- [ ] M1.6's tests re-run unchanged and still green (P3.1's explicit requirement).
- [ ] Replace mode: ADMIN-only via `delete` level, typed confirmation (not a bare OK), mandatory preview, one transaction, `ImportAudit` row on every committed replace.
- [ ] Every referential check in the table above is implemented and covers the just-confirmed `Invoice.clientId` FK.
- [ ] A refused replace changes nothing in the database and returns the full blocker list.
- [ ] Replace is never offered for Invoices in the UI, in either mode.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` green on every commit in the sequence.

---

## L4 — Retire the legacy role string

**Branch:** `l4-retire-person-role`

Decided (Q33): the function always comes from the real list; the free-text field goes, with unmatched values reported for manual mapping.

Three unsynchronised copies exist today — `Person.role` (`prisma/schema.prisma:130`), `PeriodPerson.role` (`:231`) and `Function.name`. Read sites: `src/components/person-split-editor.tsx:48,56,78,151`, `src/components/period-bookings.tsx:52`, `src/components/cost-line-row.tsx:34`, `src/app/(app)/projects/[id]/callsheet/page.tsx:109`. Note `cost-line-row.tsx:34` lacks the `person.role` fallback the others have, so it already renders inconsistently.

**L4.1 — `refactor(people): read functions from the relation everywhere`**
- Replace all seven read sites with the `PeriodPerson.functionId` relation established in L2 (phase 2). Grouping, search and the callsheet must all read one source.
- **The four WRITE sites must go too, or L4.2 will not compile.** `role` is destructured and passed into Prisma create/update literals at `src/app/api/people/route.ts:37,51`, `src/app/api/people/[id]/route.ts:20,35`, `src/app/api/periods/[id]/people/route.ts:51`, and `src/app/api/periods/[id]/people/[assignmentId]/route.ts:26`. Dropping the columns while those literals still set `role` is a type error — and it is exactly the kind of thing a "replace the readers" checklist misses.
- **Report unmatched legacy values** before anything is dropped: any `Person.role`/`PeriodPerson.role` string with no matching `Function` gets listed for the PO to map by hand. Do not guess, and do not discard silently.

**L4.2 — `feat(db): drop the legacy role columns`** ← **the second schema commit of this phase; land it alone, after O1.1 has merged**
- Only after L4.1 has no readers **or writers** left: drop `Person.role` and `PeriodPerson.role` from both schemas + `seed.ts`, and remove the fields from `src/types/index.ts:63,200`.
- This is a schema change, so it is the phase's DDL commit — land it alone.

### L4 — implementation depth

**Files to read before starting**

| File | Why |
|---|---|
| `prisma/schema.prisma:127-143` (`Person`), `:227-240` (`PeriodPerson`) | Exact current column position — `role String?` at `:130` and `:231` respectively, the two columns L4.2 drops. |
| `src/types/index.ts:60-90` (`Person`), `:196-213` (`PeriodPerson`) | `role: string \| null` at `:63` and `:200` — the hand-maintained mirror L4.2 must also edit; note line 14 (`User.role: string`) is a **different field on a different model (RBAC role) and must not be touched**. |
| `src/lib/pricing.test.ts:55-90` (`makePerson()` helper) | Breaking-test trap not currently named anywhere in this brief — see below. |
| The seven read sites and four write sites already named in the brief above | Confirmed below to be complete, plus `prisma/seed.ts` (already covered by L4.2's own instruction to update `seed.ts`). |

**Current behaviour — every read site, re-verified**

| Site | Snippet |
|---|---|
| `src/app/(app)/projects/[id]/callsheet/page.tsx:109` | `{pp.role ?? pp.person.role ?? "—"}` |
| `src/components/period-bookings.tsx:52` | `<p ...>{pp.role ?? pp.person.role}</p>` |
| `src/components/person-split-editor.tsx:48` | `(p.person.role ?? "").toLowerCase().includes(q)` |
| `src/components/person-split-editor.tsx:56` | `const role = p.person.role ?? "Overig";` |
| `src/components/person-split-editor.tsx:78` | `const role = pp.role ?? pp.person.role ?? "Overig";` |
| `src/components/person-split-editor.tsx:151` | `onClick={() => add.mutate({ personId: p.person.id, role: p.person.role ?? undefined })}` |
| `src/components/cost-line-row.tsx:34` | `{pp.role && <div ...>{pp.role}</div>}` — confirmed: **no `?? pp.person.role` fallback**, exactly as the brief already states; this row already renders differently from the other five sites for any assignment relying on the person-level default. |

All seven sites confirmed present at the cited lines — the brief's read-site list is **complete**; nothing additional found by grepping `\.role\b` across `src/` (excluding `src/generated/prisma`).

**Current behaviour — every write site, re-verified**

| Site | Snippet |
|---|---|
| `src/app/api/people/route.ts:37` (destructure), `:51` (`prisma.person.create` data) | `role,` in both places |
| `src/app/api/people/[id]/route.ts:20` (destructure), `:35` (`prisma.person.update` data) | `role,` in both places |
| `src/app/api/periods/[id]/people/route.ts:51` | `role: role ?? null,` inside `prisma.periodPerson.create` |
| `src/app/api/periods/[id]/people/[assignmentId]/route.ts:26` | `if (role !== undefined) data.role = role;` |

All four confirmed at the cited lines — **complete** for API route handlers.

**Additional write sites the "four" count does not include** (already covered by L4.2's own "drop it from seed.ts" instruction, but not itemised anywhere — added here for completeness):

| Site | Snippet |
|---|---|
| `prisma/seed.ts:307-312` | Six `prisma.person.create({ data: { name: …, role: "Project Manager"/…, … } })` calls |
| `prisma/seed.ts:464` | `bookPersons(periodId, persons: { p: …; role?: string }[])` — the `role` param in the signature |
| `prisma/seed.ts:469` | `role,` inside the `prisma.periodPerson.createMany` data mapping |
| `prisma/seed.ts:499-502,512,519,526` | Every call site passing a literal `role:` string into `bookPersons` |

**Concrete traps**
- **`src/components/person-split-editor.tsx` is already 230 lines** — verified with `wc -l`, **80 lines over** the project's 150-line cap, before L4.1 touches a single line of it. The per-commit checklist ("every touched file ≤ 150 lines — extract rather than exceed") is non-negotiable, so L4.1 cannot simply delete the `.role` fallback logic in place: **this file must be split (extract a hook and/or a sub-component) in the same commit that touches it**, not deferred to a future cleanup. This is the single biggest scope risk in L4 and is not mentioned anywhere in the existing brief.
- **`src/components/period-bookings.tsx` is 148 lines** — 2 lines of slack. Any net-positive edit (e.g. replacing a role fallback with a function-name lookup that needs its own null-guard) will very likely tip it over; budget for extraction here too, don't assume the swap is a wash.
- **`src/lib/pricing.test.ts:67` and `:81` will fail `tsc` the moment L4.2 lands.** `makePerson()` (`pricing.test.ts:55-90`) returns an object literal annotated `: PeriodPerson` (the function's return type, declared line 62) whose top-level `role: null` sits at line 67, and whose nested `person: { … }` object (contextually typed as `Person` through the same annotation) has its own `role: null` at line 81. TypeScript's excess-property check fires on object literals assigned against a declared type, and that check propagates into nested literals under the same contextual type — so once `role` is removed from the `PeriodPerson`/`Person` interfaces (`src/types/index.ts:63,200`), both of these become **excess-property errors**, not merely unused fields. This file is not in the brief's read/write-site list at all; add it to L4.1's edit set or L4.2 will not compile, exactly the failure mode the brief already warns about for the four route files.
- `src/types/index.ts:14` (`User.role: string`) is the **RBAC role** on a completely different model — a grep for a bare `role` across `src/` will surface it (and `sidebar.tsx`, `user-form.tsx`, `users/route.ts`, `users/[id]/route.ts`, `api-auth.ts`, `auth/login/route.ts`) alongside the real targets; do not touch any of those files under L4.

**Verification commands**

```bash
npx tsc --noEmit   # must be clean after L4.1 — this is where pricing.test.ts would surface if missed
npm run lint
npm test
wc -l src/components/person-split-editor.tsx src/components/period-bookings.tsx   # confirm ≤150 after extraction

# confirm nothing still reads/writes the dropped columns after L4.2 (excludes User.role and its known callers)
grep -rn "\.role\b" src --include="*.ts" --include="*.tsx" | grep -v "generated/prisma\|users/\|sidebar.tsx\|user-form.tsx\|auth/login\|api-auth.ts"
#   expect: no output

# confirm the columns are actually gone
grep -n "role" prisma/schema.prisma prisma/schema.dev.prisma
#   expect: only User.role remains
```

**Definition of done**
- [ ] All seven read sites migrated to the `PeriodPerson.functionId`/`Function` relation (L2), including `cost-line-row.tsx`'s previously-inconsistent rendering now matching the other five.
- [ ] All four API-route write sites no longer reference `role` in any Prisma literal.
- [ ] `prisma/seed.ts` no longer creates `Person.role`/passes `role` into `bookPersons`/`periodPerson.createMany`.
- [ ] `src/lib/pricing.test.ts`'s `makePerson()` fixture updated in the same commit as the type change — not left to break `tsc` later.
- [ ] `src/components/person-split-editor.tsx` (and, if it tips over, `period-bookings.tsx`) extracted to stay ≤150 lines.
- [ ] Unmatched legacy `Person.role`/`PeriodPerson.role` values reported for manual PO mapping before L4.2 drops the columns.
- [ ] `Person.role`/`PeriodPerson.role` dropped from both schema files, `seed.ts`, and `src/types/index.ts:63,200` — landed alone, after O1.1.
- [ ] `npx tsc --noEmit` clean confirms no orphaned reference anywhere, including regenerated Prisma client types.

---

## Y2 — Generalise document storage `optional`

**Branch:** `y2-storage-facade`

`src/lib/documents.ts` (47 lines) is person-hard-coded: every function calls `prisma.personDocument.*` directly (`:14,22,33,46`) and `StoreArgs` hard-codes `personId` (`:4-11`).

**This has no consumer this round** — material attachments were dropped (Q34c). Do it only if a worker is already in that file, or skip it entirely. If done: `storeDocument({ owner: { kind, id }, … })` + `getDocument` + `listDocuments(owner)` + `deleteDocument(id)`, centralising the MIME whitelist and size caps that are currently inlined per route (`src/app/api/people/[id]/documents/route.ts:7,32-33`; `src/app/api/settings/logo/route.ts:10,33`). Person documents must behave identically afterwards.

### Y2 — implementation depth

**Files to read before starting**

| File | Why |
|---|---|
| `src/lib/documents.ts` (47 lines, quoted in full below) | The file Y2 refactors — every function is `personDocument`-specific today. |
| `src/types/index.ts:135-144` (`PersonDocument`) | Also person-hard-coded (`personId: number` at `:137`) — not named in the existing brief, but any façade generalisation touches this type too (e.g. an `ownerKind`/`ownerId` pair replacing `personId`), or `getDocument`/`listDocuments` cannot return a generic shape. |
| `src/app/api/people/[id]/documents/route.ts` (49 lines, quoted in full below) | One of the two callers with an inlined MIME/size cap. |
| `src/app/api/settings/logo/route.ts` (55 lines, quoted in full below) | The other caller — a different MIME whitelist (`image/png`/`jpeg`) and a different cap (1 MB vs 10 MB), both inlined. |
| `prisma/schema.prisma` (`PersonDocument` model) | Confirms `personId Int` is a required FK, not nullable — a generalised owner model needs its own decision here (e.g. keep `PersonDocument` as-is and add new owner-typed tables later, since there is no consumer this round). |

**Current behaviour — `src/lib/documents.ts` in full**

```ts
import { prisma } from "@/lib/prisma";
import type { PersonDocument } from "@/types";

interface StoreArgs {
  personId: number;
  filename: string;
  label?: string | null;
  mimeType: string;
  sizeBytes: number;
  expiresAt?: Date | null;
}

export async function storeDocument(args: StoreArgs, buffer: Uint8Array<ArrayBuffer>): Promise<number> {
  const doc = await prisma.personDocument.create({
    data: { ...args, data: buffer },
    select: { id: true },
  });
  return doc.id;
}

export async function getDocument(id: number): Promise<{ meta: PersonDocument; data: Uint8Array } | null> {
  const doc = await prisma.personDocument.findUnique({ where: { id } });
  if (!doc) return null;
  const meta: PersonDocument = {
    id: doc.id, personId: doc.personId, filename: doc.filename, label: doc.label,
    mimeType: doc.mimeType, sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt.toISOString(), expiresAt: doc.expiresAt?.toISOString() ?? null,
  };
  return { meta, data: new Uint8Array(doc.data) };
}

export async function listDocuments(personId: number): Promise<PersonDocument[]> {
  const docs = await prisma.personDocument.findMany({
    where: { personId },
    select: { id: true, personId: true, filename: true, label: true, mimeType: true, sizeBytes: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  return docs.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt?.toISOString() ?? null,
  }));
}

export async function deleteDocument(id: number): Promise<void> {
  await prisma.personDocument.delete({ where: { id } });
}
```

Confirms the brief's citations exactly: `prisma.personDocument.*` at `:14` (`create`), `:22` (`findUnique`), `:33` (`findMany`), `:46` (`delete`); `StoreArgs` hard-codes `personId` across `:4-11`.

**Current behaviour — the two inlined MIME/size callers**

`src/app/api/people/[id]/documents/route.ts`:
```ts
const MAX_SIZE = 10 * 1024 * 1024;                                          // :7
...
if (file.type !== "application/pdf") return badRequest(...);                // :32
if (file.size > MAX_SIZE) return badRequest("Bestand is te groot (max. 10 MB)"); // :33
```

`src/app/api/settings/logo/route.ts`:
```ts
const MAX_SIZE = 1 * 1024 * 1024;                                           // :10
...
if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type))          // :33
  return badRequest("Alleen PNG of JPEG toegestaan");                       // :34
if (file.size > MAX_SIZE)                                                  // :35
  return badRequest("Bestand is te groot (max. 1 MB)");                    // :36
```

Two different whitelists (PDF-only vs image-only) and two different caps (10 MB vs 1 MB) — a centralised MIME/size module (per the brief's own wording) needs a **per-caller config**, not a single global constant, or the logo route would silently accept a 10 MB PDF.

**Concrete traps**
- Both caller files are well under the 150-line limit today (49 and 55 lines) — no size risk from this refactor itself, but the new façade file(s) must stay under it too; splitting whitelist/cap config from the storage functions (e.g. `documents.ts` for storage, a small `document-limits.ts` for the per-caller config) is one clean way to keep both small.
- `src/types/index.ts:135-144`'s `PersonDocument` interface is not mentioned in the existing brief's file list — if the façade changes the owner shape (`{ kind, id }` per the brief's own suggested signature), this type needs updating in the same commit or every caller of `getDocument`/`listDocuments` breaks silently at the type level.
- **Person documents must behave identically afterwards** (brief's own requirement) — the existing `PersonDocument` Prisma model/table is not renamed by this refactor; only the TypeScript-level function signatures change. Do not attempt a table rename or a new polymorphic-owner column in the same commit — there is no second consumer this round to justify it (Q34c dropped material attachments), so the storage layer underneath can stay exactly as-is.

**Verification commands**
```bash
npx tsc --noEmit && npm run lint && npm test
wc -l src/lib/documents.ts "src/app/api/people/[id]/documents/route.ts" src/app/api/settings/logo/route.ts
# manual regression: upload/download/delete a person document and a logo through the UI — both must work identically to before
```

**Definition of done**
- [ ] `storeDocument`/`getDocument`/`listDocuments`/`deleteDocument` generalised behind an `{ owner: { kind, id } }` shape (or explicitly skipped — Y2 is optional).
- [ ] The MIME whitelist and size cap are centralised but still per-caller-configurable (PDF/10MB for person documents, PNG+JPEG/1MB for the logo).
- [ ] Person document upload/download/delete behaves identically to before the refactor (manually verified).
- [ ] `src/types/index.ts`'s `PersonDocument` type updated in the same commit if the owner shape changes.
- [ ] Every touched file ≤150 lines.
- [ ] Exit report states plainly whether Y2 was done or skipped (already required by the phase's own exit-report item 7).

---

## E5b — 62 mm label-roll variant `S` `optional` `💤 parked on Q8`

Not a blocker and not scheduled — recorded here so it is not lost. E5 already ships **A4 3×8 sticker sheets** (`bce0716`, `src/app/(app)/materials/labels/page.tsx:11,64,107-117`, `@page { size: A4 }`). If the PO later buys a label-roll printer (e.g. Brother 62 mm):

**Files to read before starting:** `src/app/(app)/materials/labels/page.tsx` (132 lines) — the whole item lives here; `@page { size: A4; margin: 10mm }` at `:11`, the heading "Materiaallabels — A4 (3×8)" at `:64`, and the sheet geometry at `:107-117` (`width: "210mm"`, `minHeight: "297mm"`, `padding: "10mm"`, `gridTemplateColumns: repeat(${COLS}, 1fr)`). Also `src/components/print/material-label.tsx` (92 lines) — the individual label, which should need no change.

**Current behaviour:** one hard-coded A4 3×8 sheet. `COLS` is a module constant; page size, margins and label dimensions are inline style literals. Nothing is configurable.

**Trap:** the label *content* (name, code, Code128 barcode, QR) is already sized for an A4 cell. A 62 mm roll is much narrower — the barcode may need a smaller module width or a shorter human-readable line. Verify by printing, not by eyeballing the preview.

**Definition of done:** both presets print correctly at true scale (measure a printed label with a ruler — browser print scaling lies); the A4 output is byte-identical to today for the existing preset; no change to `material-label.tsx`'s content model.

**E5b.1 — `feat(labels): parameterise the label sheet geometry`**
- Lift the hard-coded A4 grid into named presets — label width/height, columns/rows, page size and margins as CSS variables — with `a4-3x8` as the existing default and `roll-62mm` as a second preset. One `@page` rule per preset.
- No new feature surface: the same barcode/QR/label content, a different geometry. Verify by printing both presets.

---

## Deliberately not in this phase

| Item | Why |
|---|---|
| O2/O3 — OAuth two-way Google sync | PO chose ICS first (Q41). Revisit only if the feed's refresh lag proves unacceptable. Needs a design doc, a Google Cloud project, encrypted token storage and a scheduler — none of which exist. |
| Backups | Out of scope (Q44a) — the PO has a verified secondary backup flow, and all uploads live in Postgres so it is covered. **Re-open if uploads ever move to disk.** |
| Material attachments / photos | Dropped (Q34c). |
| 62 mm label roll variant | Parked on Q8, but now tracked as **E5b** above so it is not forgotten. |
| Per-line VAT rates in the UI | The data model already supports it (`InvoiceLine.vatRate`, DDL-3); exposing it is a config change if the PO ever needs mixed rates. |

---

## Phase 4 exit report

1. Branch + commit list per item.
2. **ICS evidence:** a screenshot or description of the feed rendering correctly in a real calendar client, with times matching Brussels wall-clock, and confirmation that the company feed is unreachable for an own-scoped role.
3. How company-feed tokens are revoked when a role or scope changes (O1.3).
4. The L4.1 unmatched-legacy-role report for the PO to map.
5. P3 replace-mode evidence: a refused replace with its blocking list, and a successful one.
6. Confirmation that exports omit money columns for roles without `Kosten/Facturen: lezen`.
7. Whether Y2 was done or skipped.
