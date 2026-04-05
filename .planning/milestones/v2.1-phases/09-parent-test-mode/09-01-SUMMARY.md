---
phase: 09-parent-test-mode
plan: "01"
subsystem: api
tags: [anthropic, claude, ai, system-prompt, api-route, safety]

# Dependency graph
requires:
  - phase: 08-safety-transparency
    provides: SYSTEM_PROMPT string in safety-rules page (extracted here)
provides:
  - Shared SYSTEM_PROMPT constant in src/lib/system-prompt.ts
  - POST /api/test-chat endpoint calling Claude Haiku with safety system prompt
affects: [09-parent-test-mode, chat-ui, safety-transparency]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk ^0.82.0"]
  patterns: ["Shared system-prompt module imported by both display page and API route", "Anthropic client instantiated per-request reading ANTHROPIC_API_KEY from env"]

key-files:
  created:
    - src/lib/system-prompt.ts
    - src/app/api/test-chat/route.ts
  modified:
    - src/app/(dashboard)/safety-rules/page.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "SYSTEM_PROMPT defined in exactly one place (src/lib/system-prompt.ts), imported by both safety-rules page and test-chat route"
  - "Non-streaming API call for simplicity in test mode — parent test chat doesn't need streaming"
  - "claude-haiku-4-5-20250414 model with max_tokens 1024 for fast, economical test responses"

patterns-established:
  - "System prompt shared module: display and API share the same prompt string via @/lib/system-prompt"
  - "Auth gate pattern: all /api/* routes start with const session = await auth(); if (!session) return 401"

requirements-completed: [TEST-01]

# Metrics
duration: 6min
completed: "2026-04-04"
---

# Phase 9 Plan 01: Parent Test Mode Backend Summary

**Shared SYSTEM_PROMPT module + POST /api/test-chat calling claude-haiku-4-5 with safety rules enforced**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-04T23:31:09Z
- **Completed:** 2026-04-04T23:37:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extracted safety system prompt from inline page constant to `src/lib/system-prompt.ts` as a named export
- Updated `safety-rules/page.tsx` to import from shared module — no duplicate prompt definitions
- Installed `@anthropic-ai/sdk` and created `POST /api/test-chat` with auth gate, input validation, and Claude Haiku call
- Build passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract SYSTEM_PROMPT to shared module** - `73e89ce` (feat)
2. **Task 2: Install Anthropic SDK and create /api/test-chat route** - `86bc2f5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/system-prompt.ts` - Named export SYSTEM_PROMPT constant (single source of truth)
- `src/app/(dashboard)/safety-rules/page.tsx` - Replaced inline const with import from shared module
- `src/app/api/test-chat/route.ts` - POST handler with auth gate, message validation, Anthropic SDK call
- `package.json` - Added @anthropic-ai/sdk ^0.82.0 dependency
- `package-lock.json` - Lockfile updated

## Decisions Made
- Non-streaming Anthropic API call: parent test mode is a sandbox tool, not a production chat; streaming complexity not warranted
- claude-haiku-4-5-20250414: fast and economical for interactive test use
- max_tokens 1024: sufficient for conversational responses, caps API cost

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

The /api/test-chat route requires `ANTHROPIC_API_KEY` to be set in the environment. This environment variable must be added to the Railway service before the endpoint will function. The build succeeds without it, but runtime calls will fail if it is missing.

## Next Phase Readiness
- Backend for Parent Test Mode is complete
- Plan 02 can now build the frontend chat sandbox UI that calls POST /api/test-chat
- ANTHROPIC_API_KEY must be present in the deployment environment before Plan 02 is testable end-to-end

---
*Phase: 09-parent-test-mode*
*Completed: 2026-04-04*
