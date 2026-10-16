# PO feedback round 4 — investigation + plan

Source: 8 feature/feedback bullets from the PM (2026-10-16). Each was checked
against the code by a dedicated read-only agent; the load-bearing claims were
re-verified by hand (file:line below). Ambiguous bullets were grilled with Youri
the same day — the decisions are recorded per item and are **final** unless the
PM contradicts them.

> **STATUS 2026-10-16 — implemented on `main` (unpushed).** R0, P1, C1a, C1b,
> C2, C3 (data/API, UI, booking-time hire, figures/pakbon/import), C4, C5, C6,
> C7, C8 and G1 are built and individually committed, plus a late ask — the
> light/dark preference now lives on the account (`User.theme`,
> `PATCH /api/auth/me`). `tsc`, `eslint`, the full vitest suite and
> `next build` pass; every item was also driven in the dev server.
> Deviations from this plan:
> - An invoice made from a quote can't be regenerated at all (no
>   "herbereken uit project" fallback); its lines are edited by hand.
> - A quote's validity reuses `Invoice.paymentTermDays` (no extra column).
> - The inhuur total is computed when read (`subhireTotal`), never stored —
>   the plan's own simplification.
> - The payback guard is `Material.subhireOnly`, not "no stock units":
>   existing payback tests rely on stock-less materials.
> - C6's "inhuur items on the price list" needed no special code: those
>   0-stock materials already carry a price and are listed like any other.

> **Adversarially reviewed 2026-10-16** by two independent read-only agents
> (G1/C1/C2/C3/C8 and C4/C5/C6/C7); blockers re-verified by hand. Their
> findings are folded into **"Review amendments"** at the bottom of this file.
> **Where an amendment conflicts with a step in an item section, the amendment
> wins.** Implementers must read both.

> **Push `main` (later, Youri's call).** `2c6b111` (project search + status
> chips) and `b046bb5` (Mijn profiel) are 2 commits ahead of `origin/main`
> (rebased; the earlier hashes `cfe7d3b`/`506e957` are gone), so the PM has
> never seen the status filter that already answers most of C5.

> **Live production bug found during review — fix independently of round 4
> (R0):** "Opnieuw genereren" on a *concept credit note* replaces its negative
> lines with positive project lines (`create-credit-note.ts:91` copies
> `projectId`; `regenerate-invoice.ts:28-31` only checks concept + projectId;
> the button shows for any concept at `facturen/[id]/page.tsx:46-50`), and
> finalize then gives it a CN number. Fix: reject `kind !== "invoice"` in
> `regenerateInvoice`, hide the button, add a test.

## Validity summary

| # | PM bullet | Still valid? | Today | Size (post-review) |
|---|---|---|---|---|
| C1 | facturen updaten | **Yes** (vague → grilled) | Draft lines editable; notes/footer/dueDate API-only; regenerate wipes manual lines without confirm; sent = frozen | **L** → split C1a / C1b |
| C2 | Offerte → automatisch factuur | **Yes, net new** | No quote concept anywhere | **L+** |
| C3 | Inhuur voor overboekingen | **Yes, net new** | Overbook only in concept; blocks confirm/invoice until stock is bought | **XL** → split C3a / C3b |
| C4 | Notities toewijzen aan personen | **Yes** | No assignee, no done-state; "Toewijzen" already means *link to project/client* | **M+** |
| C5 | Projecten filteren op status | **Mostly built, unpushed** | Grouped chips Lopend/Afgerond/Geannuleerd/Alles in `2c6b111` | S |
| C6 | Prijslijsten uittrekken | **Yes** | Raw re-import xlsx only, set prices wrong (exports `dayPrice` 0) | M |
| C7 | Materialen in agenda-beschrijving | **Yes** | DESCRIPTION = project/periode/functie only | S |
| C8 | Vrije factuurlijnen | **Half built** | Backend + `addLine` hook exist, never wired into UI | S+ |

## Execution order (post-review)

| Phase | Items | Why this order |
|---|---|---|
| 0 | **R0** (credit-note regenerate bug) | Live prod data-corruption risk; tiny |
| A (parallel) | C5, C7, C8, **P1** (print settings endpoint) | Small, independent. P1 unblocks every print page (C1, C2, C6) |
| A' (parallel) | C6, C4 | C6 does **not** depend on C3 (Funrent items already exist as 0-stock materials); C4 independent |
| B | C1a → C1b | Builds on C8 line kinds; drafts trustworthy before quotes copy them |
| C | **G1** → C2 | Quotes need shortage lines + guards in the generator |
| D | C3a → C3b | Inhuur needs G1; stats/import/pakbon after the core |

One Postgres migration per item that changes the schema (C1, C2, C3, C4),
authored per CLAUDE.md. Never reuse a migration directory across items.

---

## C8 — Vrije factuurlijnen (text + priced)

### Decision (grilled)
Two needs: **free text** (extra afspraken, conditions — no amount) and **free
priced lines** (specific items/kosten). Both on invoices *and* quotes (C2 reuses
the same table).

### Current state (verified)
- `InvoiceLineKind` already has `"manual"` — `src/types/index.ts:449-456`.
- `POST /api/invoices/[id]/lines` + `addManualLine` (`src/lib/invoice-lines-crud.ts:42-82`)
  work, VAT defaults to the `btwRate` setting.
- `addLine` in `src/hooks/use-invoice.ts:61` is exported but **called nowhere**.
- Inline editor (`src/components/invoice-line-row.tsx:21-85`) edits
  description/qty/unitPrice only — no unit, VAT or section.
- Rounding gap: `lineTotalExcl = quantity * unitPrice` unrounded at
  `invoice-lines-crud.ts:74,106` (Postgres rounds on write, SQLite does not).

### Plan
1. New line kind `"text"` (String column, no migration): `quantity 0`,
   `unitPrice 0`, `lineTotalExcl 0`, `vatRate 0`. `computeInvoiceTotals`
   (`src/lib/invoice-totals.ts`) skips it explicitly; the VAT-per-rate rows in
   `invoice-summary.tsx` must not show a 0% row because of it.
2. `addManualLine` accepts `kind: "manual" | "text"`; zod: text requires
   `description` only (multi-line, max ~2000 chars).
3. `AddInvoiceLineDialog` (new component): toggle **Tekst** / **Kost**.
   Kost = description, qty, unit (dag/uur/stuk), unitPrice (negative allowed →
   korting), VAT select (21/12/6/0, default setting), section (optional: one of
   the invoice's period sections, else top). Button "Lijn toevoegen" under
   `invoice-lines-section.tsx`, draft only.
4. Render `text` lines as a full-width paragraph row (`whitespace-pre-line`),
   no amount cells — on detail and print page.
5. Extend inline edit with unit + VAT (not for `text`).
6. Round `lineTotalExcl` to 2 decimals in both CRUD paths.
7. Tests: totals ignore text lines; negative manual line lowers subtotal + VAT.

**Files:** `invoice-lines-crud.ts`, `api/invoices/[id]/lines/route.ts`,
`invoice-totals.ts`, `invoice-lines-section.tsx`, `invoice-line-row.tsx`,
new `add-invoice-line-dialog.tsx`, `types/index.ts`. **Effort: S.**

---

## C1 — Facturen updaten

### Decision (grilled)
All of: (a) drafts fully editable, (b) warn when the project changed after the
draft was generated, (c) a correct way to fix a **sent** invoice, (d) **print
layout pass** — aligned, clean, simple, with company logo.

### Current state (verified)
- Freeze guard `assertDraftMutable` (`src/lib/invoices.ts:15-17`) → only
  `concept` is mutable; sent invoices change only via payments / credit note.
- `PATCH /api/invoices/[id]` edits notes/footer/dueDate, but the `patch`
  mutation (`use-invoice.ts:44-54`) has no UI, and the print page ignores
  `invoice.footer`/`invoice.notes` in favour of `settings.invoiceFooter`
  (`facturen/[id]/print/page.tsx:98`).
- Regenerate (`src/lib/regenerate-invoice.ts:51`) `deleteMany`s **all** lines
  incl. manual ones; the button (`facturen/[id]/page.tsx:48-50`) has no confirm
  (design doc §12 risk 3 required one).
- Planned in `invoice-design.md` but never built: "refresh client details" (§3),
  structured `paymentReference` at finalize (§3, only read at `print/page.tsx:92`),
  "already invoiced" figure on the Kosten tab (§5).

### Plan
1. **Draft meta editor** — small form on the detail page: dueDate, notes
   ("Opmerkingen", printed above payment terms), footer (placeholder = setting).
   Print uses `invoice.footer ?? settings.invoiceFooter` and prints `notes`.
2. **Regenerate keeps manual + text lines** — collect `kind in (manual,text)`
   before the delete, re-append after generated lines preserving their relative
   order and section. Confirm dialog: "Gegenereerde lijnen worden herberekend;
   N eigen lijnen blijven behouden."
3. **Stale warning** — on GET of a *concept* invoice with a project, re-run
   `buildInvoiceDraft` (pure, already used by regenerate) and compare a
   normalized fingerprint of generated lines (kind, description, qty, unitPrice)
   with the stored non-manual lines. Mismatch → `isStale: true` in the
   serialized invoice → amber banner "Project gewijzigd sinds deze factuur
   werd opgemaakt — Opnieuw genereren". No schema change (booking rows have no
   timestamps, so a timestamp check is not possible).
4. **Refresh client snapshot** — `POST /api/invoices/[id]/refresh-client`,
   draft only; button next to the client block.
5. **Correct a sent invoice** — "Corrigeren" on verzonden/betaald invoices:
   one transaction creates (i) a full credit-note draft (existing
   `create-credit-note.ts`) and (ii) a new invoice draft copying all lines of the
   original, linked via new nullable `Invoice.correctionOfId`. User edits the
   new draft, then finalizes both. Detail pages cross-link ("Vervangt 2026-0012"
   / "Vervangen door …"). Legally correct, never mutates a numbered invoice.
6. **Structured payment reference (OGM)** — generate `+++123/4567/89012+++`
   at finalize (mod-97 of invoice id or number-derived 10 digits); printed in
   the payment block. Pure helper + tests.
7. **Print layout pass** (run the `design` skill):
   - header: logo left (max-height fixed, `object-contain`), company block
     right; client address block in envelope-window position;
   - meta row (Factuurnummer, Factuurdatum, Vervaldatum, Referentie) as a
     clean 4-column grid;
   - lines table: numeric columns right-aligned with `tabular-nums`, fixed
     column widths, section headers styled once, `thead` repeats across pages,
     rows `break-inside: avoid`;
   - totals block right-aligned, subtotal / reiskosten / BTW per tarief / totaal,
     totaal bold;
   - payment block + footer at the bottom; A4 margins checked in Chrome and
     Safari print preview.
   Same components are reused by the quote (C2) and the price list (C6).

Migration: `Invoice.correctionOfId Int?` (+ relation). **Effort: M.**

---

## G1 — Shared prerequisite: shortage units in the line generator

Invoices are refused while shortages exist (`create-draft-invoice.ts:32-37`),
so `generateDraftInvoiceLines` (`src/lib/invoice-lines.ts:50-131`) **never
emits lines for `PeriodMaterialShortage` rows**. Both C2 (quotes are made for
concept projects, which may be overbooked) and C3 (subhired shortages become
billable) need it.

Plan: merge shortage rows into the material groups exactly like the Kosten tab
already does (`mergeShortagesIntoGroups`, `src/lib/material-shortage.ts:31-72`),
priced from the shortage's own snapshots. The invoice guard keeps refusing
**unresolved** shortages (see C3). Tests: a concept project with 2 owned + 3
overbooked units of one material yields one line of qty 5. **Effort: S.**

---

## C2 — Offertes, omzetten naar factuur

### Decision (grilled)
- Built as **a variant of Invoice** (`kind: "offerte"`), reusing lines, totals,
  free lines (C8), print layout (C1).
- On **aanvaard**: project → `bevestigd` automatically.
- **Convert copies the quote lines verbatim** (incl. free/text lines), not a
  regeneration from the project.
- On convert the user picks **full invoice or deposit invoice**.
- Quote has a **"geldig tot"** date.

### Model changes
- `kind`: `"invoice" | "creditnota" | "offerte"`; `series: "quote"` gets its own
  `InvoiceCounter` row; new setting `quoteNumberFormat` (default
  `OF-{year}-{seq:04d}`) and `quoteValidityDays` (default 30).
- Quote statuses (own TS union): `concept | verzonden | aanvaard | geweigerd`;
  derived `verlopen` when verzonden and `validUntil < today`.
- New columns: `validUntil DateTime?`, `acceptedAt DateTime?`,
  `sourceQuoteId Int?` (on the invoice created from it).
- Quotes are not legal documents: a verzonden quote may go **back to concept**
  ("Bewerken", keeps its number). Aanvaard/geweigerd are terminal.

### ⚠ Hard requirement — every Invoice read must exclude quotes
Verified sites that would silently count a quote as an invoice today:
- `src/lib/compute-stats.ts:39-44` — filters only `kind != creditnota` →
  **a sent quote would count as invoiced revenue**.
- `src/lib/invoices-export.ts:36` — no kind filter.
- `src/app/api/invoices/route.ts:58` — list; `/facturen` must not show quotes.
- `src/lib/invoice-prior-deposits.ts:19` — safe (filters `invoiceRole`) but add
  the kind filter explicitly.
- `src/lib/import/client-referential.ts:16` — counts invoices per client
  (deletion guard) — quotes *should* count here; keep, but note it.
- project invoices list, credit-note route (must reject quotes), payments routes
  (must reject quotes), finalize route (quote "verzenden" uses its own path).
Add a helper `INVOICE_KINDS_ONLY = { kind: { in: ["invoice","creditnota"] } }`
and a test that seeds a sent quote and asserts stats/export/list ignore it.

### Flow
1. Kosten tab: "+ Nieuwe offerte" (next to "+ Nieuwe factuur") →
   `POST /api/quotes { projectId }` → generator (with G1) → draft, **no**
   shortage guard (quotes are exactly for overbooked concept projects).
2. `/offertes` overview page + detail page (reuses invoice detail components):
   Bewerken lijnen (C8), Opnieuw genereren (C1 rules), Verzenden (allocates
   number, sets `validUntil = today + quoteValidityDays`), Afdrukken.
3. **Aanvaard** → runs the existing project status mutation to `bevestigd`
   first. If it is blocked by shortages, show the existing
   `overbook-block-dialog.tsx` (which, after C3, offers "Inhuren") and leave the
   quote in verzonden. On success: quote → aanvaard, `acceptedAt = now`.
4. **Omzetten naar factuur** (aanvaard only) → dialog:
   - *Volledige factuur*: copy all quote lines into a new invoice draft
     (`invoiceRole: standalone`, `sourceQuoteId`).
   - *Voorschotfactuur*: % or fixed of the quote total → deposit draft
     (existing deposit logic). The later *eindfactuur* for a quote-sourced
     project copies the quote lines + existing deduction lines; a checkbox
     "herbereken uit project" falls back to today's generator if the project
     changed.
   Client snapshot and VAT are re-read at conversion (invoice must carry
   current client data).
5. Print: title "Offerte", meta Offertenummer / Datum / Geldig tot, no payment
   block, add "Voor akkoord" signature block.
6. Permissions: reuse module `kosten_facturen` (no new matrix row).

Migration: kind/series values are strings (no DDL) + `validUntil`,
`acceptedAt`, `sourceQuoteId`. **Effort: L.**

---

## C3 — Inhuur (subhire) voor overboekingen

### Decision (grilled)
- **Resolve an overbooking by subhiring it**: a shortage becomes "ingehuurd bij
  leverancier X" with a purchase cost, and stops blocking confirm/invoice.
- **Leveranciers** = companies you rent from for things you don't stock
  (Funrent, Rent-men). New list, separate from clients.
- Track **purchase cost per inhuur**, a **margin overview**, and a **default
  supplier + purchase price per material**. Whether the supplier bills **per
  rental or per day depends on the material** — both must be possible.
- Client sees subhired material **as normal material** at the normal price;
  only internal documents (pakbon) show "via leverancier X".
- **Figures must not be skewed**: subhired revenue counts as revenue, its cost
  as cost; excluded from payback.

### Current state (verified)
- `PeriodMaterialShortage` (`prisma/schema.prisma:335`) = units you don't own.
  Overbook allowed only in `concept`/`geannuleerd`
  (`src/lib/material-shortage.ts:8-12`); status change away from those runs
  `fillShortages` → `assertNoShortages` → 409
  (`src/app/api/projects/[id]/route.ts:67-86`); invoices refuse the same way.
- `overbook-block-dialog.tsx` deliberately has no way forward except buying
  stock or lowering the quantity.
- Real-world evidence: Rentman export folders `9998-Inhuur Funrent` (22 items)
  and `9997-Inhuur Rent-men` (1 item) with price but stock 0
  (`.plans/tools/Export_Equipment_normal.csv`). Imported today they are
  bookable only as shortages → such a project can never be confirmed.
- Cijfers: `stats-booked.ts` and `stats-top-materials.ts:23` ignore shortages
  entirely (existing under-reporting for concept projects); payback already
  excludes them (`serialize-stats-period.ts:4-12`).

### Model
- `Supplier { id, name, contactName?, email?, phone?, address?, postalCode?,
  city?, vatNumber?, notes?, archived }`.
- `Material.defaultSupplierId Int?`, `Material.subhireCost Decimal?`
  (default purchase price per unit), `Material.subhireCostBasis String
  @default("per_huur")` — `"per_huur" | "per_dag"` (TS union + zod): the
  supplier bills per rental (flat) or per day, **chosen per material**
  (decided 2026-10-16), `Material.subhireOnly Boolean @default(false)`
  (catalogue items you never stock).
- `PeriodMaterialShortage.supplierId Int?`, `.subhireCostBasis String?`,
  `.subhireUnitCost Decimal?`, `.subhireCost Decimal?` (total for the row),
  `.subhireCostManual Boolean @default(false)`, `.subhiredAt DateTime?`.
  `supplierId != null` ⇒ resolved.

### Plan
1. `assertNoShortages` / `fillShortages` / overbook badges count only
   **unresolved** rows (`supplierId == null`). Partial subhire splits a row
   (5 short, 3 subhired → rows of 3 resolved + 2 open).
2. **"Inhuren" dialog** — from `project-overbook-alert.tsx` and from
   `overbook-block-dialog.tsx`: supplier (default from material), quantity,
   cost basis (default from material, overridable per inhuur) and cost.
   Prefill: `per_huur` → `qty × subhireCost`; `per_dag` → `qty × subhireCost ×
   periodDays` (same timezone-free day count as billing, see H6). The row
   stores the basis + unit cost + the resulting total; the total stays
   editable (supplier discounts/transport). If the period's dates change, a
   `per_dag` row recomputes its total unless it was manually overridden
   (`subhireCostManual Boolean`). `POST
   /api/periods/[id]/shortages/[shortageId]/subhire`.
3. **Any project status**: in a confirmed/active project, overbooking is
   allowed *only* when the excess is immediately marked as inhuur (same dialog
   inline in the material picker). Concept keeps today's behaviour.
4. **`subhireOnly` materials** auto-create a resolved shortage with the
   default supplier/cost on booking — no extra click for Funrent items.
5. Leveranciers page `(app)/leveranciers` (list + form), module permission:
   reuse `materialen`. Purchase costs pass through `redactMoney` /
   `moneyVisible` everywhere (never to scope own).
6. Billing: via G1, resolved shortages bill as normal material lines.
7. Pakbon: subhired units listed under their category with "via {supplier}";
   optional per-supplier summary at the bottom (what arrives from whom).
8. **Cijfers**:
   - booked revenue + top materials + by-client include shortage rows (fixes
     today's under-reporting too);
   - new KPIs: **Inhuurkost** and **Marge** (= omzet − inhuurkost) for the
     range; per-project margin on the Kosten tab (money-gated);
   - payback: unchanged exclusion; guard `subhireOnly`/0-stock materials so a
     stray `costPrice` can't produce a 0% payback row.
9. Import: Rentman folders matching `^\d+-Inhuur (.+)$` → `subhireOnly`, and
   upsert a Supplier named after the capture ("Funrent", "Rent-men").

Migration: Supplier table + 4 Material columns + 6 shortage columns.
**Effort: L.** Cost basis (per huur vs per dag) is set per material and can be
overridden per inhuur — decided 2026-10-16.

---

## C6 — Prijslijsten uittrekken

### Decision (grilled)
Printable **customer price list** (logo, per category) **and** an **Excel**
version; **crew rates** included; on generation optionally **pick a client** to
apply their rates; the list must also contain **items offered via inhuur**.

### Current state (verified)
- Materials xlsx export (`src/lib/materials-export.ts:16-67`) is a raw
  re-import dump with camelCase headers; for sets without override it exports
  `dayPrice` (≈0) instead of the computed `setPrice`
  (`src/lib/materials-list.ts:83-87`).
- Client-specific prices exist **only for functions** (`ClientFunctionRate`,
  schema 114-124). There are **no per-client material prices** — only
  per-project overrides.
- Print infra to reuse: `PrintLayout`, `DocumentHeader`, labels-page picker
  pattern (`(app)/materials/labels/`, `useMaterialFilters`).

### Plan
1. Pure builder `src/lib/price-list.ts`: input = materials (non-archived,
   incl. `subhireOnly` from C3), sets with `setPrice`, functions with
   day/hour rate, optional `clientId` → function rates from
   `ClientFunctionRate` overriding the defaults. Output = sections per
   category (+ "Personeel" section). Options: categories, include sets,
   include crew, hide €0 items (default on), excl./incl. BTW.
2. `GET /api/price-list?…` (JSON) and `GET /api/price-list/export?…` (xlsx,
   Dutch headers: Categorie, Code, Omschrijving, Prijs/dag excl. BTW, …).
   Requires `materialen: lezen` and `moneyVisible`.
3. Page `(app)/materials/prijslijst`: options panel (no-print) + printable
   list in the C1 layout; title "Prijslijst {jaar}" + client name when chosen.
   "Prijslijst" entry in the materials `PageActionsMenu`.
4. Gotcha: print pages read company data via `/api/settings`, which needs
   `instellingen: lezen` — roles with money access but no settings access get
   no header. Add a narrow `GET /api/settings/company` (any authenticated
   user) and use it for all print headers.
5. Tests: builder (set price, client override, €0 filter, BTW toggle).

**Effort: M.** Note for PM: "klanttarieven" applies to crew only; per-client
*material* prices would be a new model — out of scope unless asked.

---

## C4 — Notities toewijzen aan personen

### Decision (grilled)
- Assign to **Persons** (crew, incl. without login); people with a linked
  account see "Aan mij toegewezen".
- **Multiple assignees** per note. A note still links to at most one project;
  a project has many notes (unchanged).
- **Done per assignee** ("2/3 afgewerkt").
- No e-mail (no mail infrastructure exists; out of scope).

### Current state (verified)
- `Note` (schema 516-539): no assignee, no status.
- Naming clash: "→ Toewijzen" (`note-assign-popover.tsx:10-43`), badge "Niet
  toegewezen" (`note-card.tsx:82-86`), filter (`note-filter-bar.tsx:51`) and
  API `unassigned=1` all mean *linked to project/client*.
- Scope-own users only see notes on their own projects (`src/lib/notes.ts:56`)
  and may only edit notes they authored (`api/notes/[id]/route.ts:54`).
- Branch `feat/notes-ui-polish` looks unmerged, but its work is already on `main` (see step 0).

### Plan

0. ~~Merge `feat/notes-ui-polish` first~~ — checked 2026-10-16: its only
   commit (4387dfc) is already on `main` as 4e48d2e (`git cherry` reports it
   as applied), and `main` has newer changes on top (5fc33c3 multi-photo
   upload). Nothing to merge; the branch can be deleted.
1. Rename existing wording: Toewijzen → **Koppelen**, Niet toegewezen →
   **Niet gekoppeld** (API param stays `unassigned` internally or becomes
   `unlinked` — pick one, update hook + tests).
2. Model `NoteAssignee { noteId, personId, doneAt DateTime?,
   @@id([noteId, personId]) }`, cascade on note and person delete.
3. Form: multi-person picker. Card: assignee chips with check state + "2/3
   afgewerkt"; fully done notes visually muted.
4. API: `assigneeIds` on POST/PUT; `PATCH /api/notes/[id]/assignees/me
   { done }`. `GET /api/notes?assignedToMe=1&open=1` and `?assigneeId=`.
5. Scope own: `listNotes`/`getNote` visible if own-project **OR** assigned to
   `access.personId`; may toggle only their own done flag; may not change
   assignees on others' notes.
6. Filter bar: "Aan mij" + per-person filter. Dashboard card "Aan mij
   toegewezen" (open items, gated `notities: lezen`, hidden when
   `linkedPersonMissing`).
7. Tests: scope-own visibility of an assigned client-linked note; done toggle
   permission.

Migration: NoteAssignee. **Effort: M.**

---

## C5 — Projecten filteren op status

### Decision (grilled)
Per-status chips, **multi-select**, persisted in the URL.

### Current state (verified)
`src/lib/project-filter.ts:5` — `ProjectStatusFilter = "open" | "afgerond" |
"geannuleerd" | "all"`, "open" = concept+bevestigd+actief; chips in
`src/components/projects-toolbar.tsx:6-11`; client-side only, not in URL.
Unpushed (`2c6b111`).

### Plan
1. Filter becomes `Set<ProjectStatus>`; five toggle chips (status badge
   colours from `statusVariant`) + presets **Lopend** (default) and **Alles**.
2. Sync to `?status=concept,bevestigd` with `useSearchParams`/`router.replace`
   (check `node_modules/next/dist/docs/` for the Next 16 Suspense requirement
   around `useSearchParams`).
3. Keep the "n verborgen door het statusfilter · Toon alles" hint; update
   `project-filter.test.ts`.

**Effort: S.**

---

## C7 — Materialen in de agenda-beschrijving

### Decision (grilled)
**Personal feed only** ("Mijn diensten"): materials (names + quantities, sets
as sets, never prices) in DESCRIPTION, and the **full location address** in
LOCATION. Company feed unchanged.

### Current state (verified)
`src/lib/calendar-feed-ics.ts:31-62` (`eventFromPeriod`): DESCRIPTION =
Project/Periode/Functie; LOCATION = location name only. Escaping and UTF-8-safe
folding already exist (`src/lib/ics.ts:33-63`). Materials are booked per period
(`PeriodStockItem`, `PeriodBundleBooking`, `PeriodMaterialShortage`).
Freelancers seeing material names is consistent with
`own-data-scoping-design.md:15`.

### Plan
1. `buildPersonFeedIcs` selects the period's materials, bundle bookings and
   shortages (incl. subhired ones from C3); a pure
   `summarizePeriodMaterials()` aggregates to `"3x Tent 6x3"`, sets as
   `"1x Geluidset (set)"`, component units of a set skipped, sorted by
   category then name, capped at 25 lines + `"… en N meer"`.
2. DESCRIPTION gets a `Materiaal:` block; per-day events (H6
   `PeriodPersonDay`) repeat the same block.
3. LOCATION = `name, address, postalCode city` (skip empty parts).
4. SEQUENCE: material writes don't touch `Period.updatedAt` (bumped only by
   `PUT /api/periods/[id]`). Touch `period.updatedAt` in the booking write
   paths (`src/lib/booking.ts`, `bundle-booking.ts`, shortage routes) so
   clients that honour SEQUENCE refresh.
5. Tests in `calendar-feed.integration.test.ts` + unit test for the
   summarizer (cap, sets, no prices).

**Effort: S.**

---

## Open points for the PM (defaults chosen, flag if wrong)

1. C6 — client rates apply to crew only; per-client material prices don't
   exist.
2. C8 — negative amounts (korting) are allowed on free lines.
3. C2 — a sent quote can be reopened for editing; aanvaard/geweigerd are
   final.
4. C4 — no e-mail notification on assignment.

---

## Review amendments (2026-10-16, binding)

Two adversarial reviews against HEAD `b046bb5`. Blockers and the
quote-numbering / credit-note / shortage-write claims were re-read by hand.
Severity: **B** = blocker, **M** = major, m = minor.

### P1 — Print company data endpoint (new, phase A; moved out of C6)
- `GET /api/settings` needs `instellingen: lezen` (`api/settings/route.ts:10`)
  and so does the logo (`api/settings/logo/route.ts:16`). `useSettings`
  (`use-settings.ts:14`) never checks `r.ok`, so it parses `{error}` as
  settings → **every print page silently prints a blank header** for roles
  without settings access (facturen print, pakbon, callsheet, kosten).
- Add `GET /api/settings/company` returning a whitelist (`company*` keys +
  `invoiceFooter` + payment-term fields used by print) via `requireAuth()`;
  loosen the logo GET the same way. Both need an **`EXEMPT` entry with a reason
  in `src/lib/route-guards.test.ts:15-23`** (precedent `auth/me`), or that test
  fails. New query key (not `["settings"]`, which the settings form owns);
  hook throws on `!r.ok`.

### C8
- **B — text lines break every full credit note.** `create-credit-note.ts:61`
  throws `INVALID_QUANTITY` for `quantity <= 0`; a text line has qty 0.
  Copy `text` lines verbatim (qty 0, total 0), skip the check for them, hide
  them from the partial-credit checkboxes (`credit-note-dialog.tsx:66-75`).
  Test: credit an invoice containing a text line.
- **M — line-edit whitelist per kind, enforced server-side** in
  `updateInvoiceLine`: unit/VAT editable only on `manual`; reject
  `vatRate`/`unitPrice` patches on `deduction`/`deposit` (deduction VAT must
  equal the deposit's frozen rate, design §4.2); reject qty/price patches on
  `text` (today a patch would silently turn it into a priced line).
- m — section-less lines render at the **bottom**, not the top
  (`invoice-lines-section.tsx:16-21` groups by first appearance; `sortOrder`
  is max+1). Say "bottom".
- m — manual lines: zod `quantity > 0` (negative qty also breaks crediting);
  korting only via negative `unitPrice`. Round `unitPrice` to 2 decimals too.
- m — mixed VAT: persist/compute VAT **per rate** and derive `vatAmount` as
  their sum, so summary rows (`invoice-summary.tsx:11-15`) always add up.
- m (legal) — choosing 0% VAT should prompt a legal mention (verlegd /
  vrijstelling) as an auto-suggested text line.
- Effort **S+**.

### C1 — split into C1a (steps 1–4 + print pass) and C1b (steps 5–6)
- **M — dueDate editor is dead on arrival**: `finalize-invoice.ts:48` always
  sets `dueDate = now + termDays` (design §3 FINAL). Replace with an optional
  per-draft **"betalingstermijn (dagen)"** override that finalize honours
  (documented deviation); no date picker.
- **M — regenerate / stale only for `kind = invoice`** (and `offerte` after
  C2). See R0.
- **M — replace the step-3 fingerprint with a stored generator hash.**
  New `Invoice.generatedHash String?` written at create/regenerate = hash of
  the generator output (kind, description, qty, unitPrice, vatRate,
  lineTotalExcl, 2-dp). On GET of a concept, hash a fresh generator run (with
  the same `depositValue` derivation as `regenerate-invoice.ts:33-38`) and
  compare. Generator-vs-generator → no Decimal noise, no inline-edit noise,
  catches discount and VAT-setting changes. Skip when `sourceQuoteId` is set.
  An inline edit of a generated line converts it to `manual` so regenerate
  keeps it (no silent loss). Expect every existing draft to read stale once
  after G1 ships — release note.
- **M — "Corrigeren" (C1b) must:**
  copy `invoiceRole`, `depositType`, `depositPercentage`, `depositBasisExcl`,
  `sourceQuoteId` (else a corrected deposit is never deducted —
  `invoice-prior-deposits.ts:20`); refuse when a correction draft already
  exists or cumulative credits would exceed the original
  (`create-credit-note.ts:43-56` has no such guard today); **finalize credit
  note + replacement in one transaction** (never a sent replacement with a
  concept credit note); move payments of a paid original to the replacement
  on that finalize; block correcting a deposit already deducted by a
  non-concept final invoice; hide for credit notes and quotes.
- **M (legal) — credit notes must print "Creditnota bij factuur {nr} van
  {datum}"** (BE VAT requirement). Today only the title changes
  (`print/page.tsx:76-78`) and `invoiceInclude` doesn't load `creditNoteOf`.
  Add to the print pass, plus "Vervangt …" for corrections.
- m — OGM: base = `YYYY` + 6-digit seq (never parse the format string, never
  the id); check = base mod 97 with **0 → 97**; invoices only (not credit
  notes); no backfill. Test the 0→97 case.
- m — refresh-client re-reads `project.clientRel` and updates `clientId` too.
- m — regenerate keeps manual lines whose section names a renamed period
  (orphan section) — accepted, documented.
- Effort **L** total.

### G1
- **M — overbooked setup is dropped**: `invoice-lines.ts:109` sums setup from
  `g.assignments` only; add `g.overbookedSetup` (as `grouping.ts:140` does).
- **M — existing bug: €0 set-component lines on invoices.**
  `invoice-lines.ts:101` groups all `period.materials` incl. bundle
  components (snapshotted €0); filter `!m.bundleBookingId` like the pakbon
  (`grouping.ts:85`). Applies to shortages with `bundleBookingId` too.
- **M — add the unresolved-shortage guard to regenerate and finalize** for
  `kind = invoice` (today only create checks, `create-draft-invoice.ts:31-42`);
  quotes exempt.
- Note: `groupMaterialAssignments` already accepts shortages
  (`grouping.ts:48-77`) — the change is smaller than described. Effort S.

### C2
- **B — a quote can draw a legal invoice number.** `finalize-invoice.ts:43`
  maps every non-creditnota to series `invoice`, and the reused detail page
  shows "Finaliseren" for any concept (`facturen/[id]/page.tsx:51`).
  `finalizeInvoice` must throw for `kind` ∉ {invoice, creditnota}; quotes use
  their own `sendQuote` (allocates only when `number` is null, so a reopened
  quote keeps its number); widen the series union in `invoice-numbering.ts:15,37`.
  Test: finalizing a quote → 409, `InvoiceCounter('invoice')` unchanged.
- **M — exclusion list, complete:** use a positive allowlist
  (`kind: "invoice"` / `in [invoice, creditnota]`) in: `compute-stats.ts:39`
  (also feeds the dashboard KPI `(app)/page.tsx:93`), `invoices-export.ts:36`,
  `GET /api/invoices` default when `?kind` absent, `invoice-prior-deposits.ts:19`,
  `assertPayable` (`invoice-payments.ts:52` → `kind !== "invoice"`),
  `createCreditNote` (:48), `regenerateInvoice`, `finalizeInvoice`, detail
  page payments panel + credit button, `serializeInvoice` remainingBalance.
  Every `status: {not: "concept"}` query also needs the kind filter
  (aanvaard/geweigerd share the column).
- **M — quotes make projects undeletable**: `Invoice.project` has no
  `onDelete` (Restrict, `schema.prisma:439`) and `DELETE /api/projects/[id]`
  surfaces it as a raw 500. Delete concept/geweigerd quotes in the same
  transaction; 409 with a clear message otherwise. (Same raw-500 exists for
  clients today.)
- **M — accept is one server endpoint**: `POST /api/quotes/[id]/accept` runs
  `fillShortages`, then one transaction: `assertNoShortages` + promote project
  **only if it is `concept`** (never downgrade `actief`) + quote `aanvaard`.
  Requires `kosten_facturen: wijzigen` **and** `projecten: wijzigen`;
  scope own forbidden.
- **M — conversion:** store `depositBasisExcl` = quote net excl. total and make
  regenerate honour `sourceQuoteId`; at most one non-credited full conversion
  per quote; **one accepted quote per project** (accepting a second rejects or
  supersedes — PM point); keep per-line VAT verbatim, re-read only the client
  snapshot.
- m — a quote needs `clientId` (`create-draft-invoice.ts:46-49`): projects with
  only the free-text client can't be quoted — tell the PM.
- Effort **L+**.

### C3 — split into C3a (model, subhire dialog/endpoint, gating, billing, redaction) and C3b (stats/margin, import, pakbon, `subhireOnly` auto-resolve)
- **M — shortage write paths must filter `supplierId: null`:**
  `createOrIncrementShortage` `findFirst` (`shortage-row.ts:31-40` — would add
  open units into a subhired row at a stale cost); `fillShortages`
  (`material-shortage-db.ts:55-58` — would convert subhired rows into owned
  stock); `removeOneFromGroup` (`use-material-split-mutations.ts:94-99` —
  existing bug: "−1" on the last shortage row deletes the whole row);
  `PATCH/DELETE shortages/[shortageId]` must check the row belongs to the URL's
  period.
- **M — read sites that must split resolved vs open:**
  `listProjectShortages` (`material-shortage-db.ts:22-39`),
  `projectShortageLines` (`project-shortages.ts:20-31`) → overbook alert +
  header badge, `mergeShortagesIntoGroups` (add `subhiredUnits`),
  `kosten-period-table.tsx:88-90` (**client-facing print — must not show
  "ingehuurd"/"overboekt" for resolved units**), `material-cost-row.tsx:42`,
  `material-group-row.tsx:23-47`, `period-bookings.tsx:67`,
  `material-split-editor.tsx:48-60`.
- **M — money plumbing:** add `subhireUnitCost`/`subhireCostOverride` to the
  `redactMoney` denylist (`redact.ts:41-80`); `Material.subhireCost` to
  `materialMoneyData` / `serializeMaterialMoney` (`material-money-fields.ts`)
  and `MONEY_WRITE_FIELDS` (`money-write-guard.ts:6`); convert in every nested
  material spread in `serialize-project.ts` and the raw `...updated` in the
  shortage PATCH (`route.ts:37-43`). Subhire routes are gated on
  planning/materialen, so apply `moneyVisible` to cost fields explicitly.
- **M — booking-time subhire is atomic**: pass a `subhire` arg into
  `bookFlatMaterial` / `bookBundleMaterial` and create the resolved row inside
  the same `lockMaterials` transaction; the subhire/split endpoint takes
  `lockMaterials` too. `subhireOnly` requires `defaultSupplierId`.
- **M (simplification, replaces the stored total):** store
  `subhireCostBasis` + `subhireUnitCost` + optional `subhireCostOverride`;
  compute the total at read time (`qty × unit × periodDays()` for `per_dag`).
  Drops `subhireCost`, `subhireCostManual` and every recompute hook.
- m — use `periodDays()` (`pricing.ts:7-16`) verbatim; H6 is people-only.
- m — FKs: `Restrict` on shortage → supplier (SetNull would silently re-block
  a project); `SetNull` on `Material.defaultSupplierId`.
- m — supplier list hidden from scope own.
- m — "Marge" = **booked** revenue − inhuurkost (state it on the KPI).
- Effort **XL** total.

### C4
- **M — scope-own visibility must use `AND`**: the search sets `where.OR`
  (`notes.ts:72-75`); an "own project OR assigned" clause written as `OR`
  would be overwritten → a freelancer's search returns company-wide notes.
  Use `where.AND = [{ OR: [{ project: scopeFilter(access) }, { assignees:
  { some: { personId } } }] }]`. Integration test "own + q".
- **M — null personId**: `{ personId: access.personId ?? undefined }` matches
  every assigned note in Prisma. Use the `-1` sentinel (`scope-filter.ts:34`)
  or short-circuit to `[]`.
- **M — person picker**: `GET /api/people` needs `personen: lezen` and 403s
  scope own (`api/people/route.ts:19-26`). Add slim
  `GET /api/notes/assignable-people` (id + name), gated `notities: wijzigen`.
  Scope own never sets/changes `assigneeIds` (drop like `notes/[id]/route.ts:59-60`).
- **M — PUT semantics**: `assigneeIds` undefined = unchanged, `[]` = clear;
  diff instead of delete+recreate so `doneAt` survives.
- **M — done toggle** = `notities: lezen` + caller is an assignee +
  `personId != null` (a self-status, not a content edit), with `allowOwnWrite`.
- m — dashboard card gate: hide when `me.personId == null` (not
  `linkedPersonMissing`, which is only true for scope own).
- m — rename sites: also `note-link-picker.tsx:72`; keep API param
  `unassigned`; the overbook "Toewijzen" (`project-overbook-alert.tsx:101`,
  `overbook-block-dialog.tsx:59`) is out of scope. There are no notes tests
  today — write them.
- m — assignment explicitly shares the note (body, photos, client name) with an
  assigned freelancer; hide the project link when out of scope. `getNote` is
  the single choke point for image routes — test it.
- m — Person delete is a hard delete; the cascade drops their done-state.
- m — extract `NoteAssigneePicker` and `AssignedToMeCard`
  (`note-form-dialog.tsx` is 140 lines). Add notes routes to
  `scope-enumeration.test.ts`.
- Effort **M+**.

### C5
- **M — `useSearchParams` without `<Suspense>` fails `next build`** on the
  static `/projects` route (works in dev). Copy the planning page pattern
  (`planning/page.tsx:33-58,120-124`): `…PageContent` in `<Suspense>`,
  `parseStatusParam`/`serializeStatusParam` in `project-filter.ts`,
  `router.replace(url, { scroll: false })`.
- m — absent param = Lopend; invalid values dropped; empty selection = Alles;
  "Alles" serializes as no param + `status=all`. Pure parse/serialize tests.

### C6
- **M — no C3 dependency** (see execution order). Drop the `subhireOnly`
  mention; 0-stock Funrent items are already non-archived materials.
- **M — one set-price helper**: the formula exists 3× today
  (`materials-list.ts:83-86`, `periods/[id]/materials/route.ts:60-64`,
  `materials/available/route.ts:94-100`). Extract `setDayPrice()` and use it
  everywhere; include archived children like booking does. Test it equals the
  booking snapshot.
- m — crew rates resolve **per field** (client dayRate set, hourRate null →
  hour falls back), exclude archived functions and functions with no rates;
  label crew prices "indicatief / vanaf" (per-person overrides exist,
  `effective-price.ts:46-113`).
- m — permissions: `materialen: lezen` + `moneyVisible`; crew section also
  `personen: lezen`; client picker only with `klanten: lezen`; hide the menu
  item without money access.
- m — include `setupCost` column; category = `categoryRel?.name ?? category ??
  "Overig"`; BTW toggle reads `btwRate` server-side; the raw export stays as is.
- The settings gotcha moved to **P1**.

### C7
- **M — drop step 4 (touching `Period.updatedAt`).** The full write-path list
  is ~10 places (booking, bundle-booking, shortage-row, fillShortages incl. the
  project status PUT, assignment delete, shortage PATCH/DELETE, bundle delete,
  future C3 writes), and crew/project/location edits don't bump it either —
  the existing feed already has that gap. Subscription clients re-read the
  feed wholesale. Verify with Google/Apple/Outlook during implementation; if
  one caches by SEQUENCE, add a single `touchPeriods(tx, ids)` in the shared
  lib functions instead.
- **M — load materials only for periods with `endDate >= now − 7d`**, in one
  separate query (`periodId in ids`); `buildPersonFeedIcs` loads every
  assignment ever (`calendar-feed-ics.ts:72-89`).
- **M — summarizer** skips component rows on both `PeriodStockItem` and
  `PeriodMaterialShortage` (`bundleBookingId != null`), aggregates by
  `materialId` (not `groupMaterialAssignments`, which keys on price), sums
  multiple shortage rows; set qty from `PeriodBundleBooking.quantity`.
- m — never select Material.notes, Location.notes/phone or any snapshot.
  Materials appear regardless of the `materialen` module (consistent with
  own-data-scoping requirement 3) — open point.
- m — new file `calendar-feed-materials.ts` (`calendar-feed-ics.ts` is 128 lines).

### Testing constraint (all items)
`vitest.config.ts` runs in `node`; there are no `.tsx` tests and no route
harness. Put every permission/parsing rule in `src/lib/*` and test it there, or
as SQLite integration tests in the style of `calendar-feed.integration.test.ts`.

### Open points added by review (for the PM)
- C2: one accepted quote per project? What happens to a second accepted quote?
- C2: projects with only a free-text client can't get a quote (needs a client).
- C4: assignment shares the note incl. photos + client name with freelancers.
- C5: empty status selection shows everything.
- C6: crew prices are indicative; setup cost shown as a separate column.
- C7: materials show in personal feeds even for roles with `materialen: geen`.
