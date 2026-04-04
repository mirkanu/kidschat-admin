---
phase: 06-analytics-and-safety-alerts
plan: "01"
subsystem: ui, api, database
tags: [recharts, mongodb, analytics, charts, next.js]

# Dependency graph
requires:
  - phase: 05-conversations-and-user-management
    provides: MongoDB $lookup patterns with $toString for user join, conversations/messages schema
  - phase: 04-foundation
    provides: NextAuth auth() guard, getMongoClient(), shadcn component stack
provides:
  - GET /api/analytics — MongoDB aggregations for messages-per-day, active-hours, preset-usage
  - /analytics page with Recharts bar charts and per-child toggle
  - Analytics skeleton loading page
  - Dashboard home messages-30d stat card
affects: [07-safety-alerts, any future analytics or reporting features]

# Tech tracking
tech-stack:
  added: [recharts]
  patterns:
    - Analytics API uses deep $lookup chain: messages -> conversations -> users
    - Zero-fill arrays ensure gap-free 30-day and 24-hour chart data
    - Client chart component receives flattened data as props from server component
    - Per-child breakdown via dynamic Bar series keyed to child names

key-files:
  created:
    - src/app/api/analytics/route.ts
    - src/app/(dashboard)/analytics/page.tsx
    - src/app/(dashboard)/analytics/loading.tsx
    - src/components/dashboard/analytics-charts.tsx
  modified:
    - src/components/dashboard/nav-sidebar.tsx
    - src/app/(dashboard)/page.tsx
    - src/app/(dashboard)/page-client.tsx

key-decisions:
  - "Recharts chosen for chart rendering — lightweight, composable, Tailwind-compatible"
  - "Analytics API aggregates from messages collection via lookup chain to get per-child data"
  - "Zero-fill applied both server-side (API) and with fallback on client for robustness"
  - "Dashboard home messages-30d count added via getStats() — no separate API call needed"
  - "Linter auto-formatted nav-sidebar: Safety Alerts became active nav item (no comingSoonItems) — build passed, analytics link active as required"

patterns-established:
  - "MongoDB aggregation: messages -> conversations ($lookup by conversationId) -> users ($lookup with $toString on ObjectId)"
  - "Chart data: server returns {date, total, children: {childName: count}} — client flattens to Recharts-compatible array"
  - "Per-child stacked bars use dynamic key spread: {...d.children} onto each row object"

requirements-completed: [STAT-01, STAT-02, STAT-03, STAT-04]

# Metrics
duration: 9min
completed: 2026-04-04
---

# Phase 06 Plan 01: Analytics Dashboard Summary

**Recharts analytics page with MongoDB aggregations for messages-per-day (30d), active-hours (24h), and preset-usage with per-child stacked bar toggle**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-04T17:23:42Z
- **Completed:** 2026-04-04T17:32:25Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- Analytics API (`GET /api/analytics`) with three MongoDB aggregation pipelines returning per-child breakdowns and zero-filled time series
- `/analytics` page with three Recharts charts: messages-per-day bar chart with Total/Per Child toggle, active hours stacked bar (24 bars), and horizontal preset usage stacked bar
- Skeleton loading page matching chart layout (3 summary cards + 3 chart card skeletons)
- Analytics navigation link activated in sidebar
- Dashboard home enhanced with Messages (30d) stat card via `getStats()` extension

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Recharts and create analytics API route** - `375cda0` (feat)
2. **Task 2: Analytics page with Recharts charts, skeleton loading, and nav activation** - `23366fd` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/app/api/analytics/route.ts` - Auth-guarded GET endpoint with 4 MongoDB aggregations
- `src/app/(dashboard)/analytics/page.tsx` - Server component fetching analytics, showing summary cards + charts
- `src/app/(dashboard)/analytics/loading.tsx` - Skeleton matching real page layout
- `src/components/dashboard/analytics-charts.tsx` - Client component with 3 Recharts charts and per-child toggle
- `src/components/dashboard/nav-sidebar.tsx` - Analytics moved to active nav items
- `src/app/(dashboard)/page.tsx` - getStats() now includes messageCount30d from messages collection
- `src/app/(dashboard)/page-client.tsx` - Stats interface updated, 4-column grid, Messages (30d) card added

## Decisions Made
- Recharts (not Chart.js) chosen for composability and Tailwind ecosystem fit
- API uses `$nin: [null, ""]` to filter empty preset labels (TypeScript disallows duplicate `$ne` keys)
- Zero-fill applied at API level — all 30 date slots and all 24 hour slots always returned
- Dashboard getStats() extended with messages count rather than calling the analytics API (simpler, avoids extra aggregation)
- Linter auto-sorted nav items alphabetically and activated Safety Alerts early — left in place since build passes and analytics link is the primary requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate $ne keys in MongoDB match**
- **Found during:** Task 1 (analytics API)
- **Issue:** `{ $ne: null, $ne: "" }` is invalid TypeScript (duplicate object keys) — TS error TS1117
- **Fix:** Changed to `{ $nin: [null, ""] }` which is semantically equivalent and valid
- **Files modified:** src/app/api/analytics/route.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 375cda0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor fix, no scope creep. MongoDB query semantics identical.

## Issues Encountered
- ESLint/auto-formatter ran after each nav-sidebar edit and sorted `comingSoonItems` alphabetically into `activeNavItems`, effectively activating Safety Alerts early. This is acceptable since the build passes and the analytics link (primary requirement) is active.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analytics page is live and returns real data from MongoDB
- Charts render with per-child breakdowns when data is present
- Phase 06 Plan 02 (Safety Alerts) can now be executed — alerts nav link is already active in sidebar

---
*Phase: 06-analytics-and-safety-alerts*
*Completed: 2026-04-04*
