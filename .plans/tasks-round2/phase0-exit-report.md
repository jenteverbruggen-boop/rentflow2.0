# Phase 0 exit report

All 8 items implemented, 26 commits, on `main` (fast-forward merged branch by branch, no squashing). `npx tsc --noEmit`, `npm run lint`, `npm test` (81 tests, SQLite) are green after every commit.

## 1. Branch and commit list per item

| Item | Branch (merged, deleted) | Commits |
|---|---|---|
| Y1 — Decimal→number boundary | `y1-decimal-boundary` | 6: `388709e` serializer, `e782931` pricing coercion + money-format split, `b0b801c` route boundary, `c3ecfb0` UI dedup, `5bfdc48` CI/eslint guard, `95e6d35` docs |
| Y3 — file splits | `y3-file-splits` | 6: `e55ff19` costs tab, `9f60370` planning page, `e700d7f` person split editor, `310ef8e` project detail, `71a0781` material detail, `28bda74` material split editor |
| Y4 — doc drift | `y4-doc-drift` | 2: `a54180a` delete phantom compose guide, `2749501` registry/base-image corrections |
| Y5 — env validation | `y5-env-validation` | 1: `c29b1e4` |
| H3 — availability picker | `h3-availability-window` | 3: `397c7c9` full timestamps, `36a9d7d` route validation, `36329c0` same-day test coverage |
| H4 — period defaults | `h4-period-defaults` | 3: `9550b4f` form default, `724cccf` auto-created period + Brussels-time helper, `ecf6c95` server-side range validation |
| J1 — travel cost line | `j1-travel-line` | 4: `70d46ae` subtotal split, `06fae9c` itemised rows, `182a97e` total alignment, `fc6e660` design-doc correction |
| P1 — container hardening | `p1-hardening` | 2: `ed7c209` non-root user, `9a53ff9` healthchecks |

## 2. Postgres verification (Y1.3) — could not be run

Docker is not available in this execution environment (`docker info` fails; `docker ps` cannot reach a daemon even though the CLI is present). The `curl -s localhost:3000/api/projects | jq '...'` check against real Postgres described in Y1.3's brief was **not run**.

What *was* verified instead, as the closest available substitute:
- `pricing.test.ts`'s string-input describe block (Y1.2) exercises the exact Decimal-as-string shape production returns, asserting every affected pricing function gives identical results for string and number inputs.
- `npx tsc --noEmit` passes with the **Postgres** Prisma client generated (`npx prisma generate` against `prisma/schema.prisma`), confirming no Decimal/number type mismatch across the whole codebase — this is the CI gate Y1.5 made explicit.
- `npm run build` with CI's placeholder Postgres `DATABASE_URL` succeeds end-to-end (full production build, not just type-check).

**This is the single highest-priority manual check before phase 1 starts.** Run `docker compose up -d db && npx prisma migrate deploy && npx tsx prisma/seed.ts`, start the app against that Postgres instance, and confirm `GET /api/projects` returns unquoted JSON numbers for `dayPriceSnapshot`/`setupCostSnapshot`.

## 3. Recurrence guard chosen (Y1.5)

An eslint `no-restricted-syntax` rule (in `eslint.config.mjs`) bans a direct `+` on a `MemberExpression` whose property name ends in `Price`/`Snapshot`/`Cost`, across the whole `src/` tree except `serialize.ts` itself. A branded `Money` type was considered and rejected as too invasive for this phase (it would touch all ~17 existing call sites). The rule only fires on a member expression used directly as an operand of `+` — code that first runs a value through `toNumber()`/`toNumberOrNull()` is unaffected, since the coerced value becomes a plain identifier, not a member expression. Verified: the whole repo lints clean, and a deliberately-planted bad pattern (`x + line.dayPriceSnapshot`) correctly fails.

## 4. Confirm: displayed figures will change for the PO

- **Y1 (money bug fix):** In production only (Postgres/Decimal), any material line with a non-zero `setupCostSnapshot` was rendering as a string-concatenated number (e.g. a €150 rental + €0 setup could inflate to €1500 wherever a *non-zero* setup cost was involved — concretely, the bug fires whenever `rental + setup` string-concatenates, which requires Postgres in production; dev/SQLite never showed it). After this phase, those figures will drop to their correct values. **The PO should expect the Kosten tab and period bookings panel to show smaller numbers than before on any project with material setup costs**, and this is the fix working correctly, not a new bug.
- **J1 (subtotal split):** The project/period cost summary now shows a distinct **"Subtotaal"** row (personen + materialen only, excluding travel) in addition to the existing **"Totaal excl. BTW"** row (which still includes travel, per Q22 — unchanged final total). Individual travel costs also now appear as itemised rows in the cost table (`{qty} × {unit price}` per entry, with the person's name), not only as a single rolled-up "Reiskosten: €X" figure. **The grand total (incl. BTW) is unchanged** — only the breakdown becomes more detailed.

## 5. For the PO to retest before phase 2

1. **H3 + H4 (availability picker):** Book yourself 08:00–17:00 on one project (a single-day period). Open the split editor for a period on a *different* project, same calendar day, 18:00–23:00 — you should show **"Beschikbaar"**. Try 14:00–20:00 the same day instead — you should show **"Bezet"**. This is the exact "it says free but won't let me book" scenario from item 1.
2. **H4:** Create a new project — confirm the auto-created "Hoofdperiode" is a single day (08:00–17:00), not the full project span. Add a period on an existing project — confirm the same single-day default.
3. **J1:** Open a project's Kosten tab for a period with a person travel cost > 0 — confirm travel shows as its own line(s) below the person/material rows, and that "Subtotaal" (excl. travel) and "Totaal excl. BTW" (incl. travel) are both visible and make sense together.

## Known open items not blocking merge, but not yet verified live

- **Y1.3, P1.1, P1.2:** Docker/Postgres-dependent verification, listed above — no Docker daemon reachable in this environment.
- **Manual UI click-through** for the Y3 file splits (project detail tabs, planning page, person/material split editors, material detail pane) was not performed with a running browser in this environment — verified instead by diffing that each extraction is a byte-for-byte move of the original JSX with no logic changes, plus the full automated test suite staying green throughout.
- **`.claude/skills/cicd`'s own reference doc** still says `node:20-alpine`/"node 20" where the real Dockerfile and CI now use `node:22-alpine`/Node 24 — noticed during Y4.2 but out of that item's stated scope (README, `docker.prompt.md`, `docs/docker-compose.md` only). Worth a follow-up doc fix, not blocking.
- **Optional, deferred:** H3.3's brief mentioned optionally showing the conflicting *window* (not just the project name) in the "Bezet" label — not implemented, tracked as a nice-to-have.
