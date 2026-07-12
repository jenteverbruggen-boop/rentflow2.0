RentFlow Update — 12 juli 2026

54 commits sinds vorige release. Hier's wat er gebouwd is:

MATERIALEN & STOCKING
• Automatische codes (SOUND01-001 format) — inline bewerkbaar
• Barcodes (Code128) + QR-codes op materialen
• In-app camerascanner — scan met je telefoon
• Label-sheets genereren (A4, 24 labels per pagina)
• Bundles/Sets — materiaalpakketten met auto voorraadbeheer + component-sharing

KOSTENMANAGEMENT
• Setup/teardown kosten per materiaal (eenmalig per periode)
• Reiskosten per persoon (ritten, overnachtingen, etc.)
• Kostenoverzicht per periode + project + categorie

PLANNING & UITVOER
• Perioden met precieze start/eindtijden (geen overlap-conflicten)
• Klikbare kalender + week-overzichten
• Pakbon (A4 met bedrijfskop, categorie-groepering, handtekeningenblokken)
• Roeplijst (Call Sheet voor alle personen in een periode)

PERSONEELSBEHEER
• Adresvelden + multiselecteerbare functies
• Documenten uploaden (attesten, verloven) met vervaldatum-badges
• Documenten download/verwijdering

GEBRUIKERS & VEILIGHEID
• RBAC: Admin / Planner / Viewer rollen
• Registratie disabled (admin-only invites)
• Bedrijfslogo in instellingen

MOBILE
• PWA installeerbaar (home screen + app-like ervaring)

UI/UX
• Inline quick-edits (code, prijs, categorie, notities)
• Verbeterde DateInput component
• Gepoetste formulieren overal

TECHNIEK
• Vitest setup + 36 pricing tests
• Dev DB workflow fixed (SQLite + Postgres migraties gedocumenteerd)

---

Alles wat op het roadmap staat is nu gebouwd. Enige open item: Q8 (label-printer integratie — feedback van jou nodig).
