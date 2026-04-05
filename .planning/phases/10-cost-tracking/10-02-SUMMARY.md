---
phase: 10-cost-tracking
plan: 02
subsystem: ui
tags: [recharts, shadcn, cost-display, analytics, react]

# Dependency graph
requires:
  - phase: 10-cost-tracking-01
    provides: "GET /api/cost-estimate endpoint with daily trend and monthly cost breakdown"
provides:
  - "CostSummaryCard client component with Haiku/Sonnet cost table, disclaimer, billing link, and AreaChart trend"
  - "Analytics page updated to fetch and display cost section between summary stats and charts"
affects: [11-admin-chatbot]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline formatUSD helper in client components to avoid importing server-only utilities"
    - "Optional API fetch with null fallback: cost section renders only when data is available"
    - "AreaChart (recharts) for cost trend; BarChart used by existing messages chart — visual distinction intentional"

key-files:
  created:
    - src/components/dashboard/cost-summary-card.tsx
  modified:
    - src/app/(dashboard)/analytics/page.tsx

key-decisions:
  - "Inline formatUSD in client component rather than importing from cost-estimates.ts to avoid any server-only module risk"
  - "costData is null-checked before rendering CostSummaryCard so analytics page always loads even if cost API fails"
  - "AreaChart chosen for cost trend chart to visually distinguish from existing BarChart messages-per-day chart"

patterns-established:
  - "Optional section pattern: fetch data, set to null on error, conditionally render component only when non-null"

requirements-completed: [COST-01, COST-02, COST-03]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 10 Plan 02: Cost Tracking UI Summary

**CostSummaryCard component with Haiku/Sonnet cost breakdown table, amber disclaimer with Anthropic billing link, and 30-day AreaChart trend — integrated into the analytics page**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-05T13:21:09Z
- **Completed:** 2026-04-05T13:25:04Z
- **Tasks:** 2
- **Files modified:** 1 created, 1 modified

## Accomplishments
- CostSummaryCard client component displaying per-model cost breakdown (Haiku/Sonnet/Total) with formatted USD values
- Amber disclaimer box with link to Anthropic billing console opening in new tab
- 30-day daily message volume AreaChart using recharts (visually distinct from the BarChart above it)
- Analytics page fetches cost data in parallel, gracefully omits cost section if API call fails

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CostSummaryCard component** - `0ebb2f4` (feat)
2. **Task 2: Integrate cost section into analytics page** - `043842f` (feat)

## Files Created/Modified
- `src/components/dashboard/cost-summary-card.tsx` - Client component with cost table, disclaimer, billing link, and AreaChart
- `src/app/(dashboard)/analytics/page.tsx` - Added CostData interface, cost fetch, and CostSummaryCard render between summary grid and charts

## Decisions Made
- Inline formatUSD helper in the client component (duplicates logic from `cost-estimates.ts`) to avoid any risk of importing a module with server-only side effects in a client component
- Cost section uses graceful degradation — analytics page renders fully even if `/api/cost-estimate` fetch fails
- AreaChart chosen for trend to provide visual distinction from the BarChart used for messages-per-day above it

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter type error**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `formatter={(value: number) => ...}` was incompatible with Recharts' `ValueType | undefined` signature
- **Fix:** Removed explicit `number` type annotation, let TypeScript infer from Recharts types
- **Files modified:** src/components/dashboard/cost-summary-card.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `0ebb2f4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type annotation fix. No scope change.

## Issues Encountered
- TSC check via `npx tsc --noEmit src/components/...` showed false positives (missing JSX flag, missing path aliases). Used full project `npx tsc --noEmit` for accurate verification.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Cost tracking UI is complete. Parents can view estimated API costs on the analytics page.
- Phase 10 requirements COST-01, COST-02, COST-03 all met.
- Phase 11 (admin chatbot): when Sonnet calls are added, update `/api/cost-estimate` to populate `sonnetMessages` — the UI already handles non-zero Sonnet costs correctly.

## Self-Check: PASSED

- FOUND: src/components/dashboard/cost-summary-card.tsx
- FOUND: src/app/(dashboard)/analytics/page.tsx
- FOUND: .planning/phases/10-cost-tracking/10-02-SUMMARY.md
- FOUND commits: 0ebb2f4, 043842f

---
*Phase: 10-cost-tracking*
*Completed: 2026-04-05*
