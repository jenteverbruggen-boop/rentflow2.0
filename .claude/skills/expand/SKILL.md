---
name: expand
description: Plan and scope a new feature for this project. Ask the right questions before writing any code. Use when asked to build something new, add a feature, or extend existing functionality. Triggers on: "add feature", "build", "extend", "new page", "I want to be able to", "can we add".
when_to_use: Before implementing any new feature. Always complete this skill before writing code for something new.
argument-hint: "[feature description]"
---

# Expand Skill — RentFlow

## Purpose

Before writing a single line of code, gather enough context to produce a precise implementation plan. A well-scoped feature takes a fraction of the time of a poorly-scoped one.

## Feature: $ARGUMENTS

---

## Step 1 — Explore existing code

Before asking anything, read the codebase to understand what already exists:

1. Check `src/types/index.ts` — does a relevant type already exist?
2. Check `prisma/schema.prisma` — does the data model need to change?
3. Check `src/app/api/` — is there an existing route that handles part of this?
4. Check `src/app/(app)/` — is there an existing page that could be extended?
5. Check `src/components/` — are there existing form components that cover this?

Summarise what exists that's relevant to the feature.

---

## Step 2 — Ask clarifying questions

Ask only the questions that are genuinely ambiguous and affect implementation decisions. Skip questions whose answers are obvious from the request.

Group questions by theme. Cover:

### Data & domain
- What new data does this feature create, read, update, or delete?
- Does it need new database fields / models, or does it use existing ones?
- Are there uniqueness, ordering, or validation constraints?

### Business rules
- Are there conflict checks, stock limits, or other constraints (like the existing booking conflict detection)?
- What happens on edge cases — empty states, missing data, concurrent updates?
- Are there role or permission requirements (e.g. admin only)?

### UI & UX
- Where does this live in the navigation? New page, existing page, or a modal on an existing page?
- Is it a full page, a card, a dialog, or an inline section?
- What does the empty state look like?
- What feedback does the user need (success toast, inline error, redirect)?

### Scope
- Is this a v1 (MVP) or does it need all edge cases covered now?
- Are there parts of this that are out of scope for this iteration?

### Integration
- Does this feature interact with the booking system (conflict detection, stock checks)?
- Does it need to appear on the Planning page or Dashboard stats?

---

## Step 3 — Propose a concrete plan

Once you have answers, produce a plan with these sections:

### Data layer
- Schema changes (if any): new models, new fields, index
- Migration: name and what it does

### API routes
List each new route:
```
METHOD /api/path        # description
```

### UI
- Which page or component changes
- New files to create (with estimated line count)
- Which shadcn/ui components will be used
- Query keys for TanStack Query

### Implementation order
Numbered list from data layer → API → UI, with each step being independently testable.

### Out of scope
Explicitly list what is NOT being built.

---

## Step 4 — Confirm before coding

Present the plan. Only start implementing after explicit approval.

Do not:
- Skip the questions if the request is vague
- Start coding speculatively while waiting for answers
- Build more than what was agreed in the plan
- Add "nice to have" improvements that weren't asked for

Do:
- Ask all blockers in one message (not one at a time)
- Be direct about tradeoffs ("Option A is simpler but doesn't support X")
- Flag anything that touches the booking conflict logic — it's critical and easy to break
