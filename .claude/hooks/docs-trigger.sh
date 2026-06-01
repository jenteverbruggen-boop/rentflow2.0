#!/usr/bin/env bash
# PostToolUse hook: after an Edit/Write/MultiEdit on a doc-relevant file,
# inject a reminder telling Claude to invoke the `docs` skill so README.md
# stays in sync with the code. Silent for all other file changes.
set -euo pipefail

payload="$(cat)"
file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"

[ -z "$file_path" ] && exit 0

# Patterns whose changes can invalidate sections of README.md.
# Keep this list in sync with the table in .claude/skills/docs/SKILL.md.
if printf '%s' "$file_path" | grep -Eq \
  -e '/src/app/api/.*/route\.ts$' \
  -e '/prisma/schema(\.dev)?\.prisma$' \
  -e '/src/types/index\.ts$' \
  -e '/\.env(\.local)?\.example$' \
  -e '/next\.config\.(ts|js|mjs)$' \
  -e '/package\.json$' \
  -e '/\.github/workflows/.*\.ya?ml$' \
  -e '/Dockerfile$' \
  -e '/docker-compose\.ya?ml$' \
  -e '/src/proxy\.ts$' \
  -e '/src/lib/(auth|api-auth|prisma)\.ts$' \
; then
  jq -n --arg fp "$file_path" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: ("Doc-relevant file modified: \($fp). Before completing this turn, invoke the `docs` skill to review README.md for stale sections. If nothing in README is affected, state that explicitly and skip the edit.")
    }
  }'
fi
