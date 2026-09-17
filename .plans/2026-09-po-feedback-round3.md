# PO feedback round 3 — investigation + fix plan

Source: 5 bug reports from the PM (2026-09-17). Each was investigated by a
dedicated agent against the code; every claim below is backed by a file:line
that was re-verified by hand.

Ordered by (impact × confidence) ÷ effort. B3 and B5 are the quick wins.

---

## B1 — "Facturen moet je dubbel duwen op afdrukken"

### Root cause (confirmed): there are literally two Afdrukken buttons

1. `src/app/(app)/facturen/[id]/page.tsx:43-45` — "Afdrukken" is a
   `<Link href="/facturen/${id}/print">`. It navigates; it does not print.
2. `src/components/print/print-layout.tsx:14` — the print page then renders a
   *second* "Afdrukken" button, which is the one calling `window.print()`.

So the user presses Afdrukken, lands on a preview page, and must press
Afdrukken again. That is the report, verbatim. This is a UX design issue, not
a race.

### Secondary, real, and worth fixing in the same pass: a data race

`src/app/(app)/facturen/[id]/print/page.tsx:37-39` fetches `/api/settings` in a
bare `useEffect` whose result is **not** in the `isLoading` gate (line 46), and
`src/components/print/document-header.tsx:35-40` fires its *own* independent
`/api/settings` fetch for the logo/company block. The print button is live
before either resolves. Click it immediately and you print a document with a
blank header and no payment/IBAN footer — a second click, a beat later, is
complete. Two uncached calls to an authenticated DB route per page view.

Note both failure modes produce "press twice"; the second one makes the *first*
print come out visibly wrong rather than doing nothing, which is worse.

### Fix

1. Move `/api/settings` into a shared `useQuery(["settings"])` hook
   (`src/hooks/use-settings.ts`). Fetch once in `InvoicePrintPage`, pass
   `company` down to `DocumentHeader` as props, delete its private `useEffect`.
   Add the settings query to the `isLoading` gate. Dedupes 2 calls → 1 cached.
2. Auto-print on arrival: have the print route accept `?autoprint=1`, and fire
   `window.print()` in an effect once *all* queries have resolved. Link from the
   invoice detail page with that param. Keep `PrintLayout`'s manual button for
   re-printing.
3. Guard `PrintLayout`'s button with a `ready` prop so it can't fire early.

Same fix applies to pakbon / callsheet / kosten, which reuse `PrintLayout` and
`DocumentHeader` — do those in the same pass or the bug just moves.

**Files:** `src/hooks/use-settings.ts` (new), `facturen/[id]/print/page.tsx`,
`facturen/[id]/page.tsx:43-45`, `print/document-header.tsx:33-40`,
`print/print-layout.tsx:14`. **Effort: S.**

---

## B2 — "Probleem met Rollen matrix — zie Marc"

Report gives no symptom. Two real defects found; #1 matches "it didn't stick".

### B2a (high confidence) — a background refetch silently discards unsaved edits

`src/components/permission-matrix.tsx:34-39` overwrites the *entire* local
`matrix` state whenever `permsQuery.data` gets a new array reference:

```ts
useEffect(() => {
  if (!permsQuery.data) return;
  const next: MatrixState = {};
  for (const p of permsQuery.data) next[cellKey(p.roleId, p.module)] = p.access;
  setMatrix(next);
}, [permsQuery.data]);
```

`src/providers/query-provider.tsx:13-15` sets `staleTime: 30_000` +
`refetchOnWindowFocus: true` globally. Reviewing a matrix of roles × modules
takes well over 30s; alt-tab to Slack and back, the refetch fires, the response
is identical to what's saved, but it's a new reference — and every unsaved
toggle snaps back to its old value with no error and no warning.

**Fix:** seed local state once instead of mirroring forever. Track a
`hydratedRef`, or better, derive from `permsQuery.data` with a `dirty` overlay
map so server data and pending edits stay separate. Additionally set
`refetchOnWindowFocus: false` on the permissions query specifically (do not
change the global default). Add a "je hebt niet-opgeslagen wijzigingen" guard.

**Regression test:** render matrix → toggle a cell → push a new (identical)
query result → assert the toggle survives. No test file exists for this
component today.

### B2b (medium) — lockout check ignores role scope

`src/app/api/permissions/route.ts:51-57` verifies someone still holds
`instellingen`/`gebruikers` + `verwijderen` via
`rolesHolding()` (`src/lib/permission-lockout.ts:13-21`), which matches on
module/access only. But `src/lib/api-auth.ts:96-107` unconditionally vetoes any
non-`lezen` action for a role with `scope: "own"`. So if the last role holding a
delete permission is an `own`-scope (freelancer) role, the save passes
validation while producing a genuine, unrecoverable lockout.

**Fix:** exclude `scope: "own"` roles from `rolesHolding()` coverage counting
(pass the roles in, filter on scope). Also grey out / warn on `wijzigen` and
`verwijderen` cells for `own`-scope role columns in
`permission-matrix-row.tsx:38-56`, since those settings are dead letters.

### B2c (low) — no sticky header/first column

`permission-matrix.tsx:89-114` — `overflow-x-auto` + `min-w-[480px]`, no
`sticky`. With several custom roles the "Module" column scrolls out of sight.
Cheap CSS fix; fold in only if Marc's complaint turns out to be readability.

### B2d (CONFIRMED on prod, 2026-09-17) — Marc's agenda-feed link is unreachable

Checked against live prod (read-only GETs as Youri). Findings that change the
picture:

**The matrix is actively configured, not the open seed.** Five roles exist;
someone has deliberately differentiated PLANNER / VIEWER / FREELANCER and built
a bespoke **MARC** role (id 5, created 2026-09-07). Marc is user id 6,
`roleId: 5`, linked to `personId: 11`.

| Role (id) | scope | key gaps |
|---|---|---|
| ADMIN (1) | all | none — `verwijderen` everywhere |
| PLANNER (2) | all | `geen` on kosten_facturen, gebruikers, instellingen |
| VIEWER (3) | all | `geen` on kosten_facturen |
| FREELANCER (4) | **own** | `geen` on kosten_facturen, cijfers, gebruikers, instellingen, notities |
| **MARC (5)** | all | `geen` on **gebruikers** + **instellingen** only |

**Correction to B2b: it does not apply to Marc.** His role scope is `all`, not
`own`, so the `requireModule` own-scope veto never engages for him and every
`scope === "own"` route denial is irrelevant to his account. B2b stays a real
latent bug, but it is not what he is hitting. B2a is also unlikely to be his
complaint — his role has `instellingen: geen`, so he cannot reach the matrix to
lose edits in it. B2a remains a live bug for whoever *does* configure roles.

**The real defect — a page gate that swallows a self-service component.**
`CalendarFeedLinks` gates itself on `planning: lezen` and `scope !== "own"`
(`src/components/calendar-feed-links.tsx:24`), and its own doc comment (lines
9-18) states it is *"the only place a freelancer with planning access but no
`personen` access can find their own link"*. Marc satisfies that gate
(`planning: lezen`, `scope: all`, linked person).

But it is only ever rendered inside `SettingsPageContent`
(`settings-page-content.tsx:24`), and `settings/page.tsx:11-15` 403s the
**entire page** on `instellingen: lezen`. Marc has `instellingen: geen` → he
never reaches it → **he can never get his own "Mijn diensten" agenda feed**,
despite holding exactly the permission the component says is sufficient.

This is a known, self-documented smell: `settings-page-content.tsx:19-23` says
*"note this means it inherits the same instellingen: lezen gate as the rest of
this page, even though feed management is conceptually self-service for any
planning-capable role, not settings-admin-only."* That comment describes Marc.

**Fix (code, not config):** move `CalendarFeedLinks` out from under the
`instellingen` gate — its own route (e.g. `/agenda-feeds`) or a profile section
gated on `planning: lezen` directly, with a nav entry under the same condition.
Leave it rendered on Settings too for admins if convenient.

**Do NOT fix this by ticking `instellingen: lezen` for Marc** — that hands him
`SettingsForm`, `LogoUpload`, `RolesManager` and the permission matrix itself.

**Correctly dark for Marc, working as configured (not bugs):** `/users` and
`/settings` — nav hides both via `visibleNavLinks` (`src/lib/nav-links.ts`) and
each page 403s independently. No nav/route mismatch. Every other module he
holds was re-checked route by route (projects, materials, people, invoices,
stats, clients, locations) — each requires exactly `lezen` on its own module,
matching what the nav shows. No route silently demands `wijzigen` behind a
link shown at `lezen`.

**Not done:** the throwaway test-user comparison was blocked by this machine's
permission classifier ("Modify Shared Resources") and was not attempted by any
other route. No writes were made to prod; no test user was created, so none
needed deleting. `/api/permissions` was never written to.

**Still worth asking Marc:** *"is it Instellingen/Gebruikers that are missing,
or a blank Projecten/Materialen/Facturen page?"* If the former, B2d is the
answer and it is a small, well-scoped fix. If the latter, the matrix rules out
almost everything checkable without his exact click path.

**Effort:** B2d S · B2a S · B2b S · B2c XS.

---

## B3 — "Categorien in materialen zijn geen dropdown"

### Root cause (confirmed)

The **create/edit dialog already has the dropdown** —
`src/components/material-form.tsx:76-80` uses `EntityCombobox` bound to
`categoryId` with inline "+ Nieuwe categorie". What the PM is hitting is the
*other* place category is edited: the material **detail pane**,
`src/components/material-detail-pane.tsx:67-71`, still a plain text
`InlineEditField` writing the legacy `Material.category` **string**.

No schema work needed. `prisma/schema.prisma:214-237` already has both
`category String?` (legacy) and `categoryId Int? → categoryRel Category?`, and
a full CRUD `/api/categories` already exists and is already used by the dialog.

### The nastier half of this bug

Display code everywhere reads `categoryRel?.name ?? category`
(`src/hooks/use-material-filters.ts:26,35`, `src/lib/grouping.ts:110`,
`src/lib/print/material-label.tsx:41`). So for any material that already has a
`categoryId`, typing a new category into the detail pane **saves successfully
and changes nothing visible anywhere**. Silent no-op. Worth telling the PM.

### Fix

1. Replace the `InlineEditField` at `material-detail-pane.tsx:67-71` with an
   `EntityCombobox` bound to `categoryId`, reusing the exact pattern at
   `material-form.tsx:45-65`. Extract that query + `createCategory` helper into
   a `useCategories()` hook so both call sites share it.
2. `src/hooks/use-material-update.ts:24-30` — `coerce()` needs a numeric-id
   branch for `categoryId`; add it to `EditableMaterialField`.
3. `PUT /api/materials/[id]:60-99` already accepts `categoryId`. Have it derive
   `category` from `categoryRel.name` server-side so the legacy string stops
   drifting.
4. **Follow-up, not blocking:** backfill `categoryId` where it's null but
   `category` is set, then drop the legacy column. Separate migration.

**Import is unaffected** — `src/lib/import/apply-material-import.ts:20-37`
resolves/creates its own `Category` rows and never touches the UI combobox
(covered by `apply-material-import.integration.test.ts`). Filter bar and tree
pane read the resolved display name and need no change.

Real customer data is clean: 11 distinct categories in
`.plans/Export_Materiaal_20260823 (4).xlsx` col AY, no near-duplicates.
**Effort: S.**

---

## B4 — "importeren lukt nog niet helemaal voor klanten"

### Root cause (confirmed): client import only accepts RentFlow's own export

`src/lib/import/adapters/client.ts:57-59` — `acceptedFormats: ["rentflow"]`,
and `parseRows` reads literal camelCase headers (`name`, `contactName`,
`vatNumber`, `postalCode`) — exactly the shape `src/lib/clients-export.ts:8-19`
produces. It round-trips our own export and nothing else.

`src/lib/import/format-detection.ts:28-35` says so outright in a comment:
materials is the *only* entity with legacy-format tolerance
(`rentman-equipment` + the `HEADER_ALIASES` table in
`src/lib/import/rentman-locale.ts:1-49`, which covers material fields only).

Feed it the customer's actual Rentman relations export — Dutch, capitalized,
space-separated headers, confirmed shape in `.plans/Export_Materiaal_*.xlsx`
(`'Naam (in database)'`, `'Btw-tarief'`) — and
`src/app/api/import/[entity]/preview/route.ts:46-51` rejects the whole file
with *"Onherkend bestandsformaat — verwacht kolommen: name"*. Materials works,
clients doesn't. That is "lukt nog niet helemaal".

### Contributing defects

- **Duplicate detection is DB-id-only.** `client.ts:65-67` — `matchKey` is
  `row.id`, a RentFlow-internal id no foreign export contains. `pipeline.ts:30-38`
  drops null keys from the lookup, so everything classifies as `"new"`. Every
  re-import creates a full duplicate set.
- **CSV delimiter hardcoded to comma.** `src/lib/csv-parser.ts:27`. nl-BE Excel
  saves CSV with `;`. Produces one giant header key → compounds the rejection.
- **No encoding detection.** `src/lib/import/parse-file.ts:19` decodes strictly
  as UTF-8; a Windows-1252 export silently mojibakes diacritics rather than
  failing loudly.

### Fix

1. Add a `rentman-clients` format: a client header-alias table alongside
   `rentman-locale.ts`, add it to `clientAdapter.acceptedFormats`, and teach
   `detectEntityFormat` about it. Mirror the material implementation exactly.
2. Fallback match key: normalized VAT number → normalized email → normalized
   name, in that order, when `id` is absent. Strip dots/spaces/case from VAT.
   This is the difference between a usable import and a duplicate factory.
3. Sniff the CSV delimiter (`,` vs `;`) from the header line in
   `csv-parser.ts`.
4. Detect a UTF-8 BOM, else fall back to `latin1` in `parse-file.ts`.

Preview/apply/transaction/audit/per-row errors are all generic and already
correct for clients — no work there.

**Blocking question for the PM:** we need *the actual client file they tried*.
Without it we're guessing at header names, and step 1 is only as good as the
alias table. Ask for the export before starting. **Effort: M–L.**

---

## B5 — "Labels selecteren en filteren"

### What "labels" means here

There is **no tagging system** in this codebase — no `Tag`/`Label` model, no
join table, nothing on Note/Project/Material/Person. The only user-facing
feature named "Labels" is the printable material-label sheet at
`src/app/(app)/materials/labels/page.tsx`, linked as `🏷️ Labels` from
`src/app/(app)/materials/page.tsx:78`. Read literally, "labels selecteren en
filteren" = picking which materials to print stickers for.

### What's wrong with it

Selection works (multi-select `Set<number>`, select-all). **Filtering is
entirely absent**: `labels/page.tsx:77-91` is a flat, unsorted checkbox grid of
every material in a `max-h-64 overflow-y-auto` box. No search, no category
filter, no type filter — while the main materials page has all three in
`src/components/materials-filter-bar.tsx`, which this page simply doesn't use.
With a real catalogue you scroll a 64-px-tall box hunting for items by eye.

### Fix — CONFIRMED by the PM (2026-09-17)

The PM confirmed this is the material-label print page, and that what it needs
is **the category filter + a search bar**: "atm its very annoying to use". No
tagging system is wanted. This is no longer blocked.

1. Mount `MaterialsFilterBar` (`src/components/materials-filter-bar.tsx`) on
   `labels/page.tsx` above the picker grid, driven by `useMaterialFilters`
   (`src/hooks/use-material-filters.ts`) — the same hook the materials page
   uses, so search + category + type + sort all come for free and behave
   identically in both places. Don't rebuild a second filter UI.
2. Render the checkbox grid over the **filtered** list, not `materials`.
3. Fix the select-all semantics: `toggleAll` (`labels/page.tsx:44-47`) today
   compares against and fills from the unfiltered `materials` array; it must
   operate on the filtered set
   ("selecteer alle zichtbare"), and must *not* silently drop selections that
   are currently filtered out. Keep `selectedIds` as the source of truth and
   union/subtract against the visible subset.
4. Raise the `max-h-64` cap (`labels/page.tsx:77`) — with a filter in place a
   taller grid is usable; `max-h-[50vh]` or similar.
5. Show "n van m geselecteerd" so it's clear the print covers items scrolled
   out of view, and that hidden-but-selected items are still included.

Watch the empty-selection default: the page currently prints **all** materials
when nothing is ticked (`labelMaterials`, `labels/page.tsx:31-34`; the counter
text at `:93-96` says "Alle N"). With a filter present that
becomes ambiguous — decide explicitly whether "niets geselecteerd" means all
materials or all *filtered* materials. Recommend: all filtered, and say so in
the counter text.

**Effort: S.** No API or schema work — `useMaterialFilters` filters client-side
over the full `/api/materials` result, which this page already fetches.

## Suggested order

| | Bug | Effort | Blocked on |
|---|---|---|---|
| 1 | B2d Marc's agenda feed unreachable | S | — (confirmed on prod) |
| 2 | B3 categories dropdown | S | — |
| 3 | B1 invoice print | S | — |
| 4 | B5 label page filtering | S | — (confirmed by PM) |
| 5 | B2a matrix losing unsaved edits | S | — |
| 6 | B2b scope-aware lockout | S | — |
| 7 | B2c sticky matrix header | XS | nice-to-have |
| 8 | B4 client import | M–L | PM supplying the real client export file |

Items 1-7 are all confirmed, unblocked and small. Only B4 is genuinely blocked,
and only on a file.

## Open questions for the PM

1. **Marc:** ~~did a permission fail to save or revert?~~ **Largely answered by
   the prod check.** His role scope is `all`, so B2b never engages for him, and
   `instellingen: geen` means he cannot reach the matrix at all — so B2a isn't
   his complaint either. Remaining question, to confirm B2d is the whole story:
   *"is it Instellingen/Gebruikers that are missing, or a blank
   Projecten/Materialen/Facturen page?"*
2. ~~**Labels:** print-stickers page or tags?~~ **Answered 2026-09-17:** the
   print-stickers page; it needs the category filter + a search bar.
3. **Client import:** please send the exact file you tried to upload. B4 cannot
   start without it — the header alias table is only as good as the real
   headers.
4. **New, from the prod check:** should `gebruikers`/`instellingen` stay `geen`
   for Marc? Both look deliberate, but confirm — if he is meant to administer
   anything, that is a config change, not a code fix.

## Prod verification note

The prod pass was **read-only**. No writes were made, `/api/permissions` was
never written to, and no test user was created (see B2d) — so nothing needed
cleaning up afterwards.
