# RentFlow — Round 2 Task Briefs (execution master)

> Source plan: `.plans/2026-08-po-feedback-round2.md` (v4, decisions table at the top — every decision there is FINAL).
> Every brief in this folder is **self-contained**: an AI worker gets ONE item's section + this README and implements it without further context.
> **Ignore the Execution-order and Brief-files tables in `.plans/tasks/00-README.md`** — those describe round 1. Conventions from that file still apply.

## Commit discipline — read this first

The PO reviews **commit by commit**. Every commit must therefore be a single, self-contained, reviewable change.

**Hard rules:**

1. **One logical change per commit.** Never mix a refactor with a behaviour change. Never mix a schema change with the UI that consumes it.
2. **Every commit must be green**: `npx tsc --noEmit` clean, `npm run lint` clean, `npm test` passing. Never commit a red state "to be fixed in the next commit" — the PO must be able to check out any commit and have a working app.
3. **Never commit to `main`.** Branch per item: `git checkout -b <item-id>-<slug>` (e.g. `y1-decimal-boundary`). The repo is currently on `main` — check before starting.
4. **Conventional Commits are mandatory.** `.github/workflows/release.yml` runs `semantic-release` with **no config file**, so it uses the default preset and **your commit type decides the version bump** on merge to `main`:

   | Type | Release effect | Use for |
   |---|---|---|
   | `feat:` | **minor** bump | new user-visible capability |
   | `fix:` | **patch** bump | bug fix (including the Decimal money bug) |
   | `perf:` | patch bump | performance only |
   | `refactor:` `chore:` `docs:` `test:` `style:` `ci:` | **no release** | everything else |
   | any type + `BREAKING CHANGE:` footer | **major** bump | reserve for deliberate breaks — get approval first |

   Format: `type(scope): subject` — scope is the area, e.g. `fix(pricing):`, `feat(invoices):`, `refactor(planning):`. Subject in the imperative, lower case, no trailing full stop.

5. **Commit body**: for anything non-obvious, add a short body explaining *why*. For a commit that changes displayed numbers or removes an ability, say so explicitly — the PO reads these.
6. **Do not squash** the commits in an item. The sequence is the review unit.
7. **Never reformat unrelated code.** A drive-by prettier run buries the real change.

## Per-commit review checklist (the worker asserts these before committing)

- [ ] `npx tsc --noEmit` zero errors
- [ ] `npm run lint` clean
- [ ] `npm test` green (and any new tests actually assert the intended behaviour, not just that code runs)
  - ⚠️ `npm test -- <keyword>` is `vitest run <filter>`, which **exits 1 with "No test files found"** when nothing matches. Only use a filter when that commit actually creates a matching `*.test.ts`; otherwise run bare `npm test`.
- [ ] Every touched file ≤ **150 lines** (extract rather than exceed)
- [ ] No raw `Decimal` returned from an API route; no `+` on an unconverted wire value (see Y1)
- [ ] Schema change? Landed in **both** `prisma/schema.prisma` (Decimal money) **and** `prisma/schema.dev.prisma` (Float money) **and** `prisma/seed.ts`
- [ ] New route? Has `requireAuth()`/`requireModule()` first and uses the response helpers from `src/lib/api-auth.ts` — never an inline `NextResponse.json({error}, {status})`
- [ ] UI change? `design` skill applied; readable in light **and** dark; Dutch copy (nl-BE)
- [ ] Commit type matches the release effect you intend

## Canonical permission vocabulary (phase 1 onward)

`src/lib/modules.ts` (N1.1) is the single source of truth. **Module keys are lowercase snake_case; access levels are Dutch.** Any brief or design doc using `"Cijfers"`, `"Kosten/Facturen"`, `"read"`, `"write"` or `"delete"` in a `requireModule(...)` call is wrong and will not type-check:

| Module keys | `projecten` · `planning` · `personen` · `materialen` · `klanten` · `locaties` · `kosten_facturen` · `cijfers` · `gebruikers` · `instellingen` |
|---|---|
| Access levels | `geen` · `lezen` · `wijzigen` · `verwijderen` |
| Verb mapping | `GET` → `lezen` · `POST`/`PUT`/`PATCH` → `wijzigen` · `DELETE` → `verwijderen` |
| ICS exemption prefix | exactly `/api/calendar/` — no glob, no missing trailing slash |

## Non-negotiable project conventions

- **150-line file limit**; extract components/hooks/lib helpers.
- All domain types in `src/types/index.ts`; never inline entity interfaces.
- Pages in `(app)/` are `"use client"` with TanStack Query; layouts stay Server Components. No `useEffect`+`useState` fetching.
- Forms: React Hook Form + Zod. Never edit `src/components/ui/` (shadcn).
- **No Prisma enums** — `String` column + TS union + zod.
- Dev DB is seed-driven: entity changes must update `prisma/seed.ts`.
- Next.js 16: route params are `Promise` (`const { id } = await params`); middleware is `src/proxy.ts` exporting `proxy`; `jsonwebtoken` is Node-only — never import it in `proxy.ts` (use `jose`).
- **Money rule:** convert Decimal→number at the route boundary. Never `a + b` on a wire value. Never reimplement a `pricing.ts` helper inline in a component.
- **Time rule:** verify new datetime work against **Postgres**, not just SQLite. A Brussels wall-clock time must round-trip on a UTC server. Never send bare `yyyy-MM-ddTHH:mm`; never truncate with `.slice(0, 10)`.
- `src/lib/availability.ts`, `src/lib/booking.ts`, `src/lib/pricing.ts` are **critical** — tests mandatory, one owner per phase each.
- Skills: `code` always · `design` for UI · `cicd` for Docker/workflows · `docs` after schema/API changes · `dataviz` before any chart code.
- UI copy Dutch (nl-BE); code and identifiers English.

## Phase order and the commit ledger

Phases are gated: **do not start a phase until the previous one is merged and the PO has reviewed it.** Within a phase, a schema-changing commit lands **alone**, and no feature worker starts before it merges.

Most phases have exactly one schema commit. **Two do not, deliberately:** phase 1 (N1.2 adds the role tables, N4.3 drops the legacy column once nothing reads it) and phase 4 (O1.1 adds feed tokens, L4.2 drops the legacy role columns). In both, the two are serialised and owned by one worker — see the phase brief.

| Phase | Items | Commits | Brief | Gate to start |
|---|---|---|---|---|
| **0 — foundations & quick wins** | Y1, Y3, Y4, Y5, H3, H4, J1, P1 | 27 | `01-phase0.md` | ✅ none — ready now |
| **1 — item 8 in full** | N1, N2, N3, N4, N5 | 21 | `02-phase1.md` | PO reviewed phase 0 · **N5 design doc approved** |
| **2 — items 1, 3, 7** | DDL-2, H1, H2, H5/L5, L1, L2, L3, M1, J2a | 27 | `03-phase2.md` | phase 1 merged · **PO retest of H3/H4/J1** |
| **3 — invoices & figures** | DDL-3, J2b, K1, K4, K2, K3, I1, I2, I3, J3 | 27 | `04-phase3.md` | phase 2 merged · **J2b design doc approved** |
| **4 — later** | O1, P2, P3, L4, Y2 | 15 | `05-phase4.md` | phase 3 merged · **P3 design doc approved** |

**117 commits total** (27 · 21 · 27 · 27 · 15), counted directly from the commit headings in each brief after enrichment and review. Each phase brief lists its items in dependency order with the exact commit sequence per item.

### Readiness verdict (audited 2026-08-15, after two adversarial review rounds)

| Phase | Ready? | What must be true before it starts |
|---|---|---|
| **0** | ✅ **Runnable now** | Nothing. No open decisions, no design-doc dependency, no forward references. |
| **1** | ✅ Ready | Phase 0 merged + PO glanced at the commits. `own-data-scoping-design.md` exists; N1–N4 do not depend on it, only N5 does. |
| **2** | ✅ Ready | Phase 1 merged. **PO retests items 1 + 5 in the running app** (see phase 0's exit report) — this is a real gate: H3/H4/J1 may already satisfy much of what H1/H2 would build, and the answer can shrink phase 2. `data-import-export-design.md` exists. |
| **3** | ✅ Ready | Phase 2 merged. **`invoice-design.md` read and approved** — it is the largest single artefact in the plan and DDL-3 encodes its model shapes. Peppol is explicitly *not* a gate (schema-shaped now, integration later). |
| **4** | ✅ Ready | Phase 3 merged. Everything here is optional or cleanup; nothing downstream depends on it. |

**No phase is blocked by a missing artefact.** Every gate is either "previous phase merged" or "a human reads something that already exists".

### How to run the sequence

1. **Before phase 0:** capture current production figures for 2–3 projects (project total, a period subtotal, one material line with a setup cost). Phase 0 changes displayed money twice — Y1 corrects the serialisation bug, J1 moves travel out of the subtotal — and without a baseline there is nothing to compare against.
2. **Per phase:** run the DDL/serial item first and merge it before any parallel worker branches. Follow each item's commit sequence exactly; never squash.
3. **At the end of each phase:** the worker produces that phase's **exit report** (its last section). Read it before releasing the next phase — several exit reports carry decisions the next phase depends on (e.g. phase 1 reports whether the permission matrix was actually tightened; phase 2 reports the function-backfill mismatches for you to map by hand).
4. **Between phases:** the gate in the table above. Phase 2's PO retest is the one that can genuinely change scope.
5. **If a brief turns out to be wrong about the code,** the worker stops and reports rather than improvising — the briefs were written against verified `file:line` facts, so a mismatch means the code moved and the plan needs updating first.

### Outstanding prerequisites (not code)

Each open prerequisite is also folded into the item it gates, so a worker meets it at the right moment rather than only here.

| Prerequisite | Blocks | Resolve by | Owner | Status |
|---|---|---|---|---|
| `.plans/invoice-design.md` | J2b + DDL-3 (phase 3) | before phase 3 starts | PO reads, you approve | ✅ **written** |
| `.plans/own-data-scoping-design.md` | N5 (phase 1) | before N5 starts (N1–N4 unaffected) | PO reads, you approve | ✅ **written** |
| `.plans/data-import-export-design.md` | M1 (phase 2), P2/P3 (phase 4) | before M1 starts | PO reads, you approve | ✅ **written** |
| **Accountant: travel-cost VAT** | J2b invoices going to clients | **before the first real invoice is sent**, not before J2b is built | PO → accountant | ⚠️ open — J1 (phase 0) ships regardless; the treatment is a single configurable place |
| **Accountant: Peppol applicability** | whether J2b is a document project or a compliance project | **before phase 3 starts** — this one can change the scope of J2b | PO → accountant | ⚠️ open — the model is built Peppol-shaped either way, but if the B2B mandate applies, stop and re-scope J2b |
| Q8 label roll variant | nothing — **E5 already ships A4 3×8** (`bce0716`) | whenever a roll printer is bought | PO | 💤 parked — tracked as an optional item in phase 4 |

## How a worker runs an item

1. Read this README fully, then your item's section in the phase brief.
2. Read every file the brief cites **before editing anything**.
3. Branch: `git checkout -b <item-id>-<slug>`.
4. Work the commit sequence **in order**. Commit after each step with the given message; run the checklist every time.
5. Do not build anything in the item's "Out of scope" list. Do not add unrequested improvements.
6. When done, report: the branch name, the commit list, what you verified, and anything you could not do.

If a brief turns out to be wrong about the code, **stop and report** rather than improvising — the briefs were written against verified `file:line` facts, so a mismatch means something changed and the plan needs updating.
