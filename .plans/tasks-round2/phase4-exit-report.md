# Phase 4 exit report

Of phase 4's five items, four are done and merged to `main` via fast-forward
(O1, L4, P2, P3); Y2 is explicitly optional per its own brief and was
skipped (see item 7). `npx tsc --noEmit`, `npm run lint`, and `npm test` are
green on `main` at HEAD.

## 1. Branch + commit list per item

| Item | Branch | Commits (oldest → newest) |
|---|---|---|
| O1 — ICS calendar feeds | `o1-ics-feeds` | `76fa5ea` feat(db): add revocable calendar feed tokens (O1.1) · `75005e5` feat(calendar): serve personal and company ICS feeds (O1.2+O1.3, landed together) · `e134b54` feat(settings): manage calendar feed links (O1.4) |
| L4 — retire the legacy role string | `l4-retire-person-role` | `5f664bf` refactor(people): read functions from the relation everywhere (L4.1) · `fe0c1c3` feat(db): drop the legacy role columns (L4.2) |
| P2 — per-entity data export | `p2-exports` | `dfb40d7` feat(export): add an Excel export helper (P2.1) · `6d07ddb` feat(export): export materials, people and clients (P2.2) · `27aa6fd` feat(export): export projects, bookings and invoices (P2.3) |
| P3 — data import with update/replace | `p3-import-replace` | `37f8d4a` feat(db): add import audit log (P3.3's schema half, landed as its own commit) · `c90f22c` feat(import): generalise the import pipeline with replace mode (P3.1-P3.5, landed together — see that commit's body for why splitting further would have re-cut already-cohesive code) |
| Y2 — storage façade | — | skipped, see item 7 |

Two prior items from this same continued session — `717cd8d`
test(scoping): cover stats and invoices in the N5.4 enumeration and
`8f7fedb` docs: phase 3 exit report — landed between phase 3's close and
O1's start; they are phase-3 cleanup, not phase-4 work, and are recorded in
`phase3-exit-report.md`.

## 2. ICS evidence

No real calendar client (Google/Apple/Outlook) or browser was available in
this sandboxed environment to import the feed into and visually confirm —
stated explicitly rather than claimed, consistent with this session's
practice on every other datetime/visual item (H1.3, H4, J3). Verified
instead, live against the dev server:

- A linked user's personal feed (`GET /api/calendar/<token>`) returned a
  real, valid `VCALENDAR` with correct UTC times matching the seeded
  `Period.startDate`/`endDate`, `Content-Type: text/calendar`, and
  `Content-Disposition: attachment` headers.
- An unlinked user's (`admin@`) personal feed rendered exactly one
  explanatory `VEVENT`, never a blank file.
- The company feed (`kind: "company"`) included every period across every
  project, unfiltered — 54 `VEVENT`s from the seeded dev DB.
- A bogus token returned a plain `404` JSON body — never an HTML redirect
  to `/login` — confirmed against `proxy.ts`'s new `/api/calendar/`
  exemption; every other path's normal cookie-auth redirect was reconfirmed
  unaffected (`307` to `/login`).
- Structural RFC 5545 checks all passed: `BEGIN:VEVENT`/`END:VEVENT` counts
  matched, every line CRLF-terminated, no line exceeded 75 octets, and
  `file(1)` recognised the output as a genuine vCalendar.
- **The company feed is unreachable for an own-scoped role** — confirmed
  two ways: `issueFeedToken` refuses `kind: "company"` outright when
  `access.scope === "own"` (unit-tested in
  `calendar-feed.integration.test.ts`), and the settings-page UI
  (`calendar-feed-links.tsx`) never renders the company-feed row at all
  for such a caller — there is no "Aanmaken" button a click could even
  reach that would just be refused.

## 3. Company-feed token revocation on role/scope change (O1.3)

A token in a URL cannot be re-checked against a changing permission matrix
on every poll, so eligibility is instead re-verified at the two write paths
that can invalidate it:

- `PATCH /api/users/:id` — reassigning a user's `roleId` calls
  `revokeCompanyFeedForUser(userId)`, deleting only that user's `company`-kind
  feed (their `personal` feed is untouched — its eligibility never depends
  on role/scope).
- `PUT /api/roles/:id` — editing a role's own `scope` field calls
  `revokeCompanyFeedsForRole(roleId)`, deleting the `company`-kind feed for
  every user currently on that role.

**Known, stated gap** (documented inline in `calendar-feed.ts`): a company
feed issued to a role that later has its `planning` module access
*downgraded* via the permission matrix — without touching `roleId` or
`scope` — is not revoked by either path above. Re-checking the full matrix
on every poll isn't feasible from a static URL token; this is the same
trade-off the design brief itself accepts for scope/role changes, just not
yet extended to a pure matrix edit. Both revocation paths are covered by
`calendar-feed.integration.test.ts`.

## 4. L4.1 unmatched-legacy-role report

Run against the local dev DB via `npm run backfill:person-functions` (the
`Person.role`→`Function` counterpart to L2.1's pre-existing
`PeriodPerson.role` backfill):

```
Backfill complete: 0 linked, 6 already linked, 0 unmatched.
```

All six seeded people already carried the matching `PersonFunction` link
from L1's own seed data — a clean 1:1 match, as expected for dev data.
**Production was not run** — no Postgres access in this environment,
consistent with L2.1's own prior backfill (phase 2 exit report). The PO
runs `npm run backfill:person-functions` — wait: **this script no longer
exists.** It was deliberately deleted in L4.2 (the very next commit) once
its one job — reporting unmatched rows before the columns were dropped —
had been done against dev data and its logic verified. If the PO has not
yet run the production equivalent, this is a **real, outstanding gap**:
the production `Person.role`/`PeriodPerson.role` columns are now gone
(L4.2 already merged), so any production rows whose legacy role text never
matched a `Function.name` have lost that information permanently, with no
report ever generated against the real database. This should be flagged to
the PO directly rather than left implicit in this report alone.

## 5. P3 replace-mode evidence

**A refused replace, with its exact blocking list — verified twice:**

- Live against the dev server: a materials replace-mode preview
  (`POST /api/import/materials/preview`, `mode: "replace"`) against the
  real seeded dev DB returned **27 blockers**, each with its exact
  relation/count (e.g. `{"entityId":217,"label":"Aciet (0201-011)",
  "blockedBy":[{"relation":"PeriodStockItem (bookingen)","count":3}]}`).
  The apply route refused it twice — once for a missing typed
  confirmation, once with the confirmation present but blockers still
  outstanding (`409`) — and the material count stayed at exactly `108`
  both times; nothing was deleted.
- In the integration test suite (`pipeline.integration.test.ts`): a booked
  material's replace is refused with the precise `PeriodStockItem
  (bookingen)` blocker; a client with a linked project is refused with the
  `Project (projecten)` blocker, confirming `Project.clientId`'s `SET
  NULL` foreign key is not trusted as the only protection.

**A permitted replace:** an unbooked-locations replace
(`pipeline.integration.test.ts`) truncated the existing 2 rows, loaded 3
new ones from the file, and wrote a real `ImportAudit` row inside the same
transaction with the correct `userId`/`fileName`/`entity: "locations"`/
`mode: "replace"`.

**Mid-file rollback:** a deliberately crashing adapter (truncate,
then throw before the reload completes) proved the whole
`client.$transaction` rolls back — the location count was identical
before and after the simulated crash, confirming the truncate itself was
undone, not left half-done.

## 6. Export money-column omission confirmed

Verified for both P2.2 (materials, people) and P2.3 (bookings): a caller
without `Kosten/Facturen: lezen` gets a header row with money columns
(`dayPrice`/`costPrice`/`listPrice`/`revenueBefore`/`bundlePriceOverride`
on materials; `dayPrice` on people; `unitPrice`/`discountPct`/
`discountAmount` on bookings) **entirely absent**, never blanked — unit-
tested directly (`exports.integration.test.ts`,
`exports-p23.integration.test.ts`) by comparing the column-key list
produced for a `kosten_facturen: "lezen"` vs. `"geen"` access object.
Clients/locations carry no money column on the entity at all, so nothing
to gate. Invoices export is gated at the whole-route level instead (denies
`scope: own` entirely, `Kosten/Facturen: lezen` required) since virtually
every column on an invoice is money-shaped — a per-column omission
wouldn't fit that entity the way it does the other three.

## 7. Y2 — done or skipped

**Skipped**, per the item's own explicit instruction: "This has no
consumer this round... Do it only if a worker is already in that file, or
skip it entirely." No other phase-4 (or phase-3) item touched
`src/lib/documents.ts` or either of its two callers
(`people/[id]/documents/route.ts`, `settings/logo/route.ts`) this session,
so the condition for doing it was never met. `storeDocument`/`getDocument`/
`listDocuments`/`deleteDocument` remain exactly as they were before phase
4 — still hard-coded to `personId`, still two independently-inlined
MIME/size-cap pairs. Revisit only if a future item needs to touch that
file for an unrelated reason.
