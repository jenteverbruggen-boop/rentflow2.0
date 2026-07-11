# Phase 0–1 — Unblock + quick wins

All items here are schema-free (except Z1 which fixes tooling) and touch disjoint files → run all phase-1 items as parallel workers. Read `00-README.md` first.

---

## Z1 — Repair dev DB workflow (Phase 0, M, blocks all schema work)

**Problem:** `npm run db:dev:migrate` fails with P3019 — `prisma/migrations/migration_lock.toml` is pinned to `postgresql` and `0001_init` is Postgres SQL, but the dev schema is SQLite.

**Do:**
1. Rewrite `package.json` scripts — SQLite dev stops using migrations entirely:
   - `db:dev:migrate` → `prisma db push --schema prisma/schema.dev.prisma`
   - `db:dev:reset` → `prisma db push --force-reset --schema prisma/schema.dev.prisma && npm run db:dev:seed` (add a `db:dev:seed` script running `prisma/seed.ts` via tsx if not present — check how seeding runs today)
   - `db:dev:generate` / `db:dev:studio` unchanged (verify they pass `--schema prisma/schema.dev.prisma`).
2. Postgres migrations are authored WITHOUT a local shadow DB via `prisma migrate diff`:
   ```
   npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --script > prisma/migrations/<timestamp>_<name>/migration.sql
   ```
   If no shadow Postgres is available, use `--from-migrations` with the docker-compose `db` service running. Document the working recipe (verify it actually runs) in CLAUDE.md under a new "## Authoring Postgres migrations" section.
3. Validate: fresh checkout → `npm run db:dev:reset` → `npm run dev` works; author one no-op Postgres migration with the recipe and confirm `prisma migrate deploy` accepts it against the compose `db`.

**Accept:** dev reset+seed from clean checkout works; recipe in CLAUDE.md is copy-paste runnable. **Out of scope:** any schema change.

---

## Z2 — Vitest test infrastructure (Phase 1, S)

1. `npm i -D vitest` + `vitest.config.ts` with the `@/` path alias matching tsconfig.
2. `"test": "vitest run"` script.
3. First real tests: `src/lib/pricing.test.ts` — read `src/lib/pricing.ts`, cover: day count = `differenceInCalendarDays + 1`, quantity × snapshot dayPrice math, empty period totals 0.
4. Add a `npm test` step to the existing GitHub workflow (find it in `.github/workflows/`).

**Accept:** `npm test` green locally and in CI.

---

## A1 — Clickable dashboard stat cards (Phase 1, S)

Dashboard: `src/app/(app)/page.tsx` (+ any stat-card component it uses). Wrap each stat card (Projecten/Personen/Materialen) in a Next `<Link>` to `/projects`, `/people`, `/materials`.
- Hover: `hover:bg-accent/50 transition-colors cursor-pointer` on the Card; visible focus ring (Link default) for keyboard.
**Accept:** click and Enter-key navigate; no layout shift.

---

## B3 — Project status quick-edit (Phase 1, S)

Project detail header shows a status badge (find it under `src/app/(app)/projects/[id]/`; variants via `statusVariant()` in `src/lib/utils.ts` — read it to enumerate allowed statuses).
1. Replace the static badge with a shadcn `DropdownMenu` triggered by the badge (badge + chevron).
2. On select: TanStack `useMutation` → existing `PUT /api/projects/[id]` sending the full expected payload or just `{status}` — **read the PUT handler first**; if it requires other fields, send the current project values spread with the new status.
3. Optimistic update; invalidate `["projects"]` and the project-detail key on settle. Extract as `src/components/status-select.tsx` if the page nears 150 lines.

**Accept:** status changes in 2 clicks without the edit dialog; reverts on API error.

---

## C1 — Clickable planning calendar items (Phase 1, S)

`src/app/(app)/planning/page.tsx` (+ its components). Calendar period blocks get a shadcn `Popover`:
- Content: project name (bold), client, location, status badge, period van–tot, 👥 people count, 📦 material count, link **"Naar project →"** to `/projects/[id]`.
- Week-summary rows also link to the project.
- Data needed is already in the planning query response — verify; if counts are missing, derive from the period's included relations rather than new API work.

**Accept:** click opens popover; link navigates; Escape closes.

---

## E2 — Inline quick-edit in material detail pane (Phase 1, M)

Material detail pane (find the component — materials page uses a tree + detail pane under `src/components/`). Make dagprijs, category and notes click-to-edit:
1. Small `InlineEditField` component (`src/components/inline-edit-field.tsx`): renders value; click → input (text/number) + ✓/✕; Enter saves, Escape cancels.
2. Save → `PUT /api/materials/[id]` (read handler for payload shape), optimistic, invalidate `["materials"]`.
3. Category stays a **plain text input here** — the Category entity (E1) replaces it in phase 2; keep the field isolated so E1 can swap it.

**Accept:** dagprijs changed in ≤2 clicks; failed save reverts + toast/inline error (Dutch: "Opslaan mislukt").

---

## G1 — PWA installability (Phase 1, S)

1. Next 16 file convention: create `src/app/manifest.ts` exporting a `MetadataRoute.Manifest` (name "RentFlow", short_name, `start_url: "/"`, `display: "standalone"`, theme/background colors from globals.css palette, icons 192+512). Served at `/manifest.webmanifest`. Check `node_modules/next/dist/docs/**/manifest.md` for the exact API.
2. Icons: generate `public/icon-192.png` + `public/icon-512.png` (one-off script or any simple "RF" tile — no new runtime deps).
3. **Critical:** `src/proxy.ts:29` matcher only excludes `_next/static|_next/image|favicon.ico` — add `manifest.webmanifest` and the icon paths or install fails behind the login redirect.

**Accept:** unauthenticated `curl -i localhost:3000/manifest.webmanifest` → 200 valid JSON with name/icons/start_url/display; both icon URLs → 200. **Out of scope:** service worker, offline, push.
