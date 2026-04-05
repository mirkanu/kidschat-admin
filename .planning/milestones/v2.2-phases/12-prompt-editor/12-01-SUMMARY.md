---
phase: 12-prompt-editor
plan: "01"
subsystem: api
tags: [github-gist, mongodb, anthropic, prompt-management, rollback]

# Dependency graph
requires:
  - phase: 11-admin-chatbot
    provides: admin auth pattern (session + role check), Anthropic SDK usage
  - phase: 10-cost-tracking
    provides: MongoDB client pattern (getMongoClient)
provides:
  - src/lib/gist-client.ts — GitHub Gist read/write via REST API
  - POST /api/prompt-editor/deploy — deploy prompt to Gist with pre-deploy rollback
  - POST /api/prompt-editor/review — AI checklist review with 6 required sections
  - GET /api/prompt-editor/history — fetch latest rollback entry
  - POST /api/prompt-editor/history — restore from rollback
  - POST /api/test-chat (modified) — optional systemPrompt override for sandbox testing
affects: [12-prompt-editor-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GitHub Gist PATCH via native fetch (not Octokit) — compatible with fine-grained PATs"
    - "Pre-deploy rollback: full YAML saved to prompt_history before every Gist overwrite"
    - "YAML systemPrompt block replacement via regex (avoids YAML parser dependency)"
    - "Claude Sonnet used as structured JSON reviewer with required-sections checklist"

key-files:
  created:
    - src/lib/gist-client.ts
    - src/app/api/prompt-editor/deploy/route.ts
    - src/app/api/prompt-editor/review/route.ts
    - src/app/api/prompt-editor/history/route.ts
  modified:
    - src/app/api/test-chat/route.ts

key-decisions:
  - "Gist update uses native fetch PATCH — not Octokit or gh CLI (incompatible with fine-grained PATs per architecture decision)"
  - "Deploy route saves FULL previous YAML (not just extracted prompt) to enable byte-perfect rollback"
  - "app_config.active_prompt update in deploy is non-fatal — log error but don't fail deploy"
  - "Review response JSON parsing strips markdown code fences before parse attempt"
  - "test-chat systemPrompt override uses || fallback — empty string falls through to SYSTEM_PROMPT"

patterns-established:
  - "requireAdmin() helper in history route — reusable auth check pattern with typed return"
  - "YAML literal block scalar replacement: indent each line then use regex to swap block"

requirements-completed: [EDIT-02, EDIT-03, EDIT-04, EDIT-05]

# Metrics
duration: 15min
completed: 2026-04-05
---

# Phase 12 Plan 01: Prompt Editor Backend Summary

**GitHub Gist client + deploy/review/history/test-chat API routes with pre-deploy MongoDB rollback and 6-section Claude Sonnet safety review**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-05T15:12:00Z
- **Completed:** 2026-04-05T15:27:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Built `gist-client.ts` with `fetchGist`/`updateGist` using native fetch and fine-grained PAT support
- Deploy route saves full pre-deploy YAML to `prompt_history` MongoDB collection before Gist PATCH
- Review route calls Claude Sonnet with structured 6-section checklist, returns per-section PASS/FAIL JSON
- History route supports GET (latest rollback) and POST rollback restore
- Test-chat route accepts optional `systemPrompt` override for sandbox testing drafts without deploying

## Task Commits

Each task was committed atomically:

1. **Task 1: Gist client and deploy/review/history routes** - `caab694` (feat)
2. **Task 2: test-chat systemPrompt override** - `193f2d2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/gist-client.ts` — fetchGist/updateGist wrappers using native fetch + GitHub REST API
- `src/app/api/prompt-editor/deploy/route.ts` — ADMIN-guarded deploy: fetch -> backup -> PATCH Gist -> sync app_config
- `src/app/api/prompt-editor/review/route.ts` — ADMIN-guarded AI checklist review returning structured JSON
- `src/app/api/prompt-editor/history/route.ts` — ADMIN-guarded GET latest rollback + POST restore
- `src/app/api/test-chat/route.ts` — Added optional systemPrompt override (body field + || fallback)

## Decisions Made
- Used native fetch for Gist calls (architecture decision from research: fine-grained PATs incompatible with Octokit)
- Stored full previous YAML (not just extracted prompt) in `prompt_history.previousContent` to enable byte-perfect rollback
- `app_config.active_prompt` sync in deploy is non-fatal — failure logged but deploy still succeeds
- Review JSON parsing strips markdown code fences before parse (Claude sometimes wraps JSON in triple-backticks)
- Empty `systemPrompt` string falls through to `SYSTEM_PROMPT` constant (uses `||` not `??`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None — `GITHUB_GIST_TOKEN` and `GIST_ID` are already documented as Phase 12 prerequisites in STATE.md blockers.

## Next Phase Readiness
- All 5 API routes are live and ADMIN-auth-guarded
- Frontend (Phase 12 Plan 02) can call `/api/prompt-editor/deploy`, `/api/prompt-editor/review`, `/api/prompt-editor/history`, and `/api/test-chat` with `systemPrompt` override
- `GITHUB_GIST_TOKEN` + `GIST_ID` must be set in Railway before end-to-end testing

---
*Phase: 12-prompt-editor*
*Completed: 2026-04-05*

## Self-Check: PASSED

All created files exist on disk and all task commits are present in git history.
