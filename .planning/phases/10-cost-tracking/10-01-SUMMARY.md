---
phase: 10-cost-tracking
plan: 01
subsystem: api
tags: [mongodb, cost-tracking, anthropic, pricing, aggregation]

# Dependency graph
requires: []
provides:
  - "Cost estimation library with Anthropic pricing constants and token-formula calculator"
  - "GET /api/cost-estimate endpoint returning 30-day daily trend and monthly cost breakdown"
affects: [10-cost-tracking, 11-admin-chatbot]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token estimation: (SYSTEM_PROMPT_TOKENS + input_chars/4) * msgCount for input, (output_chars/4) * msgCount for output"
    - "Cost = (inputTokens * rate + outputTokens * rate) / 1_000_000"
    - "MongoDB aggregation with user role filter via conversation lookup (same pattern as /api/analytics)"
    - "Zero-fill date map for continuous 30-day trend, no gaps for missing days"
    - "Node built-in test runner (node:test) with tsx for TypeScript test files"

key-files:
  created:
    - src/lib/cost-estimates.ts
    - src/app/api/cost-estimate/route.ts
    - src/lib/__tests__/cost-estimates.test.ts
  modified: []

key-decisions:
  - "Sonnet message count hardcoded to 0 in API response — Phase 11 will add admin chatbot and update this"
  - "Daily trend uses ALL messages (no user role filter) — pure volume metric for cost purposes"
  - "Monthly Haiku count filters to non-ADMIN users via conversation lookup — mirrors analytics route pattern"
  - "formatUSD: >= $1 uses 2 decimal places, < $1 uses 4 decimal places for small cost visibility"

patterns-established:
  - "Cost library pattern: PRICING constants object + typed params interface + pure calculator function"
  - "TDD with node:test + tsx for unit tests on pure utility functions"

requirements-completed: [COST-01, COST-03]

# Metrics
duration: 12min
completed: 2026-04-05
---

# Phase 10 Plan 01: Cost Tracking Backend Summary

**Anthropic pricing library and cost-estimate API endpoint using token-formula math (not flat rate), with 30-day message trend aggregation from MongoDB**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-05T13:11:30Z
- **Completed:** 2026-04-05T13:23:00Z
- **Tasks:** 2
- **Files modified:** 3 created, 0 modified

## Accomplishments
- Cost estimation library with Anthropic Haiku/Sonnet pricing constants and token-formula calculator (10 tests, all passing)
- GET /api/cost-estimate endpoint returning structured JSON with daily trend data and monthly cost breakdown
- Non-ADMIN user filter applied to monthly Haiku count via conversation collection lookup (consistent with analytics route)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED — failing tests** - `ff4f3aa` (test)
2. **Task 1: TDD GREEN — cost estimation library** - `857d3d0` (feat)
3. **Task 2: cost estimate API route** - `b326260` (feat)

_Note: TDD task split into test commit (RED) and implementation commit (GREEN)_

## Files Created/Modified
- `src/lib/cost-estimates.ts` - PRICING constants, CostEstimate interface, estimateCost(), formatUSD()
- `src/app/api/cost-estimate/route.ts` - GET handler with auth guard, two MongoDB aggregations, cost calculation
- `src/lib/__tests__/cost-estimates.test.ts` - 10 unit tests covering edge cases, known values, type checks

## Decisions Made
- Sonnet messages hardcoded to 0; Phase 11 admin chatbot will provide the real count
- Daily trend intentionally counts ALL messages (no role filter) — cost perspective needs total API call volume
- Monthly Haiku count follows analytics route pattern: lookup conversations, lookup users, filter role != ADMIN
- formatUSD uses 4 decimal places for sub-$1 amounts so small daily costs remain readable (e.g., $0.0045 not $0.00)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Backend data endpoint complete; Phase 10 Plan 02 can now build the cost tracking UI page
- API shape is fixed: `{ daily: [{date, messages}], monthly: {haikuMessages, sonnetMessages, haikuCost, sonnetCost, totalCost, periodDays} }`
- Phase 11 admin chatbot: update `sonnetMessages` count in the API route when Sonnet calls are added

## Self-Check: PASSED

- FOUND: src/lib/cost-estimates.ts
- FOUND: src/app/api/cost-estimate/route.ts
- FOUND: src/lib/__tests__/cost-estimates.test.ts
- FOUND: .planning/phases/10-cost-tracking/10-01-SUMMARY.md
- FOUND commits: ff4f3aa, 857d3d0, b326260

---
*Phase: 10-cost-tracking*
*Completed: 2026-04-05*
