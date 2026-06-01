---
name: docs
description: Maintain the single root README.md as the authoritative project documentation. Review and update it after any significant code change so the doc never drifts from the code. Triggers on: "update docs", "refresh readme", "document this", explicit user request, or the PostToolUse docs-trigger hook firing on changes to API routes, Prisma schema, types, env files, workflows, Dockerfile, or core lib files.
when_to_use: After any significant code change (new/changed API routes, Prisma schema changes, env var changes, new scripts in package.json, CI/CD workflow changes, Dockerfile/compose changes, project-structure changes). Always run before marking such a task complete. The docs-trigger hook will inject a reminder when a tracked file is edited.
allowed-tools: Read Edit Write Grep Bash(find *) Bash(git diff *) Bash(git log *) Bash(rg *) Bash(ls *)
---

# Docs Skill — RentFlow

The project has **one** authoritative documentation file: `README.md` at the repo root. There is no `/docs` folder, no per-feature READMEs, no wiki. Everything user-facing or onboarding-relevant lives in that one file.

Internal contributor guidance lives in `CLAUDE.md` and `AGENTS.md` — do **not** duplicate that content in `README.md`. README is for someone setting up or integrating with the project; CLAUDE.md is for agents writing code.

## When to run

Run this skill any time a change touches one of these surfaces — the docs-trigger hook already flags them:

| Area | Watched paths | README section that may need updating |
|---|---|---|
| API surface | `src/app/api/**` | **API Overview** table |
| Data model | `prisma/schema.prisma`, `prisma/schema.dev.prisma` | **Tech Stack**, **API Overview** (if endpoints change) |
| Shared types | `src/types/index.ts` | **API Overview** (response shapes) |
| Env / config | `.env.example`, `.env.local.example`, `next.config.*` | **Environment Variables** |
| Scripts | `package.json` (scripts only) | **Local Development**, **Docker Compose** |
| Project structure | new top-level dirs under `src/app/(app)/`, `src/components/`, `src/lib/`, `src/hooks/` | **Project Structure** tree |
| CI/CD | `.github/workflows/**` | **CI/CD** table |
| Docker | `Dockerfile`, `docker-compose.yml` | **Docker Compose** |
| Auth | `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/api-auth.ts` | **API Overview** intro paragraph |

If no section is affected, say so explicitly and skip the edit — no churn just to look busy.

## Procedure

1. **Diff the change.** Run `git diff --stat` (and `git diff` on the relevant files) to know exactly what changed in this turn. Do **not** rewrite sections you have not verified.
2. **Map files → sections** using the table above.
3. **Read the current `README.md`** for those sections only.
4. **Verify the source of truth before editing**:
   - API routes: `find src/app/api -name 'route.ts'` and read each handler to confirm method + path + auth + behavior.
   - Env vars: read `.env.example` and `.env.local.example` line-by-line.
   - Scripts: read the `"scripts"` block in `package.json`.
   - Workflows: read each file in `.github/workflows/`.
5. **Edit `README.md` with `Edit`** — targeted replacements only. Never rewrite the whole file. Preserve heading structure and Table of Contents anchors.
6. **Update the Table of Contents** if (and only if) you added/removed/renamed a top-level section.
7. **Don't invent.** If something is unclear (e.g. a new env var with no description), ask the user rather than guessing.

## Style rules

- Tables for anything list-shaped (endpoints, env vars, commands, workflows). Match the existing column layouts exactly.
- Code blocks are language-tagged (` ```bash `, ` ```typescript `, ` ```dockerfile `).
- Paths and filenames in backticks.
- No emojis. No marketing copy. No "we" / "our" — keep it neutral and instructional.
- British/European Dutch context in the app, but the README itself is **English only**.
- Keep the README under ~250 lines. If a section is growing past ~30 lines, push detail into `CLAUDE.md` instead.
- Never link to non-existent files or routes.

## What NOT to document here

- Internal Claude/agent guidance → that's `CLAUDE.md` / `AGENTS.md` / `.claude/skills/`.
- Per-component implementation details → live in the code, not the README.
- TODOs, roadmap, changelogs → not in README. Git history is the changelog.
- Anything copied verbatim from `CLAUDE.md` — link the concept, don't duplicate the prose.

## Verify before finishing

- [ ] Every endpoint listed in **API Overview** exists at the documented path with the documented method.
- [ ] Every env var listed exists in `.env.example` or `.env.local.example`.
- [ ] Every script in the **Useful dev commands** / setup blocks exists in `package.json`.
- [ ] Every workflow listed in **CI/CD** exists in `.github/workflows/`.
- [ ] No broken intra-doc anchor links (`#section-name` matches an actual heading).
- [ ] No mention of features, files, or commands that don't exist in the current working tree.
