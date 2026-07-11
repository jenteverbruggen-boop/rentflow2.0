# Phase 5 — Later / blocked items

B4b, B5, G2 can run in parallel (disjoint files apart from the shared print components, which exist and are stable after B4a). E5 is ⛔ blocked on PO question Q8. F2 (per-user permission overrides) stays parked. Read `00-README.md` first.

---

## B4b — Pakbon: nested bundle lines (M — deps: B4a, E6)

**Read `.plans/e6-bundles-design.md` first** — the booking-side model names come from there (nominally `PeriodBundleBooking` + `PeriodStockItem.bundleBookingId`).
1. New function `groupMaterialAssignmentsNested` in `src/lib/grouping.ts` (do NOT change the existing function's signature — B4a and cost views use it): returns category groups whose lines are either flat materials or `{bundle, components[]}` nodes, keyed off `bundleBookingId`.
2. Pakbon page: bundle renders as parent line (naam, code, aantal, totaal = bundle price) + indented component lines (own code, aantal × bundle-aantal, no price). Flat lines unchanged.

**Accept:** a booked bundle prints as parent + indented components with own codes; flat-only projects print identically to before (visual regression check).

---

## B5 — Call sheets (L — deps: B4a print components, D1, B7; PO: "op termijn")

Reference layout (from the PO's old ERP call sheet — authoritative):
- Company header (same `document-header.tsx` as pakbon, settings-fed).
- Title **"Callsheet — {projectnaam}"**; meta: Projectnummer (= internal id), Betreft, Accountmanager, Opdrachtgever.
- **Per period:** location block (Locatie, Adres, Plaats, Telefoon — from the Location relation), tijdschema line with times (`dd-MM-yyyy HH:mm`), and a **"Medewerkers"** table: Naam, Functie, Van, Tot, Telefoon. Functie = the assignment-level `PeriodPerson.role` string; telefoon from Person.

Build: route `src/app/(app)/projects/[id]/callsheet/page.tsx` reusing `src/components/print/*`; verify the project GET includes periods → people → person (phone) — extend `include` if missing; empty crew → **"Geen medewerkers ingepland"**; project detail button **"Callsheet afdrukken"**.

**Accept:** all periods render with crew, functie and telefoon; header/meta match the reference structure.

---

## G2 — In-app camera scanning (M — deps: E4)

1. **"Scan"** button (materials page header; prominent on mobile). Opens a dialog with a camera preview: use native `BarcodeDetector` (QR + Code128) when available, else dynamic-import `@zxing/browser` fallback.
2. On hit: QR deep-links resolve directly (navigate to the encoded path); raw Code128 → look up via `GET /api/materials?code=…` (add the query-param filter to the materials list route if absent) → navigate to that material.
3. Camera permission denied → **"Geen toegang tot de camera"**; no match → **"Geen materiaal gevonden voor deze code"**. Note: `getUserMedia` requires HTTPS (works on localhost + prod TLS).

**Accept:** scanning a printed E4/E5 label with the in-app scanner lands on the material detail page; graceful Dutch errors.

---

## E5 — Printable material labels (M — ⛔ BLOCKED on Q8)

**Do not start until the PO answers Q8:** labelrol (bv. Brother 62 mm) of A4-stickervellen? The answer only affects the page-layout wrapper — structure the work so that's true:
1. Format-agnostic `src/components/print/material-label.tsx`: naam, code, categorie, Code128 + QR (reuse E4's rendering).
2. Thin wrapper per format — (a) roll: `@page { size: 62mm auto }`, one label per page; (b) A4 sheet: `@page { size: A4 }` + CSS grid (e.g. 3×8) with multi-select of materials to fill a sheet. Implement only the PO-chosen one.
3. Entry: **"Label afdrukken"** action on material detail (multi-select flow on the materials page if A4 is chosen).

**Accept:** print preview shows correctly sized label(s) for the chosen format; codes scannable from a printed sample.

---

## F2 — Per-user permission overrides — **parked** (PO said "eventuele rechten"; revisit after F1 has been in use).
