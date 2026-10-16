# UI responsive audit (2026-10-16)

Method: local dev server (seeded SQLite, 21 projects / 108 materials), Playwright/Chromium, 21 routes × 7 viewports
(360×740, 390×844, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080). Measured every scrollable element
(`overflow` auto/scroll with `scrollWidth/Height > client`) and every element past the right edge of `<main>`.
Screenshots at 390 / 768 / 1280 were reviewed by eye. Not a prod copy: no DB access to prod, so seed data was used.

## How the shell scrolls
`(app)/layout.tsx` is `h-screen` with `<main overflow-y-auto>`, so **`main` is the page scrollbar** — vertical scroll in
`main` is by design and was ignored below. The document itself never overflows. What matters is `main` scrolling
**sideways** (whole page slides left/right) and **second, nested** scrollbars.

## A. Page slides sideways (main scrolls horizontally) — worst class
Root cause is the same everywhere: a header action row `div.flex.gap-2` that doesn't wrap, and cards with `flex items-start` that don't shrink.

| Page | Widths | Overflow | Culprit |
|---|---|---|---|
| /materials | 360–768 | 762px in 360 view | header button row (Scan, Labels, Importeren, Exporteren, + Nieuw) 627px wide, no wrap |
| /materials/labels | 360–1024 | 810px | label sheet (794px, fixed print width) inside `main`; header row too |
| /people | 360–390 | 508px | header row (Functies, Exporteren, + Nieuwe persoon) |
| /clients | 360–390 | 529px | header row **and** client card row (`p-6 py-4 flex items-start`, 513px) |
| /locations | 360–390 | 401px | header row + location card row |
| /facturen | 360–390 | 443px | filter select + Exporteren row |
| /projects | 360–390 | 396px | header row (Exporteren + Nieuw project) |
| /projects/[id]/kosten | 360 | 383px | cost table (335px) not wrapped in `overflow-x-auto` |
| /agenda-feeds, /settings | 360 | 414px | "Intrekken" button pushed past edge |

Fix pattern: shared page-header component (`flex flex-wrap gap-2`, title `min-w-0`), `min-w-0` + `flex-1` on card text blocks, and wrap bare tables in the existing scroll wrapper.

## B. Layout breakpoint too low (768–1023)
Sidebar is permanently visible from `md` (768px), leaving only **544px** for content on iPad portrait. That is what
causes most 768 problems below. Moving the sidebar/hamburger switch from `md` to `lg` (1024) fixes the whole band at once
(`src/components/sidebar.tsx`, `mobile-sidebar.tsx`, `layout.tsx` `md:p-6`).

## C. Content squashed / clipped (not scrollbars, but looks broken)
- **/planning week view @ ≤768**: 7 day columns shrink to ~64px; project chips show "S…" / "0…". `planning-week-grid.tsx` (`grid-cols-7`) needs a min column width + horizontal scroll, or a stacked list under `lg`. Month grid (`planning-month-grid.tsx`) likely the same — check.
- **/projects/[id] @ 768**: stat cards truncate "Persoonboekingen"/"Materiaalboekingen" (label wider than card).
- **/projects/[id] tab bar @ 360–768**: `overflow-x-auto` strip scrolls (328/502) — acceptable, but there is no fade/hint that more tabs exist.
- **/materials @ 390**: page title and Scan/Labels buttons share one row; "Importeren" is cut off (see A).

## D. Nested vertical scrollbars (second scrollbar inside the page scroll)
| Where | Source | Notes |
|---|---|---|
| /materials list, all widths | `components/materials-tree-pane.tsx:85` `max-h-[60vh] overflow-y-auto` | list scrolls inside a page that also scrolls; 6704px of content in a 444–648px window. On phones the 60vh box + main = scroll-trap. Prefer full-height sticky pane on `lg+`, and no cap (plain flow) below `lg`. |
| /materials/labels | `div.grid.grid-cols-2 sm:grid-cols-3` preview, 368–538px window over 632–1528px | second scrollbar inside the sheet preview |

## E. Intentional / acceptable inner horizontal scroll (tables)
Wrapped correctly in `overflow-auto`: /facturen (470px table), /facturen/[id] lines (560), /cijfers (4 tables, up to 629),
/users (802), /settings (647 and permission matrix 545). These are fine on desktop; on phones consider card/stacked rows
for /users and /facturen, where the first column (name/number) scrolls out of view — a sticky first column is the cheap fix.

## F. Clean at every width
Dashboard, /notes, /import, /projects/[id]/pakbon, /callsheet, /facturen/[id]/print, login: no horizontal overflow, no nested scrollers.
At ≥1280 only the main scroll bar remains everywhere except /materials and /materials/labels (section D).

## Dev-only noise (ignore)
Next.js dev "N" badge overlaps the bottom of the sidebar ("Uitloggen" partly hidden) in dev; not present in prod build.

## Suggested order
1. B (breakpoint `md`→`lg`) — one change, fixes the 768 band.
2. Shared `PageHeader` with wrapping actions — fixes all of A in one component.
3. Planning week/month grid min-widths (C).
4. Drop `max-h-[60vh]` nesting (D).
5. Table first-column stickiness / stat-card text wrap (E, C).
Re-run `scratchpad/audit.mjs` (Playwright script; copy into repo `scripts/` if we want it as a regression check) after each step.

---
## Outcome (same day)
All of A, B, most of C and D fixed; see `ui-responsive-audit.pdf` for before/after numbers and the fix table.
Result: 0 pages slide sideways at any width (was 10 @360–390, 3 @768); `tsc`, eslint, vitest (972) green.
Left deliberately: table inner h-scroll (E), label-picker list, materials list bounded at lg+ (sticky master-detail), project tab strip.
Not done: sticky first column on tables, fade hint on tab strip.
Skill updated: `.claude/skills/design/SKILL.md` (§9 corrected, §10 scrollbars, §11 audit) + `scripts/responsive-audit.mjs`.
