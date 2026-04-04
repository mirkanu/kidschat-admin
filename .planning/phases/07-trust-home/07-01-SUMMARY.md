---
phase: 07-trust-home
plan: 01
subsystem: database
tags: [mongodb, typescript, safety-patterns, server-components]

# Dependency graph
requires: []
provides:
  - "Fixed users page showing all accounts via direct MongoDB query"
  - "getSystemStatus() — MongoDB ping, admin account check, pattern detection health"
  - "get24hDigest() — 24h message count, safety event scan, active children count"
  - "getRecentAlerts(limit) — top N recent safety alerts with user name lookup"
affects: [07-trust-home, 08, 09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server components query MongoDB directly with getMongoClient (no self-referencing fetch)"
    - "Safety event scanning: fetch messages in time window, run detectSafetyEvent() on each"
    - "Trust data layer in src/lib/ provides typed async functions consumed via Suspense"

key-files:
  created:
    - src/lib/trust-dashboard.ts
  modified:
    - src/app/(dashboard)/users/page.tsx

key-decisions:
  - "Users page uses direct MongoDB query instead of self-referencing HTTP fetch to avoid 401 auth issue"
  - "Trust dashboard data layer is in src/lib/ (not in page files) for reuse by Plan 02 via Suspense"
  - "systemHealth logic: critical if >5 jailbreak attempts, warning if any safety event, else healthy"
  - "getRecentAlerts uses 7-day window with 1000 message scan limit"

patterns-established:
  - "Trust data functions: getSystemStatus, get24hDigest, getRecentAlerts — ready for Plan 02 Suspense boundaries"
  - "Safety scanning pattern: fetch messages in time window, map through detectSafetyEvent, collect matches"

requirements-completed: [FIX-01, TRUST-01, TRUST-02, TRUST-03]

# Metrics
duration: 8min
completed: 2026-04-04
---

# Phase 7 Plan 01: Trust Home Data Layer Summary

**Users page bug fixed (0 accounts) via direct MongoDB query; trust-dashboard.ts data layer with typed getSystemStatus, get24hDigest, getRecentAlerts functions ready for Plan 02 UI**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T20:00:00Z
- **Completed:** 2026-04-04T20:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed FIX-01: users page no longer uses self-referencing HTTP fetch that returned 401 — now uses getMongoClient directly and will show all 4 user accounts
- Created src/lib/trust-dashboard.ts exporting three typed data functions for Plan 02's trust center home page
- All TypeScript compiles clean; full Next.js build passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix users page to use direct MongoDB query** - `99ab139` (fix)
2. **Task 2: Create trust dashboard data layer** - `d1eb4f1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/(dashboard)/users/page.tsx` - Replaced fetchUsers() HTTP fetch with getUsers() direct MongoDB query
- `src/lib/trust-dashboard.ts` - New data layer: getSystemStatus, get24hDigest, getRecentAlerts with full TypeScript types

## Decisions Made
- Users page bug was a server-component-fetching-itself pattern — fixed by matching the pattern from conversations/page.tsx and alerts/page.tsx (direct getMongoClient import)
- Trust data layer placed in src/lib/ so Plan 02 page components can import the functions directly into Suspense-wrapped server components
- getRecentAlerts uses 7-day window (vs 90-day for alerts page) — a lighter-weight preview for the dashboard home

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can now import getSystemStatus, get24hDigest, getRecentAlerts from @/lib/trust-dashboard
- Users page is fixed and will correctly display all accounts
- All data functions are typed and tested via TypeScript compilation

---
*Phase: 07-trust-home*
*Completed: 2026-04-04*
