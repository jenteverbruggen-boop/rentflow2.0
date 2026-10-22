---
name: expand
description: Plan and scope a new feature for this project. Ask the right questions before writing any code. Use when asked to build something new, add a feature, or extend existing functionality. Triggers on: "add feature", "build", "extend", "new page", "I want to be able to", "can we add".
when_to_use: Before implementing any new feature. Always complete this skill before writing code for something new. If the ask itself is vague (a terse PM bullet), run `grill-me` first.
argument-hint: "[feature description]"
---

# Expand Skill — RentFlow

Feature: **$ARGUMENTS**

Goal: turn the request into an approved, concrete plan **before** any code.

## Step 1 — Explore (before asking anything)

1. `.plans/`: is this already in a PO-feedback round (`*-po-feedback-round*.md`)
   or a design doc? If it has a "Decision (grilled)" block, build on it and
   don't re-ask what's settled. Never reopen decisions marked FINAL
   (`.plans/invoice-design.md` §0).
2. Is it already partly built? Grep the Dutch **and** English terms in
   `prisma/schema.prisma`, `src/types/index.ts`, `src/app/api/**`,
   `src/app/(app)/**`, `src/lib/**`, `src/hooks/**`, `src/components/**`. For a
   broad search, use an `Explore` agent.
3. Summarise in a few lines what exists and what's missing, with `file:line`
   references.

## Step 2 — Clarify

If the request is still vague after Step 1, hand off to **`grill-me`**. It
handles question rounds and writes the decision record. Otherwise, ask only
the questions whose answers change the implementation. Use `AskUserQuestion`:
at most 4 per round, your recommendation first, and each option's consequence
stated. Ask about the data model first, then behaviour, then UI.

Cover the dimensions the feature touches:

- **Data:** new models or fields? Constraints, ordering, uniqueness?
- **Permissions:** which module key and level? Does it need a new module? What
  does a `scope: own` freelancer see, and does money need hiding (`redactMoney`)?
- **Money:** Decimal (Postgres) vs Float (SQLite); BTW; excl./incl.; frozen
  invoices.
- **Bookings:** availability and conflict checks, overbooking, sets/bundles,
  day-level person bookings.
- **Integration:** planning, dashboard / `cijfers` figures, print documents,
  ICS feeds, import/export.
- **UI:** new page (and its nav group), tab, dialog or card? Empty state?
  Feedback?
- **Scope:** what's in v1 and what's explicitly out?

## Step 3 — Plan

Write the plan (for round work, in the round's `.plans/` file):

- **Data layer:** schema changes in `schema.prisma` **and** the
  `schema.dev.prisma` mirror (Decimal ↔ Float), plus the Postgres migration
  name, authored per CLAUDE.md.
- **API routes:** `METHOD /api/path`, each with its `requireModule(module, level)`
  and whether the response is redacted.
- **Lib:** pure helpers (unit-tested) and transactional helpers
  (integration-tested).
- **UI:** files to create or change with estimated line counts (150-line
  limit), shadcn components, hooks and query keys, and which keys to
  invalidate.
- **Tests:** which `*.test.ts` / `*.integration.test.ts`, and whether `qa/`
  needs a scenario.
- **Docs:** README sections affected (`docs` skill).
- **Implementation order:** data → lib → API → UI, each step testable on its own.
- **Out of scope:** listed explicitly.

## Step 4 — Confirm before coding

Present the plan and wait for explicit approval. Don't start coding while you
wait, don't build more than the plan, and don't add nice-to-haves nobody asked
for. Call out tradeoffs ("A is simpler but doesn't support X"). Flag anything
that touches booking conflict logic, invoice numbering or freezing, or
permissions. Those are critical and easy to break.
