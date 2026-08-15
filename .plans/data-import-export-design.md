# Data import/export — design doc

> Status: **draft, for approval.** Blocks M1 detail (phase 2) and P2/P3 (phase 4) per `.plans/tasks-round2/00-README.md:81`.
> Governing principle (locked): **round-trip symmetry** — everything RentFlow can export must be importable in the same format. The export column set and the import adapter are designed here as **one contract per entity**, not two.
> Source decisions: `.plans/2026-08-po-feedback-round2.md` Q34b, Q36a–c, Q44a/b, Q45a, Q48, Q49, Q49b (lines 49–66); workstreams M (lines 460–517) and P (lines 611–642); task briefs `.plans/tasks-round2/03-phase2.md` (M1, J2a) and `.plans/tasks-round2/05-phase4.md` (O1, P2, P3, L4).

## 0. Locked decisions this doc must satisfy

| # | Decision | Source |
|---|---|---|
| Q36a | Material import matches on `code`, updates existing | roadmap:51 |
| Q36b | Auto-create the 11 categories from `Folder`; always preview before writing | roadmap:52 |
| Q36c | Store purchase price + list price only; no dimensions/weight/power/critical stock | roadmap:53 |
| Q34b | The "advanced" file's 287 rows import as archived **and** hidden | roadmap:49 |
| Q44b | Data export **and** import, with an update mode and a truncate-and-replace mode | roadmap:61 |
| Q49 | Truncate is per-entity only — no system-wide reset | roadmap:65 |
| Q49b | A replace that would remove records still referenced by bookings/invoices is refused with an exact blocker list; no cascade, no archive-instead-of-delete fallback | roadmap:66 |
| — | Replace: ADMIN-only via the module matrix, typed confirmation, mandatory preview, one transaction, audit log | prompt (DECIDED-FINAL) |
| — | Exports respect module permissions + own-data scoping; omit money columns entirely for roles without `Kosten/Facturen: lezen` | prompt (DECIDED-FINAL) |
| — | Invoices are never replace-importable (gapless numbering, sent invoices immutable) | roadmap:640, phase4.md:108 |

---

## 1. The round-trip contract

Four entities get a paired export+import contract: **materials, people, clients, locations**. Each table below is the single column list used by both directions — an exporter and an importer that disagree on this table are, by definition, a bug.

### 1.1 Design choice: match key per entity

`Material.code` is a real external business key (`@unique`, `prisma/schema.prisma:150`) and Q36a explicitly chose it as the match key. **No such key exists for People, Clients or Locations** — verified: `Person` (`schema.prisma:127–143`), `Client` (`:21–33`) and `Location` (`:35–44`) declare no `@unique` field besides the surrogate `id`; `email` on `Person`/`Client` is a plain nullable `String?`. Guessing an identity match on `name` or `email` risks silently merging two different people who share a name, or updating the wrong row on an email typo. This design therefore uses **`id` as the match key for People/Clients/Locations when the column is present and resolves to an existing row** (the normal case: RentFlow's own export, re-imported) — **any row whose `id` is blank or does not resolve is always treated as `new`**, never matched by name. This is a deliberate, conservative default; flagged as an open risk in §13 since the PO did not decide it explicitly.

### 1.2 Materials

| Column | Target | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `Material.id` | integer | optional | informational only — **not** the match key for materials |
| `code` | `Material.code` | string\|null | recommended | **match key** (Q36a); `@unique`, `schema.prisma:150`; blank on a new row → auto-generated once a category resolves, via `nextCode()` (`src/lib/material-code.ts:1–14`, see §2.2 fix) |
| `name` | `Material.name` | string | required | |
| `category` | `Category.name` | string\|null | optional | auto-created if new (Q36b) |
| `categoryPrefix` | `Category.prefix` | string\|null | optional | only consulted when the category doesn't exist yet — see §2.2 for the prefix-format fix this requires |
| `dayPrice` | `Material.dayPrice` | number | required (default 0) | |
| `setupCost` | `Material.setupCost` | number\|null | optional | |
| `costPrice` | `Material.costPrice` *(new, DDL-2)* | number\|null | optional | feeds K4 payback |
| `listPrice` | `Material.listPrice` *(new, DDL-2)* | number\|null | optional | |
| `revenueBefore` | `Material.revenueBefore` *(new, DDL-2)* | number\|null | optional | never overwritten by a re-import unless the column is explicitly present and non-blank (§6) |
| `isBundle` | `Material.isBundle` | boolean | optional (default false) | |
| `bundlePriceOverride` | `Material.bundlePriceOverride` | number\|null | optional | |
| `archived` | `Material.archived` *(new, DDL-2)* | boolean | optional (default false) | |
| `notes` | `Material.notes` | string\|null | optional | |
| `stockCount` | count of `StockItem` rows | integer | optional | **write-only on create.** For a brand-new material, generates `stockCount` fresh `StockItem` rows (`unitNumber` 1..N, `identifier: null`). Ignored for a material matched by `code` — its existing `StockItem` rows carry booking history via `PeriodStockItem` (`schema.prisma:189–203`) and are never regenerated by an update-mode import |

`DDL-2` fields per `.plans/tasks-round2/03-phase2.md:49` (`Material.archived/costPrice/listPrice/revenueBefore`, `StockItem.costPrice`).

### 1.3 People

| Column | Target | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `Person.id` | integer | optional | **match key** (§1.1) |
| `name` | `Person.name` | string | required | |
| `role` | `Person.role` | string\|null | optional, **transitional** | column exists only until L4 retires it (`.plans/tasks-round2/05-phase4.md:118–134`); drop it from both directions the same commit L4.2 drops the schema column |
| `email` | `Person.email` | string\|null | optional | not unique — never a match key |
| `phone` | `Person.phone` | string\|null | optional | |
| `address` / `postalCode` / `city` / `country` | `Person.*` | string\|null | optional | |
| `dayPrice` | `Person.dayPrice` | number | required (default 0) | money — omit for callers without `Kosten/Facturen: lezen` (§9) |
| `functions` | `PersonFunction` via `Function.name` | comma-separated string | optional | one join row per matched name; unmatched names are reported in the preview, never silently created (mirrors L2.1's backfill discipline, `.plans/tasks-round2/03-phase2.md:125`) |

### 1.4 Clients

| Column | Target | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `Client.id` | integer | optional | **match key** (§1.1) |
| `name` | `Client.name` | string | required | |
| `contactName` | `Client.contactName` | string\|null | optional | |
| `email` | `Client.email` | string\|null | optional | |
| `phone` | `Client.phone` | string\|null | optional | |
| `address` / `postalCode` / `city` | `Client.*` | string\|null | optional | |
| `vatNumber` | `Client.vatNumber` | string\|null | optional | this is the field J2b will snapshot onto invoices Peppol-shaped (roadmap:347) — keep the column name stable across that future change |
| `notes` | `Client.notes` | string\|null | optional | |

### 1.5 Locations

| Column | Target | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `Location.id` | integer | optional | **match key** (§1.1) |
| `name` | `Location.name` | string | required | |
| `address` / `postalCode` / `city` | `Location.*` | string\|null | optional | |
| `phone` | `Location.phone` | string\|null | optional | |
| `notes` | `Location.notes` | string\|null | optional | |

### 1.6 Projects, bookings, invoices — export only, and why

| Entity | Exportable (P2) | Importable | Reason |
|---|---|---|---|
| Projects | yes | **no** | A project's real content is a graph — periods, person/material assignments, price snapshots, discounts (`Period`/`PeriodPerson`/`PeriodStockItem`/`PeriodBundleBooking`, `schema.prisma:115–249`). Flattening that into one spreadsheet row and re-inflating it on import risks silently wrong bookings; a project export is a **report/backup format**, not a paired import contract. This is a deliberate scope line, not an oversight |
| Bookings (`PeriodPerson`/`PeriodStockItem`/`PeriodBundleBooking`) | yes | **no** | Same reasoning — these are snapshot-priced children of a period; importing them out of context needs the parent project+period to already exist and match, which is project-import in disguise |
| Invoices | yes (P2.3) | **no import at all — stricter than the minimum ask** | The prompt requires only that *replace* be forbidden; this design forbids **update-mode import too**. Rationale: `Invoice.number` is gapless and sequential (J2b, roadmap:345), and once a status leaves `concept` every figure is frozen and immutable (roadmap:346). An "upsert" import is indistinguishable from editing a sent invoice's frozen amounts — exactly what J2b's accept criteria forbid. So the P3 entity picker (§10) never lists Invoices as an import target, in either mode — not merely "replace disabled for this one entity" |

---

## 2. The Rentman material mapping

### 2.1 File facts (independently re-verified against the real CSVs)

| | `Export_Equipment_normal.csv` | `Export_Equipment_advanced.csv` |
|---|---|---|
| Rows / unique `ID` / unique `Code` | 113 / 104 / 103 | 287 / 287 / 287 |
| `Type of equipment` | 109 Physical item, 3 Virtual combination, 1 Physical combination | 287 Physical combination |
| `Archived` | 0 for all | 1 for all |
| `Display in planner` | 1 for all | 0 for all |
| `Stock calculation method` | 16 Serialized rows, 97 Bulk rows | 287 Bulk |
| `Folder (Folder)` | 11 distinct values (`0201-Catering`:24, `9998-Inhuur Funrent`:22, `0501-Tenten`:18, `0301-Light`:13, `0401-Meubilair`:11, `0701-Podium opbouw`:10, `0601-Video`:9, `9999-Afwas en opruimen`:2, `0101-Audio`:2, `1101-Communicatie`:1, `9997-Inhuur Rent-men`:1) | empty for all 287 |
| Zero-priced rows | 4 (`0201-011 Aciet`, `0201-018 Ijs schepper`, `0501-901 Cassette Vloer`, `0701-008 Diagonaal 2.57x50`) | 287 (all) |
| Non-standard code shape | 2 plain-digit codes (`898`, `00000`); rest match `NNNN-NNN` | all plain 3-digit, no dupes |
| `Internal remark` populated | 2 rows (`0501-011`, `0501-012`, both "Terras verwarmmer") | none |
| `List price` populated | 1 row (`0201-019` = 190) | 0 |
| `Combination structure` populated | 0 of 113 | 0 of 287 |

The 82 columns were counted directly from the header row of both files (identical layout) — headers 1–15 are Rentman/webshop admin metadata, 16–48 are equipment-level fields, 49–57 are equipment identity/accounting fields, 58–82 are per-serial ("Exemplaar") fields. Full mapping in §2.4.

### 2.2 Row grain, dedup, and the true code collision

Rows are a flattened equipment × serial-number join. Grouping must key on **`ID`, not `Code`** — verified for all "duplicate code" groups in the normal file:

| Code | Rows | Unique `ID`s | Names | Stock method |
|---|---|---|---|---|
| `0501-003` | 2 | `{697}` | Tent 5x10 | Serialized |
| `0201-010` | 5 | `{715}` | Horeca Frigo | Serialized |
| `0501-001` | 4 | `{720}` | Tent 4x8 | Serialized |
| `0501-002` | 2 | `{1266}` | Tent 8x20 | Serialized |
| `9998-902` | 2 | **`{707, 708}`** | **Messen (Vis)** / **Vorken (vis)** | Bulk |

Four of the "5 duplicate codes" are exactly the expected shape: one equipment `ID`, several serial rows (Serialized stock method), consistent `Code`/`Name` across the group — not a data problem, just the row grain. **Only `9998-902` is a genuine collision**: two different pieces of equipment (`ID 707`, `ID 708`) both claim the same code. Dedup algorithm:

1. Group all rows by `ID`. Take equipment-level fields (name, code, folder, price, type, archived, notes, cost/list price) from the group's first row — they are identical within a genuine group (verified above).
2. For `Serialized` groups, emit one `StockItem` per row using the identifier fallback chain already established in `prisma/seed.ts:239` (`Manufacturer serial number` → `Display name` → `Internal reference`). For `Bulk` groups (single row), synthesise `Current quantity` fresh `StockItem` rows.
3. After grouping, 104 `ID`-groups remain but only 103 distinct codes — the `9998-902` pair. Resolution: the **first-seen `ID` (lowest `ID`, i.e. `707`, "Messen (Vis)") keeps the code; the second (`708`, "Vorken (vis)") is classified `skipped`**, reason `"code 9998-902 already claimed by ID 707 (Messen (Vis))"`. This is more conservative than auto-renaming (see §13 for the alternative and why it was not chosen).

### 2.3 Category / prefix mapping — a required fix to `nextCode()`

`Folder (Folder)` is shaped `NNNN-Name` (e.g. `0501-Tenten`). Storing the full 4-digit prefix as `Category.prefix` looks like the obvious mapping, but it breaks the existing code-generator:

- `nextCode(prefix, existingCodes)` (`src/lib/material-code.ts:1–14`) matches codes with the pattern `` `^${prefix}01-(\d{3})$` `` — it hard-codes a `"01"` middle segment after a **2-character** prefix. The existing seed data stores exactly that shape (`"05"`, `"02"`, … — `prisma/seed.ts:89–100`, `:331–335`). A 4-digit prefix (`"0501"`) would make the pattern `^050101-(\d{3})$`, which never matches a real code like `0501-003` — silently breaking auto-numbering for every imported category.
- But truncating to 2 digits collides: three of the eleven real folders share the same first two digits — `9998-Inhuur Funrent`, `9999-Afwas en opruimen`, `9997-Inhuur Rent-men` would all map to prefix `"99"`, merging three distinct categories' numbering ranges.

**Required fix, shipped inside M1, as its own reviewable commit:** change `nextCode()`'s pattern to `` `^${prefix}-(\d{3})$` `` (drop the hard-coded `"01"`), and store the **full 4-digit Folder prefix** in `Category.prefix` (`"9998"`, `"0501"`, …). This is backward-compatible: migrate existing categories' `prefix` from `"05"` → `"0501"` etc. using the mapping already in `prisma/seed.ts:331–335`, which produces byte-identical matched strings under the new pattern for every already-issued code. Add a regression test asserting every pre-existing code still resolves under its category after the rewrite.

### 2.4 Combination types: `isBundle` is not just "combination = true"

Four rows in the normal file are combination types:

| Code | Name | Type | Stock method | Qty | Price |
|---|---|---|---|---|---|
| `0201-017` | Schepijs vriezer | **Physical** combination | Bulk | 1 | €55 |
| `0201-999` | Tap + aciet | **Virtual** combination | Bulk | 1 | €75 |
| `0401-006` | cocktailtafel met hoes (zwart) | **Virtual** combination | Bulk | 15 | €8 |
| `0401-011` | Buffettafel met hoes (zwart) | **Virtual** combination | Bulk | 11 | €8 |

(The `cocktailtafel`/`Buffettafel` quantities — 15 and 11 — match the K4 payback worked examples in the roadmap exactly: "15 cocktailtafels + 15 hoezen, 11 buffettafels + 11 hoezen", roadmap:396.)

**Design decision — `Type of equipment` does not map 1:1 onto `Material.isBundle`:**

- `Virtual combination` → `Material.isBundle = true`, **zero `StockItem` rows generated**. RentFlow bundles hold no stock of their own — confirmed by the existing model: the seed's own demo bundle creates no `StockItem` for the bundle material itself (`prisma/seed.ts:536–553`), and stock is instead computed live from `MaterialComponent` recipes (`src/lib/bundle-stock.ts`, read via `src/app/api/materials/route.ts:61–77`). Since `Combination structure` is empty for every row in both files (verified, §2.1), all `Virtual combination` rows import as **empty-recipe bundles** — their contents must be entered by hand. Say this explicitly in the import report.
- `Type of equipment == "Physical combination"` → **`Material.isBundle = false`**, imported as an ordinary material with real generated stock, exactly like `Physical item`. Rationale: every `Physical combination` row in both files carries a normal `Stock calculation method` + `Current quantity` (`Schepijs vriezer`: Bulk, qty 1; all 287 rows of the advanced file: Bulk, qty 1 each) — Rentman is using this type for a single physical asset that happens to permanently bundle sub-parts (a pre-packed flightcase, an assembled unit), not a recipe assembled from other equipment's stock at booking time. Importing the 287 advanced-file rows as `isBundle=true` empty-recipe bundles would create 287 permanently unbookable, componentless bundles; importing them as ordinary archived materials with one stock unit each is correct and needs no manual recipe entry.
- Net effect: normal file → 3 empty-recipe bundles (`Tap + aciet`, both "met hoes" sets) + 1 ordinary Bulk material (`Schepijs vriezer`). Advanced file → all 287 import as ordinary archived materials, never as bundles.

This refines the flatter "Physical/Virtual combination → true" reading in `.plans/2026-08-po-feedback-round2.md:491` and `.plans/tasks-round2/03-phase2.md:250` — flagged for approval alongside the rest of this doc.

Also verified: `archived`/`Display in planner` move in lockstep in both files (0/1 and 1/0 respectively, no mixed rows) — but since they are two independent Rentman columns, the importer should treat `Material.archived := source.Archived == "1" || source.Display_in_planner == "0"` rather than trusting `Archived` alone, in case a future export decouples them.

### 2.5 Full 82-column mapping

| # | Source column | Target | Notes |
|---|---|---|---|
| 1 | Created on | not imported | Rentman audit metadata |
| 2 | Last change | not imported | |
| 3 | Name (in database) | `Material.name` | |
| 4 | Code | `Material.code` | **match key** (Q36a) |
| 5 | Internal remark | `Material.notes` | populated on 2 rows |
| 6 | External remark | not imported | webshop text, declined |
| 7 | Measuring unit | not imported | declined (Q36c) |
| 8 | In webshop | not imported | |
| 9 | Surface item | not imported | |
| 10–14 | Webshop SEO/description fields | not imported | webshop integration out of scope |
| 15 | Webshop featured product | not imported | |
| 16 | Rental-/Sales price | `Material.dayPrice` | |
| 17 | Margin price | `Material.costPrice` | Rentman's cost/margin-basis field; **0/113 populated in this sample** — mapping is structural, not empirically confirmed (§13 open risk) |
| 18 | Critical stock | not imported | declined (Q36c) |
| 19 | Type of equipment | `Material.isBundle` | see §2.4 — not a direct boolean cast |
| 20 | Rental/sales | not imported | uniformly "Rental"; no sales-mode concept in RentFlow |
| 21 | Stock calculation method | drives `StockItem` generation strategy | not stored itself |
| 22 | Display in planner | folds into `Material.archived` | see §2.4 |
| 23 | Archived | `Material.archived` | |
| 24 | List price | `Material.listPrice` | |
| 25–32 | Transport volume, Height, Width, Length, Weight, Empty weight, Power, Current | not imported | declined (Q36c) |
| 33 | Default equipment group | not imported | duplicates `Folder` in this export (identical per sample); `Folder` is authoritative |
| 34 | The equipment can have content | not imported | informational only |
| 35 | Physical/Virtual | not imported | redundant with column 19 in this export; uniformly "Physical equipment" |
| 36 | Content editable in project | not imported | |
| 37 | Restrict actual content | not imported | |
| 38 | Price incl. VAT | not imported | derivable from `dayPrice` × (1+VAT); no need to store a duplicate |
| 39 | VAT rate | not imported | uniformly 0.21; RentFlow VAT is a global setting (Q25a) |
| 40 | Has accessories | not imported | |
| 41 | Number of images | not imported | Q34c — no material attachments |
| 42 | Tags | not imported | no tag concept on `Material` |
| 43 | Current quantity excl. reserved for combinations | not imported | Rentman reservation accounting RentFlow doesn't model |
| 44 | Current quantity | drives `StockItem` count for Bulk materials | not stored itself |
| 45 | Quantity reserved for combinations | not imported | |
| 46–48 | Location in default/warehouse stock location, Total stock per location | not imported | no warehouse-location concept; redundant with column 44 in this single-warehouse export |
| 49 | ID | import bookkeeping only | the row-grouping key (§2.2); never stored on `Material` |
| 50 | Created by (Created by) | not imported | |
| 51 | Folder (Folder) | `Category.name` + `Category.prefix` | auto-created (Q36b); see §2.3 for the prefix fix |
| 52–54 | Factor group, Discount group, VAT class | not imported | declined (Q36c) |
| 55 | Main image (Main image) | not imported | Q34c |
| 56–57 | Ledger - credit / debit | not imported | accounting-system integration, out of scope |
| 58–59 | Created on / Last change (Serial number) | not imported | |
| 60 | Display name (Serial number) | `StockItem.identifier` fallback #2 | mirrors `prisma/seed.ts:239` |
| 61 | Manufacturer serial number (Serial number) | `StockItem.identifier` fallback #1 | mirrors `prisma/seed.ts:239` |
| 62 | Date of purchase (Serial number) | not imported | declined (Q36c) |
| 63 | Active (Serial number) | folds into `StockItem.notes` | `"Inactive in source"` flag when `0`, mirrors `prisma/seed.ts:242` |
| 64 | Remark (Serial number) | `StockItem.notes` | |
| 65 | Internal reference (Serial number) | `StockItem.identifier` fallback #3 | mirrors `prisma/seed.ts:239` |
| 66–67 | Guarantee date, Replacement date | not imported | |
| 68 | Current book value (Serial number) | not imported | declined (Q36c "book value") — distinct from `Margin price`/`costPrice`, which is the material-level purchase cost, not a depreciated per-unit value |
| 69 | Tags (Serial number) | not imported | |
| 70 | Seal (Serial number) | not imported | |
| 71 | Actual content from (Serial number) | not imported | empty in both files |
| 72 | Combination structure (Serial number) | **not populated in either export** | this is the field that would carry a bundle's recipe — its absence is why combination rows import as empty shells (§2.4) |
| 73 | ID (Serial number) | import bookkeeping only | uniquely identifies the exemplar row; not stored |
| 74 | Created by (Serial number, Created by) | not imported | |
| 75 | Equipment (Serial number, Equipment) | not imported | redundant with column 3 |
| 76 | Supplier (Serial number, Supplier) | not imported | declined |
| 77–78 | Assigned to, Managed by (Serial number) | not imported | |
| 79 | Main image (Serial number, Main image) | not imported | Q34c |
| 80 | On subproject (Serial number, On subproject) | not imported | |
| 81–82 | Lost, In repair (Serial number) | not imported | declined — no such concept on `StockItem` |

**Consolidated not-imported list (Q36c, declined):** dimensions/weight/volume/power/current, critical-stock threshold, ledger accounts, factor/discount groups, all webshop fields, purchase date, per-unit book value, tags, images, warehouse locations, "lost"/"in repair" flags, VAT class/rate.

---

## 3. Format detection

Only **materials** accept two input shapes; People/Clients/Locations only ever accept RentFlow's own layout.

- `detectFormat(headers: string[]): "rentflow" | "rentman-equipment" | "unknown"`.
- **Rentman**: header set contains the anchor columns `Code`, `Folder (Folder)`, `Stock calculation method`, `Type of equipment` (all four, exact Rentman casing/spacing) — these four are distinctive enough that a false match against RentFlow's own header set is not realistic (RentFlow's own headers are plain lowerCamel field names with no `(Serial number)` suffixes).
- **RentFlow-native**: header set is an exact match (or a superset containing all *required* columns) of the §1 table for the target entity.
- **Unknown**: neither anchor set matches → reject before parsing any row, with an error naming which required headers are missing. Never attempt a partial/best-effort mapping on an unrecognised layout.
- Detection reads the **parsed header row**, not the file extension — Rentman ships `.xlsx`, but a user may re-save as `.csv`; RentFlow's own export is `.csv` (§8) but a hand-edited copy might arrive as `.xlsx`. Extension only selects which *parser* runs first (§8); the header check is what actually classifies the content.
- This is a deliberate simplicity choice: with exactly two accepted shapes and structurally disjoint header sets, a fuzzy/heuristic detector would add risk (silent misclassification) for no benefit over an exact anchor-column check.

---

## 4. The parse → preview → apply pipeline

Shared architecture, so M1 (materials, phase 2) and P3 (generalised, phase 4) are the same code, not a rewrite:

```
parseFile(buffer, filename)
  → detectFormat(headers)
  → ParsedRow[]  (normalised, each carrying its 1-based source line number)
  → classify each row via the entity adapter → RowClassification
  → build ImportPreview (never writes)
[confirm]
  → mode "update": upsert each classified row inside one transaction
  → mode "replace": run adapter.referentialChecks() first; abort with blockers if any;
                    else truncate + bulk-insert every row, one transaction
```

### 4.1 `EntityAdapter<T>` interface

```ts
interface EntityAdapter<T> {
  entity: "materials" | "people" | "clients" | "locations";
  acceptedFormats: FormatId[];              // e.g. ["rentflow"] or ["rentflow","rentman-equipment"]
  parseRow(raw: RawRow, format: FormatId): T | ParseError;
  matchKey(row: T): string | number | null; // code for materials; id for the other three (§1.1)
  diffAgainstExisting(row: T, existing: T | null): RowClassification;
  applyRow(row: T, tx: PrismaTx): Promise<void>;
  referentialChecks(tx: PrismaTx): Promise<BlockingReference[]>; // replace mode only
}
```

Every pipeline stage calls the adapter — it never re-implements per-entity logic inline. This mirrors the project's existing "one mechanism, not three copies" discipline (the same principle L1.2 applies to price resolution, `.plans/tasks-round2/03-phase2.md:99`).

### 4.2 Sequencing recommendation (see §12 for the full argument)

Build the pipeline as the **entity-agnostic engine from the start**, in M1 (phase 2), not as a materials-only implementation P3 (phase 4) later lifts:

- `src/lib/import/pipeline.ts` — the stage sequence above, entity-agnostic.
- `src/lib/import/adapters/material.ts` — the first (and, in phase 2, only) adapter.
- `src/lib/import/csv.ts` — the CSV reader, extracted from `prisma/seed.ts:31–79` per the DDL-2 instruction already in the phase-2 brief (`.plans/tasks-round2/03-phase2.md:56`).
- `src/lib/import/xlsx-reader.ts` — the Rentman-format reader (§8).

P3 (phase 4) then adds `adapters/person.ts`, `adapters/client.ts`, `adapters/location.ts` and the `replace` branch — no rewrite of `pipeline.ts`, satisfying the phase-4 brief's own constraint that "M1's behaviour must not change" (`.plans/tasks-round2/05-phase4.md:96`) because there is no behaviour to preserve across a rewrite that never happens.

---

## 5. The preview contract

```ts
interface ImportPreview {
  entity: "materials" | "people" | "clients" | "locations";
  mode: "update" | "replace";
  sourceFormat: "rentflow" | "rentman-equipment";
  totals: { new: number; updated: number; unchanged: number; skipped: number; errored: number };
  rows: ImportRowPreview[];
  blockers?: ReplaceBlocker[];  // present only for mode "replace"; presence means apply is refused
}

interface ImportRowPreview {
  line: number;                 // 1-based source row number, header excluded
  classification: "new" | "updated" | "unchanged" | "skipped" | "errored";
  matchKey: string | number | null;
  summary: string;              // e.g. "Tent 5x10 (0501-003)"
  changes?: { field: string; from: unknown; to: unknown }[];  // "updated" only
  reason?: string;               // always present for skipped/errored
}

interface ReplaceBlocker {
  entityId: number;
  label: string;                 // e.g. "Tent 5x10 (0501-003)"
  blockedBy: { relation: string; count: number }[]; // e.g. [{ relation: "PeriodStockItem (bookings)", count: 4 }]
}
```

`totals.skipped + totals.errored` never abort processing of the remaining rows (§6). `apply` must be called with a hash/token of the exact preview the user confirmed, so a file cannot be swapped between preview and confirm without generating a fresh preview.

---

## 6. Dirty-data rules

| Condition | Rule | Classification |
|---|---|---|
| Duplicate code, same `ID` (multi-serial join) | Not an error — group into one `Material` with N `StockItem`s | `new`/`updated` as normal |
| Duplicate code, different `ID` (the `9998-902` case, §2.2) | First-seen `ID` keeps the code; every later row is rejected with a named reason, never silently renamed | `skipped` |
| Malformed / blank code on a genuinely new row | Allowed — `Material.code` is nullable (`schema.prisma:150`); do **not** auto-generate a code unless the row also has a resolvable category | `new` (with a preview warning) |
| Zero / blank `dayPrice` | Allowed, imported as `0` (4 such rows exist in the normal file) — flagged informationally, not an error | `new`/`updated` |
| Blank `Folder` | Material has no category — never auto-assigned to a default/"Overig" bucket | `new`/`updated` |
| A required column is missing from the header entirely (e.g. no `Code`/`Name`) | **File-level** failure — abort at parse time with one clear error before any row classification. This is the only case where the whole file is rejected | n/a |
| One row has an unparseable value (bad number, bad boolean) | The row is classified with the parse error and line number; every other row still classifies and, on confirm, applies normally | `errored` |
| The advanced file's `Rental-/Sales price = 0` for all 287 rows | Allowed, not flagged — irrelevant to a hidden/archived item (Q34b) | `new` |

**Rule (load-bearing): one bad row never aborts the file** — mirrors Q36b/M1's explicit instruction (roadmap:510, phase2.md:282) and is asserted directly in the test plan (§11).

---

## 7. Replace-mode guardrails

All non-negotiable per Q49b; every rule below is enforced server-side, never trusted from the client.

1. **ADMIN-only, gated on `delete` level specifically.** The four-level matrix (`none|read|write|delete`, roadmap:529) maps cleanly onto import modes: `update` requires `write` on the entity's module; `replace` requires `delete`. This is a natural extension of N1's existing level semantics, not a new concept.
2. **Typed confirmation** — the user types the exact entity label (e.g. `materialen`) into a text field before the confirm control un-disables. Never a bare OK button.
3. **Mandatory preview always precedes both modes.** The replace preview additionally lists every current row of the entity that will be deleted (by label) and every row from the file that will be created.
4. **Referential integrity — derived from the actual migrated foreign keys, not assumed:**

| Entity | Relation | `ON DELETE` as migrated | App-level check required | Why the DB alone is not enough |
|---|---|---|---|---|
| Material | `StockItem.materialId` → chains to `PeriodStockItem.stockItemId` | `CASCADE` (`prisma/migrations/0001_init/migration.sql:155`) → `CASCADE` (`:161`) | count `PeriodStockItem` via `stockItem.materialId` | the DB would **silently cascade-delete booking history**, not refuse |
| Material | `PeriodBundleBooking.materialId` → chains to its own `PeriodStockItem` children | `CASCADE` (`prisma/migrations/20260711030000_phase4_e6_bundles/migration.sql:35`) → `CASCADE` (`:38`) | count `PeriodBundleBooking` by `materialId` | same — bundle booking history |
| Material | `ProjectMaterialPrice.materialId` | `CASCADE` (`0001_init/migration.sql:143`) | count `ProjectMaterialPrice` by `materialId` | a project-specific historical price override would silently vanish |
| Material | `MaterialComponent.parentId`/`childId` | `CASCADE` (`20260711030000_phase4_e6_bundles/migration.sql:20,22`) | count rows where this material is parent or child | truncating a component used in another material's recipe silently breaks that bundle |
| Person | `PeriodPerson.personId` | `CASCADE` (`0001_init/migration.sql:167`) | count `PeriodPerson` by `personId` | booking history |
| Person | `ProjectPersonPrice.personId` | `CASCADE` (`0001_init/migration.sql:149`) | count `ProjectPersonPrice` by `personId` | historical override |
| Person | `User.personId` | `SET NULL` (`20260711010000_phase3_codes_rbac/migration.sql:26`) | not blocking — the DB already handles this safely | still surface informationally: *"N linked user accounts will be unlinked"* |
| Client | `Project.clientId` | **`SET NULL`** (`20260711000000_phase2_entity_foundations/migration.sql:72`) | count `Project` by `clientId` | **the DB will not refuse this delete** — it silently orphans the project's client reference. The application check is the *only* protection, not a backstop to a DB error |
| Client | `Invoice.clientId` (J2b, lands phase 3 — before P3 ships in phase 4) | not yet migrated at design time | **must be added to this check before P3 ships** | an invoice is a legal document; its client reference must never be silently orphaned |
| Location | `Project.locationId` | **`SET NULL`** (`migration.sql:74`) | count `Project` by `locationId` | same silent-orphan risk as Client |

   A refusal returns the full `ReplaceBlocker[]` list (§5) — never a generic "cannot delete" message.
5. **One transaction.** Reuse the interactive-transaction + advisory-lock pattern already established for booking (`src/lib/booking.ts:34,61,120` — `$transaction` + `pg_advisory_xact_lock`), so a mid-file failure rolls back completely.
6. **Audit log.** No audit mechanism exists today (verified: no `audit`/`AuditLog` file or model anywhere in `src/lib/` or the schemas). Add `ImportAudit { id, entity, mode, userId, fileName, rowCounts Json, blockedBy Json?, createdAt }`, written inside the same transaction as the apply step, so a row only exists for imports that actually committed.
7. **Never available for Invoices**, in either mode (§1.6) — the entity picker in the UI (§10) never lists Invoices at all.

---

## 8. File formats

No xlsx/csv library exists in the project today (`package.json` has no `xlsx`/`exceljs`/`papaparse`/`sheetjs` dependency — verified). The project's own convention is to hand-roll a small CSV parser rather than add a dependency (`prisma/seed.ts:31–79`), and the M1 brief explicitly prefers the same for xlsx (`.plans/tasks-round2/03-phase2.md:261`).

**Recommendation: hand-roll reading (both csv and xlsx); do not hand-roll or dependency-add an xlsx *writer* — use CSV as RentFlow's own export format instead.**

Reasoning:

- **Reading is proven cheap.** `.plans/tools/xlsx-to-csv.py` (31 lines of Python stdlib `zipfile`+`xml.etree`) already reads both real files correctly. The caveat: Python's `zipfile` module does the ZIP-container parsing for free; **Node has no equivalent stdlib module** — only `node:zlib` for the DEFLATE compression, not the ZIP central-directory format itself. A faithful TypeScript port therefore needs two small pieces, not one: a minimal ZIP central-directory reader (`src/lib/import/xlsx-zip.ts`, ~60–80 lines) feeding `node:zlib`'s `inflateRawSync`, plus the shared-strings/worksheet XML walk that mirrors the Python script almost line-for-line (`src/lib/import/xlsx-parse.ts`, ~60–80 lines). Both stay under the 150-line file limit and add zero dependencies.
- **Writing xlsx correctly is a meaningfully bigger undertaking than reading it** — exactly the asymmetry flagged in the brief (prompt). A valid `.xlsx` write needs `[Content_Types].xml`, relationship parts, a styles part, and a shared-strings table built by hand, or the file simply won't open, or worse, opens with every cell typed as text (which would defeat P2's explicit requirement that money be real numbers Excel can sum, `.plans/tasks-round2/05-phase4.md:74`). There is no recon proof this is cheap, unlike reading.
- **CSV already satisfies the round-trip contract without a writer at all.** A well-formed CSV (plain numeric literals, ISO dates, no thousands separators) opens in Excel with numbers and dates auto-typed correctly — satisfying "money as real numbers, dates as real dates" with zero new code. RentFlow's own export can simply be CSV; the same `src/lib/import/csv.ts` reader (§4.2) parses it straight back on re-import — a fully closed loop, proven by construction.
- Rentman's real files are `.xlsx` regardless (the PO's actual exports), so xlsx **reading** is non-negotiable no matter what RentFlow's own export format is. Only xlsx **writing** is optional, and this doc recommends deferring it.

| Direction | Entity | Format | Implementation |
|---|---|---|---|
| Export | Materials/People/Clients/Locations | CSV | new `src/lib/export/csv-writer.ts` (~20 lines: quote/escape + join) |
| Import | same four, RentFlow's own shape | CSV | `src/lib/import/csv.ts`, extracted from `prisma/seed.ts:31–79` |
| Import | Materials only | xlsx (Rentman's 82-column export) | hand-rolled `xlsx-zip.ts` + `xlsx-parse.ts`, modelled on `.plans/tools/xlsx-to-csv.py` |
| Import | any entity, opportunistically | xlsx (a RentFlow CSV re-saved by a spreadsheet app) | same xlsx reader; format detection (§3) doesn't care which reader produced the rows |
| Export | any entity | xlsx | **not built.** Revisit only as a later UI nicety (a minimal maintained xlsx-writer dependency, added deliberately, not as part of this scope) — never a blocker for P2/M1 |

---

## 9. API routes

### 9.1 Phase 2 (M1 — materials only)

| Method | Path | Module guard | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/materials/import/preview` | `Materialen: wijzigen` | multipart file upload | `ImportPreview` (mode always `"update"` in phase 2 — replace ships in P3) |
| `POST` | `/api/materials/import` | `Materialen: wijzigen` | file + preview confirmation token | `{ totals: ImportPreview["totals"], warnings: string[] }` |

### 9.2 Phase 4 (P3 — generalised; supersedes the routes above, does not duplicate them)

| Method | Path | Module guard | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/import/:entity/preview` | `<entity module>: wijzigen` (update) or `verwijderen` (replace) | `{ file, mode: "update"\|"replace" }` | `ImportPreview` |
| `POST` | `/api/import/:entity/apply` | same as preview | `{ file, mode, confirmToken, typedConfirmation }` | `{ totals, blockers? }` — 409 + `blockers` when replace is refused |

P3.1 either aliases `/api/materials/import/*` to the generalised handler or migrates the M1 UI to call `/api/import/materials/*` in the same commit that generalises the pipeline — no dual-maintained route pair (see §12's sequencing recommendation, which removes this seam entirely by building the generalised shape in M1).

### 9.3 Phase 4 (P2 — export)

| Method | Path | Module guard | Scope | Notes |
|---|---|---|---|---|
| `GET` | `/api/materials/export` | `Materialen: lezen` | N/A (not person-owned) | filtered + archived-excluded by default, mirroring the on-screen filters (`materials-filter-bar.tsx:7–8`); omits `dayPrice`/`costPrice`/`listPrice`/`bundlePriceOverride` without `Kosten/Facturen: lezen` |
| `GET` | `/api/people/export` | `Personen: lezen` | N5 own-data | omits `dayPrice` without `Kosten/Facturen: lezen` |
| `GET` | `/api/clients/export` | `Klanten: lezen` | N5 own-data | no money columns exist on `Client` today |
| `GET` | `/api/locations/export` | `Locaties: lezen` | N5 own-data | no money columns on `Location` |

Money columns are **omitted from the header row entirely**, not blanked — an honest export tells the caller what it contains (mirrors P2.3's own stated verification, `.plans/tasks-round2/05-phase4.md:83`).

---

## 10. UI

Verified existing shadcn primitives (`src/components/ui/`): `alert`, `alert-dialog`, `badge`, `button`, `card`, `dialog`, `input`, `select`, `table`, `tabs` — no `radio-group` exists. For the mode picker, reuse the house segmented-button pattern already used for material type filtering (`src/components/materials-filter-bar.tsx:70–88`) rather than adding a new shadcn primitive.

### Phase 2 (M1.5)

| File | Est. lines | Purpose |
|---|---|---|
| `src/app/(app)/materials/import/page.tsx` | ~60 | upload entry point, kicks off preview |
| `src/components/import/import-upload-form.tsx` | ~70 | file input + format hint |
| `src/components/import/import-preview-table.tsx` | ~130 | per-row table: line/classification/summary/reason; shadcn `Table` + `Badge` for classification colour |
| `src/components/import/import-summary-bar.tsx` | ~50 | totals strip (new/updated/unchanged/skipped/errored) |
| `src/hooks/use-material-import.ts` | ~60 | `useMutation` for preview + apply; query key `["materials-import-preview"]` |

### Phase 4 (P3.4 — generalise; reuses the above unchanged)

| File | Est. lines | Purpose |
|---|---|---|
| `src/app/(app)/settings/import-export/page.tsx` | ~90 | entity picker (`Select`) + mode picker (segmented buttons, per above) |
| `src/components/import/replace-confirm-dialog.tsx` | ~90 | typed-confirmation dialog (`Dialog` + `Input`); shows `ReplaceBlocker[]` instead of a confirm action when present |
| `src/hooks/use-entity-import.ts` | ~70 | generalises `use-material-import.ts` with an `entity` param; query keys `["import-preview", entity]` / `["import-apply", entity]` |
| `src/components/import/export-button.tsx` | ~40 | reusable download button on the four overview screens; calls `/api/:entity/export` with current on-screen filters serialised as query params |

---

## 11. Test plan

1. **Both real files.** Import `Export_Equipment_normal.csv`: assert 103 materials, 11 categories (no more, no fewer — the `"99"`-prefix collision from §2.3 is the specific regression this guards), 1,631 total `StockItem` rows (verified projection: 104 `ID`-groups, minus the 3 empty-recipe bundles, Serialized groups contributing one row per serial and Bulk groups contributing `Current quantity` rows each), and the `9998-902` collision reported as `skipped` with both competing `ID`s named. Import `Export_Equipment_advanced.csv`: assert 287 materials, all `archived = true`, all hidden from the tree/picker/dashboard count (M1.3's full surface, `.plans/tasks-round2/03-phase2.md:270–278`).
2. **Re-import idempotency.** Import the normal file twice; assert the second run's totals show `new: 0`, no duplicate `Category` rows (`Category.count()` stays 11), no duplicate `Material.code` values.
3. **Format detection.** A RentFlow-native CSV export is detected as `"rentflow"`, not `"rentman-equipment"`. A CSV missing the `Code`/`Folder (Folder)` anchor columns is rejected outright, naming the missing headers.
4. **Dirty-data rules (§6).** The 4 zero-priced rows import at `dayPrice = 0` without error. A file with the `Code` column removed entirely aborts at parse time with one error, not 113 per-row errors. One row with an unparseable price still lets every other row classify and apply.
5. **Refused replace.** Seed a `Material` with a `PeriodStockItem` booking; attempt `replace` on materials; assert 409, a `blockers` array naming that exact material and its booking count, and `Material.count()` unchanged before/after.
6. **Permitted replace.** Seed only unbooked materials; run `replace`; assert the DB contains exactly the file's materials (count + code set match) and an `ImportAudit` row was written.
7. **Mid-file rollback.** Craft a file that triggers a DB-level constraint violation the preview didn't catch (e.g. a category-name race); assert the whole transaction rolls back — `Material.count()` identical before and after, no partial category creation.
8. **Permission levels.** A role with `Materialen: wijzigen` but not `verwijderen` gets 403 specifically on `mode: "replace"`, 200 on `mode: "update"`.
9. **Export redaction.** A role without `Kosten/Facturen: lezen` exports materials/people CSVs whose **header row itself** omits the money columns — not blank values under the original headers.
10. **Scope (N5).** An own-scoped caller's export contains only their own rows, coordinated with N5's own enumeration test (`.plans/own-data-scoping-design.md`, forward reference per `.plans/tasks-round2/05-phase4.md:21`).

---

## 12. Implementation order

Mapped onto the existing M1.1–M1.6 (phase 2, `.plans/tasks-round2/03-phase2.md:260–290`) and P2.1–P3.5 (phase 4, `.plans/tasks-round2/05-phase4.md:66–114`), with one sequencing change proposed.

**The risk:** round-trip symmetry means the export column set and the import adapter are one contract — but P2 (export) is scheduled a full phase after M1 (import). Left as originally scoped, the M1 implementer would define material import columns in phase 2 without the export column set existing yet, and P2 could discover a mismatch two phases later.

**Proposed change:** fold this doc's §1/§4 shapes into M1 directly, rather than "M1 ships materials-only, P3 lifts it later":

| Original | Becomes | Why |
|---|---|---|
| M1.1 parse | builds `src/lib/import/pipeline.ts` + `adapters/material.ts` + `xlsx-reader.ts` + `import/csv.ts` (extracted per DDL-2's existing instruction) | entity-agnostic engine from day one, not a materials-only parser |
| M1.2 preview | generic `computeImportPreview(adapter, "update")` | materials is simply the first adapter wired up |
| M1.3 archived concept | unchanged | |
| M1.4 apply | generic `applyImport(adapter, "update")` | |
| M1.5 UI | build the §10 components as generalised from the start | P3.4 reuses them unchanged instead of rebuilding |
| M1.6 tests | unchanged | |
| **new, pulled forward (recommend, needs sign-off — expands the M1 commit list)** | a bare-bones `GET /api/materials/export` (CSV) + `export-button.tsx` | demonstrates the round trip to the PO in phase 2 instead of only on paper until phase 4 |
| P2.1–P2.3 | mostly "add the other three entities' export routes" on the CSV writer that already exists | |
| P3.1 | near-empty: confirm the generic pipeline already covers `replace`; add the mode branch + `referentialChecks` hook | was "lift the pipeline out of M1" — now nothing to lift |
| P3.2–P3.5 | unchanged in substance | new adapters, replace guardrails, mode-picker UI, tests |

**Fallback if this reordering is declined:** M1 ships materials-only as originally scoped, and P3 adopts M1's shape rather than the reverse — exactly what the phase-4 brief already says (`.plans/tasks-round2/05-phase4.md:93`). The `EntityAdapter<T>` interface (§4.1) is written so that fallback costs a rename, not a rewrite, either way.

---

## 13. Out of scope, open risks

### Out of scope

- Projects, bookings, invoices — import in any mode (§1.6).
- Backups (Q44a — infrastructure-level, unrelated to this doc).
- Material attachments/photos (Q34c).
- xlsx **writing** (§8) — CSV-only export unless deliberately added later as a UI nicety.
- Any OAuth/third-party sync (O1/O2 territory — unrelated).
- A cross-entity "system-wide reset" action (explicitly declined, Q49).
- Multi-file or multi-entity batch import in a single request — one file, one entity, one mode per request.
- Undo/rollback UI after a *successful* replace. The guardrails prevent an *accidental* one; a *deliberate* replace is not reversible by the tool itself — the PO's existing infrastructure backup (Q44a) is the recovery path.

### Open risks

1. **`Margin price → costPrice` is structurally reasoned, not empirically confirmed** — 0 of 113 rows in the real sample have a non-zero value. Confirm against a live Rentman account with populated cost data before trusting K4 payback figures derived from it.
2. **`9998-902` resolution: skip + report, not auto-rename.** This diverges from a literal reading of "dedupe deterministically... first wins, rest get the next free code" (`.plans/tasks-round2/03-phase2.md:246`). Both behaviours are defensible; this doc picked the more conservative one (never mint a new business-facing code for real equipment without a human seeing it). The roadmap-literal alternative is a small change if overruled — call `nextCode()` for the loser instead of skipping it.
3. **`Category.prefix` semantics change** (2-digit → 4-digit, §2.3) touches every already-issued material code's generator. Must ship as its own reviewable commit with a migration and a regression test, not folded silently into the import-parsing commit.
4. **People/Clients/Locations lack a natural business key**, so this doc defaults to `id`-as-match-key (§1.1) — a reasonable default, but not a PO decision. If the PO later wants email- or VAT-number-based matching, that is a follow-up decision, not a silent behaviour change.
5. **This doc recommends CSV where the phase-4 brief says `.xlsx`** (`.plans/tasks-round2/05-phase4.md:72–73`) for P2's export helper. Needs explicit sign-off before P2 starts, since it changes P2.1's literal deliverable (§8, §12).
6. **`Invoice.clientId` doesn't exist at design time.** The Client replace-guard's checklist (§7) must be revisited the moment J2b's `Invoice` model lands in phase 3, before P3 ships in phase 4, or a replace could silently orphan invoiced clients.
7. **No existing audit-log infrastructure.** `ImportAudit` (§7) is new — confirm during phase 1 (N1/N2) that no parallel audit mechanism is being introduced there for permission changes, to avoid two audit tables solving overlapping problems.
