# Phase 4 — Calendar feeds, data export/import, cleanup

> Read `00-README.md` first. Source decisions: `.plans/2026-08-po-feedback-round2.md` (Q41, Q42, Q44a/b, Q45a, Q49, Q49b, Q33).
> **v2 — one adversarial review round folded in (8 findings, 2 high-severity).**
> 5 items, ~16 commits. Mostly optional/nice-to-have — the PO's core asks are done by the end of phase 3.
> **Gate to start:** phase 3 merged · ⛔ **`.plans/data-import-export-design.md` approved** (blocks P3 only, so O1/L4/Y2 may start first).

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

---

## P2 — Per-entity data export

**Branch:** `p2-exports`

Decided (Q44b): a download button per overview screen exporting the **currently filtered** list to Excel.

**P2.1 — `feat(export): add an Excel export helper`**
- `src/lib/export.ts` producing `.xlsx`. Reuse the column semantics of the PO's own equipment export where they overlap (`.plans/tools/Export_Equipment_normal.csv`) so an export can be re-imported by P3 without translation.
- **Money as real numbers, dates as real dates** — not strings. Y1's serializer applies; a string in a money column makes Excel refuse to sum it.
- Unit tests on the helper (headers, types, empty input).

**P2.2 — `feat(export): export materials, people and clients`**
- Download buttons on those overview screens, exporting what is on screen (current filters applied, archived excluded unless the toggle is on — M1.3's rule).
- Gate each on `read` for its module, and **apply scope** (N5): an own-scoped user exports only their own rows.

**P2.3 — `feat(export): export projects, bookings and invoices`**
- Same pattern. Invoices and any money-bearing column additionally require `Kosten/Facturen: lezen` — otherwise the export is a hole straight through the redaction layer built in N2.1.
- **Verify:** a role with `Kosten/Facturen: geen` gets an export with no money columns at all (not blank ones — omit them, so the file is honest about what it contains).

---

## P3 — Data import with update / replace modes

**Branch:** `p3-import-replace` · ⛔ **requires `.plans/data-import-export-design.md` approved** · **destructive**

Decided: two modes per entity — `update` (upsert, never delete) and `replace` (truncate that entity, then load). **Per entity only; there is no system-wide reset** (Q49). A replace that would remove records still referenced by bookings or invoices is **refused with a list of exactly what blocks it** — no cascade even behind a second confirmation, no archive-instead-of-delete fallback (Q49b).

Build on M1's parse → preview → apply pipeline (phase 2) rather than a second implementation. If M1 shipped before the design doc, P3 adopts M1's shape.

**P3.1 — `feat(import): generalise the import pipeline`**
- Lift M1's parser/preview/apply into an entity-agnostic pipeline with a per-entity adapter (match key, column mapping, validation, referential checks). Materials become the first adapter — **and M1's behaviour must not change**: assert that by re-running M1.6's tests unchanged.

**P3.2 — `feat(import): update-mode imports for people and clients`**
- Two more adapters, upsert only. Module `wijzigen` for the entity concerned.

**P3.3 — `feat(import): replace mode with referential guards`**
- Truncate-then-load per entity, with the guards **all** enforced server-side:
  - ADMIN-only via the matrix, plus a **typed confirmation** (the user types the entity name), not merely an OK button.
  - Mandatory preview showing exactly what will be deleted and created.
  - **Referential integrity:** refuse when bookings or invoices reference records that would be removed, and return the blocking list (what, where, how many). Booking history underpins the cost figures, the invoices and K4's payback — it is never collateral damage of an import.
  - One transaction: a mid-file failure leaves the database untouched.
  - Audit log: who replaced what, when, how many rows.
- **`replace` is never available for invoices** — numbering must stay gapless and sent invoices are immutable (J2b).

**P3.4 — `feat(import): import screen with mode selection`**
- Entity picker, mode picker, file upload, preview, confirm. Replace mode visually distinct and clearly dangerous.

**P3.5 — `test(import): cover replace guards and rollback`**
- A refused replace lists its blockers and changes nothing; a permitted replace leaves exactly the file's contents; a mid-file error rolls back completely; an invoice replace is rejected outright.

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

---

## Y2 — Generalise document storage `optional`

**Branch:** `y2-storage-facade`

`src/lib/documents.ts` (47 lines) is person-hard-coded: every function calls `prisma.personDocument.*` directly (`:14,22,33,46`) and `StoreArgs` hard-codes `personId` (`:4-11`).

**This has no consumer this round** — material attachments were dropped (Q34c). Do it only if a worker is already in that file, or skip it entirely. If done: `storeDocument({ owner: { kind, id }, … })` + `getDocument` + `listDocuments(owner)` + `deleteDocument(id)`, centralising the MIME whitelist and size caps that are currently inlined per route (`src/app/api/people/[id]/documents/route.ts:7,32-33`; `src/app/api/settings/logo/route.ts:10,33`). Person documents must behave identically afterwards.

---

## Deliberately not in this phase

| Item | Why |
|---|---|
| O2/O3 — OAuth two-way Google sync | PO chose ICS first (Q41). Revisit only if the feed's refresh lag proves unacceptable. Needs a design doc, a Google Cloud project, encrypted token storage and a scheduler — none of which exist. |
| Backups | Out of scope (Q44a) — the PO has a verified secondary backup flow, and all uploads live in Postgres so it is covered. **Re-open if uploads ever move to disk.** |
| Material attachments / photos | Dropped (Q34c). |
| 62 mm label roll variant | Optional. E5 already ships A4 3×8 sheets (`bce0716`); a roll format means parameterising the sheet geometry, not a new feature. |
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
