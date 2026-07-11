# Phase 4 — Documents, uploads, bundles implementation

Order: **p4-ddl first**, then B4a / D3 / E4 in parallel. E6-impl starts once its design doc is approved — its worker owns its own schema commit AND `src/lib/availability.ts` + booking routes for the whole phase (nobody else touches those). B4a does **not** wait for E6. Read `00-README.md` first.

---

## p4-ddl — DDL commit 3: PersonDocument (S, lands first)

Both schemas + Postgres migration (Z1 recipe). Seed untouched (no demo blobs).
```prisma
model PersonDocument {
  id        Int      @id @default(autoincrement())
  personId  Int
  person    Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  filename  String
  label     String?
  mimeType  String
  sizeBytes Int
  data      Bytes
  createdAt DateTime @default(now())
  expiresAt DateTime?
}
```
E6's models are NOT in this commit — the E6 worker lands its own DDL (see below). **Accept:** migration applies; tsc passes.

---

## D3 — Attest (certificate) PDF uploads (M)

Decision: bytes stored **in the database** (quick and working); all access behind an abstraction so a later disk/S3 swap touches one file.
1. `src/lib/documents.ts` — the ONLY module importing prisma for `PersonDocument`: `storeDocument({personId, filename, label?, mimeType, sizeBytes, expiresAt?}, buffer) → id`, `getDocument(id) → {meta, data}`, `listDocuments(personId) → meta[]` (**select metadata only — never `data` in lists**, this is the #1 perf gotcha), `deleteDocument(id)`.
2. API: `POST /api/people/[id]/documents` — multipart via `await req.formData()`; enforce `application/pdf` (→ **"Alleen PDF-bestanden zijn toegestaan"**) and ≤10 MB (→ **"Bestand is te groot (max. 10 MB)"**) in the handler (Next 16 route handlers have no default body cap). `GET /api/documents/[id]` — auth-checked, returns bytes with `Content-Type` + `Content-Disposition: inline; filename="…"`. `DELETE /api/documents/[id]`. All `requireAuth()` + helpers.
3. UI: **"Documenten"** section on the person detail page (extract `src/components/person-documents.tsx`): upload (**"Attest uploaden"**, optional label + vervaldatum), list (filename, label, size, datum), download, delete-with-confirm. Expiry badges: verlopen → destructive **"Verlopen"**; <30 dagen → **"Verloopt binnenkort"**.

**Accept:** upload→list→download byte-identical; non-PDF and >10 MB rejected with Dutch errors; person list/detail responses contain no blob data; survives container restart.

---

## B4a — Pakbon, flat version (L — PO's #1 ask; no E6 dependency)

Reference layout (from the PO's old ERP pakbon — authoritative):
- **Company header:** logo + naam, adres, telefoon, BTW, IBAN — from Settings (F4: `GET /api/settings` + `/api/settings/logo`).
- **Meta block:** Opdrachtgever (client), Locatie (name + full address), Projectnummer (= internal autoincrement `id`, decided), Accountmanager, Aangemaakt op.
- **Tijdschema:** table, one row per period (naam, van, tot — `dd-MM-yyyy HH:mm`, times exist since B7).
- **Materialen:** grouped by category heading; per line: aantal, two empty check-off boxes `[ ] [ ]` (bordered spans — out/in), naam, code (no code → **"TEMP"**), totaal. Use `groupMaterialAssignments` (`src/lib/grouping.ts`) — flat lines only; bundles nest later (B4b).
- **Footer:** signature blocks **"Handtekening uitvoerder"** / **"Handtekening klant"** + datum lines.

Build:
1. Reusable print plumbing (B5 reuses it): `src/components/print/print-layout.tsx` (A4 `@media print` CSS, hides app chrome, no-print toolbar with **"Afdrukken"** → `window.print()` and **"Terug"**) + `src/components/print/document-header.tsx` (company block + meta grid, settings-fed). ≤150 lines each.
2. Route `src/app/(app)/projects/[id]/pakbon/page.tsx` (`"use client"`, TanStack query). Verify the project GET includes client + location relations, periods with material bookings incl. material.code + category — extend the route's `include` if missing.
3. Project detail: button **"Pakbon afdrukken"** linking to the route.

**Accept:** a project with 2 periods and 3 categories prints on A4 matching the reference structure; TEMP fallback shown; header renders settings + logo. **Out of scope:** bundle nesting (B4b), PDF generation libs.

---

## E4 — Barcode / QR on material detail (M)

Decisions: QR = **deep-link URL** to the material page; Code128 = raw code.
1. Deps: `qrcode` + `jsbarcode` (client-side SVG). Component `src/components/material-codes.tsx` on the detail pane.
2. Deep link: check how a material is addressed today (tree-pane selection is client state) — support `/materials?materialId={id}` auto-select if not already; QR encodes `{origin}` + that path. Barcode renders the raw code with human-readable text below.
3. No code yet → hint **"Geen code — genereer eerst een artikelcode"** instead of empty codes.

**Accept:** phone-camera-scanning the QR opens that material (login redirect acceptable); barcode shows the raw code.

---

## E6-impl — Bundles / sets (XL — only after `.plans/e6-bundles-design.md` is approved)

**The approved design doc is the spec.** This brief adds guardrails and gates. Expect multiple worker sessions — commit at each checkpoint, each independently green:
1. **Regression tests first:** vitest covering current flat booking/unbooking + availability behavior BEFORE touching anything (they must stay green through every later step).
2. **DDL:** the design's models (recipe + booking-side model + `PeriodStockItem.bundleBookingId`), both schemas, migration via Z1 recipe, seed with ≥1 demo bundle. This worker owns schema this step.
3. **Core:** refactor the booking route to an interactive `prisma.$transaction` with the availability re-check **inside** (kills the existing TOCTOU race at `src/app/api/periods/[id]/materials/route.ts:27-62`); bundle availability = min over components; unbook removes the whole instance atomically. Extra availability tests: exhausted component, back-to-back at strict boundary (no conflict, per B7), concurrent-booking simulation. Note SQLite/Postgres isolation differences in the tests.
4. **UI:** bundle definition in materials UI (component editor: materiaal + aantal, per the design); booking flow offers bundles like normal materials.
5. **Pricing:** bundle price = sum of component prices, nullable manual override (null = live sum); components render €0 within a set on cost views. Costs tab (B6 helpers) handles bundles.

**Accept (v1):** define bundle in UI; booking reserves all component stock atomically with in-transaction re-check; unbook removes the instance; flat bookings behave byte-for-byte identically (regression suite proves it); pricing per decision. **Out of scope:** nested pakbon rendering (B4b), nested bundles (bundle-in-bundle).
