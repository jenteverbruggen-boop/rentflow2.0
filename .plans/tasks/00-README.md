# RentFlow — PO Roadmap Task Briefs (execution master)

> Source plan: `.plans/2026-07-po-feedback-roadmap.md` (v5, decisions table at top).
> Every brief in this folder is **self-contained**: an AI worker (Sonnet / Opus) gets ONE brief + this README and implements it without any other context.

## How to run a brief (worker instructions)

1. Read this README fully, then your assigned item's section in the phase file (`0N-phaseN.md`).
2. Read every file the brief references before editing anything.
3. Follow the brief's implementation order. Do not build anything in its "Out of scope" section.
4. Before finishing: `npx tsc --noEmit` must pass with zero errors; `npm run lint` clean; if the brief has tests, `npm test` green.
5. Use the project skills: `code` (always), `design` (any UI), `cicd` (Docker/workflows), `docs` (after schema/API changes).

## Non-negotiable conventions (apply to every brief)

- **150-line file limit** — extract components/hooks/lib helpers when approaching it.
- All domain types in `src/types/index.ts`; never define entity interfaces inline.
- Every API route: `requireAuth()` first + response helpers from `src/lib/api-auth.ts` (never inline `NextResponse.json({error}, {status})`).
- Pages in `(app)/` are `"use client"` with TanStack Query; layouts stay Server Components. No `useEffect`+`useState` fetching.
- Forms: React Hook Form + Zod, components in `src/components/`.
- Never edit `src/components/ui/` (shadcn).
- **Two Prisma schemas**: every schema change lands in BOTH `prisma/schema.prisma` (PostgreSQL) and `prisma/schema.dev.prisma` (SQLite). Money: `Decimal @db.Decimal(10,2)` (PG) ↔ `Float` (SQLite). **No Prisma enums** — `String` column + TS union + Zod validation.
- Dev DB is **seed-driven**: every entity/backfill change must also update `prisma/seed.ts`.
- UI copy is Dutch (nl-BE); code/identifiers English.
- Next.js 16: route params are `Promise` (`const { id } = await params`); middleware file is `src/proxy.ts` (function `proxy`); `jsonwebtoken` is Node-only — never import it in `proxy.ts` (use `jose`).
- Anything touching `src/lib/availability.ts` is **critical booking logic** — tests required, extra care.

## Execution order & parallel lanes

Rule: within a phase, **exactly one worker touches `prisma/schema*.prisma` + migrations + `seed.ts` schema-shape changes** — that "DDL commit" lands and merges FIRST; feature workers branch from it. Never two concurrent schema editors.

| Phase | Serial first | Then in parallel (one worker each) | Notes |
|---|---|---|---|
| **0 — unblock** | `p0-z1` dev-DB repair | — | Blocks all schema work |
| **1 — quick wins** | — | `p1-a1` stat cards · `p1-b3` status quick-edit · `p1-c1` calendar popover · `p1-e2` inline material edit · `p1-z2` vitest · `p1-g1` PWA manifest | All schema-free, zero shared files |
| **2 — entity foundations** | `p2-ddl` (Client, Location, Function+PersonFunction, Person address, Category, Setting models + B7 data-normalization migration + seed) | `p2-b1` clients · `p2-b2` locations · `p2-b7` period times · `p2-d1` functions M2M · `p2-d2` person address UI · `p2-e1` categories · `p2-f4` settings+logo | 7 parallel feature workers after DDL lands |
| **3 — codes, RBAC, links** | `p3-ddl` (Material.code + dedupe migration, User.personId, User.role default flip) | `p3-e3` auto codes · `p3-f1` RBAC · `p3-f3` person↔user link · `p3-b6` cost split · `p3-e6-design` bundle design doc | B6 waits for B7 (both touch `pricing.ts`). E6 design doc needs human approval before E6 implementation |
| **4 — documents & uploads** | `p4-ddl` (PersonDocument model) + **E6 implementation starts** (`p4-e6`, after design approval — sole `availability.ts` owner this phase) | `p4-b4a` flat pakbon · `p4-d3` attest uploads · `p4-e4` barcode/QR | B4a does NOT wait for E6 |
| **5 — later / blocked** | — | `p5-b4b` nested pakbon (needs E6) · `p5-b5` call sheets · `p5-g2` in-app scanner · `p5-e5` labels ⛔Q8 · F2 parked | "Op termijn" items |

Cross-phase file-conflict map (why some items are serialized):
- `src/lib/pricing.ts`: B7 (phase 2) → B6 (phase 3).
- `src/lib/availability.ts`: B7 (phase 2) → E6 (phase 4). Never in the same phase.
- `src/components/sidebar.tsx`: B1 + B2 both add nav items — B1's worker adds **both** entries; B2 doesn't touch the sidebar (see briefs).
- `src/proxy.ts` matcher: G1 (phase 1) and F4 logo route (phase 2) — G1 lands first; F4 extends.
- Print/document plumbing (settings header, projectnummer=id): built once in B4a, reused by B5.

## Brief files (one per phase; each contains the per-item specs)

| File | Items | Blocked by |
|---|---|---|
| `01-phase0-1.md` | Z1 · Z2, A1, B3, C1, E2, G1 | — (Z1 first) |
| `02-phase2.md` | p2-ddl · B1, B2, B7, D1, D2, E1, F4 | Z1 (DDL first) |
| `03-phase3.md` | p3-ddl · E3, F1, F3, B6, E6-design | phase 2 (DDL first; B6 after B7) |
| `04-phase4.md` | p4-ddl · B4a, D3, E4, E6-impl | phase 3 (E6-impl after design approval) |
| `05-phase5.md` | B4b, B5, G2, E5 ⛔Q8 · F2 parked | phase 4 |

Assign a worker one item = one section of the phase file (plus this README). Q8 (label printer/format) is the only open PO question — it blocks E5 only.
