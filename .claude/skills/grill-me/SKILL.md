---
name: grill-me
description: Grill the user on a vague feature request, PM feedback bullet or plan section until every decision that changes the implementation is made — grounded in the RentFlow code, never in guesses. Use when a request is ambiguous, when PM feedback needs "uitdikken", or before a plan section is written. Triggers on: "grill me", "grill-me", "vraag me uit", "uitdikken", "wat bedoelt de PM", "maak dit duidelijk".
when_to_use: A PM bullet or feature ask is too terse to plan; a plan section has open questions; answers so far contradict each other. Not for asks that are already unambiguous — then go straight to the `expand` skill or the plan.
argument-hint: "[PM bullet | feature | plan section, e.g. 'C3' or 'offertes']"
allowed-tools: Read Grep Glob Bash(git *) Bash(ls *) Bash(grep *) Bash(sed *) Agent AskUserQuestion
---

# Grill-me — RentFlow

Subject: **$ARGUMENTS**

Your job is to turn a fuzzy ask into a short list of **decisions** that pin
down the implementation. You don't write code or a plan. You write a
decision record that a plan can be built from.

## Live repo context (injected at load)

- Branch / sync: !`git status -sb | head -1`
- Recent commits: !`git log --oneline -8`
- Plans, newest first: !`ls -t .plans/*.md | head -10`

Read the newest `*-po-feedback-round*.md` first. If the subject is a bullet or
section there (e.g. `C3`), its "Current state (verified)" and "Decision
(grilled)" blocks are your starting point. Never re-ask a decision that is
already recorded as final, and never reopen the decisions marked FINAL in
`.plans/invoice-design.md` §0.

## Step 1 — Investigate before you ask (mandatory)

A question that the code can answer is a wasted question. Before the first
question:

1. Find what already exists. Grep the Dutch *and* English terms (e.g.
   offerte/quote, inhuur/subhire, notitie/note). Check `prisma/schema.prisma`,
   `src/types/index.ts`, `src/app/api/**`, `src/app/(app)/**` and `src/lib/**`.
   If the search is broad, delegate it to an `Explore` agent and ask it for
   file:line facts.
2. Check whether the feature is **already built but not visible to the PM**.
   Look for unpushed commits (`git log origin/main..main`), unmerged branches
   (`git branch -a --no-merged main`, then confirm with
   `git cherry -v main <branch>`), and features that exist but have no UI
   (a hook or route that nothing calls).
3. Check for **naming clashes** in the Dutch UI. The PM's word may already mean
   something else in the app. For example, "Toewijzen" on notes already means
   "link to a project or client".
4. Write down a 3–6 line "what exists / what's missing" summary with file:line
   references, and show it to the user before the first question.

## Step 2 — Grill

Use `AskUserQuestion`. Rules:

- **At most 4 questions per round, one theme per round.** Ask the questions
  that change the data model first, then behaviour, then UI polish.
- **Recommend.** The first option is your recommendation, labelled
  "(Recommended)". Each option's description states its consequence in repo
  terms, for example "needs a migration", "reuses InvoiceLine", or "hidden
  from scope own".
- Use `multiSelect` only when the options really are independent.
- Ask in the user's language. Youri writes Dutch, so ask in Dutch, but keep
  code identifiers in English.
- **Read the answers adversarially.**
  - "Other" text often adds a requirement that wasn't in the options. Restate
    it in one line so the user can correct you.
  - If two selections contradict each other (e.g. "both feeds" and "only the
    personal feed"), ask a follow-up round. Don't pick one yourself.
  - If the user asks what a term means ("wat bedoel je met leveranciers?"),
    explain it in one or two plain sentences. Then take their answer, or ask
    again.
- Stop when every remaining unknown has a sensible default. List those
  defaults as **open points for the PM** instead of asking about them.

### RentFlow probe checklist

Go through every dimension the subject touches. Each one is a place where a
wrong guess has hurt this repo before.

| Dimension | Ask / check |
|---|---|
| Money | Decimal (Postgres) vs Float (SQLite). Convert with `toNumber()` at the route boundary. BTW: is it per line, or the `btwRate` setting? Are amounts excl. or incl. BTW? Can they be negative? |
| Invoices | Sent invoices are frozen; correcting one needs a credit note. Numbering is gapless and only allocated at finalize. Does the new thing touch `Invoice` reads in stats, exports or lists? |
| Permissions | Which module key in the 4-level matrix (geen/lezen/wijzigen/verwijderen)? Does it need a new module or can it reuse one? `scope: own` (freelancers) never sees money (`moneyVisible`/`redactMoney`). What can they read or write? |
| People vs users | `Person` is crew and may have no login. `User` is an account with an optional `personId`. Who is the target, and what happens when `linkedPersonMissing`? |
| Bookings | Availability overlap, overbooking (`PeriodMaterialShortage`, concept-only), H6 day-level bookings and the timezone-free day count, sets/bundles and their components. |
| Figures | Does it change revenue, top materials, client figures or payback (K4)? Could it skew them? |
| Documents | Print pages (`PrintLayout`, `DocumentHeader`), the logo, and `/api/settings` needing `instellingen: lezen`. |
| Calendar | ICS feeds: personal vs company. The token carries no permissions. SEQUENCE comes from `Period.updatedAt`. |
| Import/export | Rentman export columns/folders (`.plans/tools/`). Is the xlsx export a re-import dump or meant for people to read? |
| Lifecycle | What happens on delete or archive, when dates change, under concurrent edits, or when the status changes? |
| Schema | Does it need a Postgres migration authored per CLAUDE.md, plus a `schema.dev.prisma` mirror? |
| UI | Where it lives (page, tab, dialog, dashboard card), the empty state, and the 150-line file limit. |
| Tests | Lib/hook level only. Radix `<Select>` hangs under jsdom here. |

## Step 3 — Decision record

When you're done, output (or, if the subject is a plan section, write into that
section) exactly:

```markdown
### Decision (grilled YYYY-MM-DD)
- <decision, one line, phrased as behaviour>
- ...

### Current state (verified)
- <fact> — `path:line`

### Open points for the PM (default chosen)
- <default> — <why it is safe>
```

Use today's date. Write decisions as behaviour ("Accepting a quote moves
the project to bevestigd"), not as the question. If the user changes a
decision later, edit the record in place and add a dated note. Don't add
a second record.

## Don'ts

- Don't write code, migrations or a full plan here. Hand off to `expand` or to
  the round plan.
- Don't ask about anything Step 1 could have answered.
- Don't give options with no consequence attached.
- Don't silently resolve a contradiction or an "Other" answer.
- Don't relitigate decisions already recorded as final.
