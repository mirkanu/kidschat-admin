---
phase: 06-analytics-and-safety-alerts
plan: "02"
subsystem: safety-alerts
tags: [safety, pattern-matching, alerts, dashboard]
dependency_graph:
  requires: []
  provides: [safety-alerts-page, safety-pattern-library, alerts-api]
  affects: [nav-sidebar]
tech_stack:
  added: []
  patterns: [server-component-direct-db, client-side-filter-tabs, pattern-matching-library]
key_files:
  created:
    - src/lib/safety-patterns.ts
    - src/app/api/alerts/route.ts
    - src/app/(dashboard)/alerts/page.tsx
    - src/app/(dashboard)/alerts/loading.tsx
    - src/components/dashboard/alerts-table.tsx
  modified:
    - src/components/dashboard/nav-sidebar.tsx
decisions:
  - Alerts page uses direct MongoDB query in server component rather than fetching /api/alerts — avoids HTTP auth complexity in server-to-server calls
  - Analytics link was already activated in 06-01; Safety Alerts added alongside it, comingSoonItems section removed entirely
  - DAN pattern uses case-sensitive word boundary regex (\bDAN\b) while all other patterns are case-insensitive
metrics:
  duration: "12 minutes"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
  completed_date: "2026-04-04"
---

# Phase 6 Plan 02: Safety Alerts Detection and Log Page Summary

**One-liner:** Pattern-matched safety alert detection scanning 90 days of message history with a filterable log table linking to source conversations.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Safety pattern detection library and alerts API | 3c7b4e7 | `src/lib/safety-patterns.ts`, `src/app/api/alerts/route.ts` |
| 2 | Alerts page with event log table, skeleton loading, and nav activation | cd89fd5 | `src/app/(dashboard)/alerts/page.tsx`, `src/app/(dashboard)/alerts/loading.tsx`, `src/components/dashboard/alerts-table.tsx`, `src/components/dashboard/nav-sidebar.tsx` |

## What Was Built

**Safety pattern library (`src/lib/safety-patterns.ts`):**
- `SafetyEvent` interface with type, conversationId, conversationTitle, childName, messageText (150-char excerpt), detectedAt (ISO), and matchedPattern
- `detectSafetyEvent(text, isCreatedByUser)` function checking text against 10 AI redirect patterns or 15 jailbreak patterns
- All patterns are case-insensitive except DAN which uses `\bDAN\b` (word boundary, case-sensitive)

**Alerts API (`GET /api/alerts`):**
- Auth-gated endpoint scanning last 90 days of messages (limit 5000)
- Pattern matching runs in JS (not MongoDB aggregation)
- Batch-lookups conversation metadata and user names for matched messages
- Supports optional `?days=N` query param
- Returns `{ alerts: SafetyEvent[], totalCount: number }` sorted newest first

**Alerts page (`/alerts`):**
- Server component with direct MongoDB query (avoids HTTP auth complexity)
- Summary badges showing total events, redirect count, jailbreak count
- `AlertsTable` client component with:
  - Filter tabs: All, Safety Redirects (yellow badge), Jailbreak Attempts (red badge)
  - Table columns: Type, Child, Excerpt, When, Source link (ExternalLink icon)
  - Empty state with Shield icon and reassuring message
- Skeleton loading (`loading.tsx`) matching table layout

**Nav sidebar:**
- Safety Alerts moved from `comingSoonItems` to `activeNavItems`
- `comingSoonItems` section removed entirely (no items remain)
- Both Analytics and Safety Alerts now fully active

## Decisions Made

1. **Direct DB in server component:** The alerts page queries MongoDB directly rather than calling `/api/alerts` via fetch. Server-to-server HTTP calls with NextAuth session forwarding are fragile — the API route exists for external use cases.

2. **Analytics already active:** Phase 06-01 had already moved Analytics to `activeNavItems`. Safety Alerts was in `comingSoonItems`. This plan activated Safety Alerts and removed the now-empty `comingSoonItems` array and render section.

3. **Case-sensitive DAN pattern:** The "DAN" jailbreak pattern uses `\bDAN\b` (word boundary, case-sensitive) per spec to avoid false positives from words containing "dan" (e.g., "Daniel", "dance").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] comingSoonItems removal caused TypeScript error with `as const`**
- **Found during:** Task 2 build verification
- **Issue:** `[] as const` produces `never[]` type, causing TypeScript error when `.map()` accesses `item.href`
- **Fix:** Removed the `comingSoonItems` variable entirely and removed the corresponding render section from `SidebarContent`
- **Files modified:** `src/components/dashboard/nav-sidebar.tsx`
- **Commit:** cd89fd5

**2. [Rule 1 - Discovery] Analytics was already in activeNavItems from 06-01**
- **Found during:** Task 2 when reading nav-sidebar.tsx — Analytics was already active, Safety Alerts was in comingSoon
- **Fix:** Added Safety Alerts to `activeNavItems` alongside Analytics (rather than replacing Analytics)
- No extra commit needed — handled in Task 2 commit

## Self-Check

### Files Created/Modified
- [x] `src/lib/safety-patterns.ts` — FOUND
- [x] `src/app/api/alerts/route.ts` — FOUND
- [x] `src/app/(dashboard)/alerts/page.tsx` — FOUND
- [x] `src/app/(dashboard)/alerts/loading.tsx` — FOUND
- [x] `src/components/dashboard/alerts-table.tsx` — FOUND
- [x] `src/components/dashboard/nav-sidebar.tsx` — MODIFIED

### Commits
- [x] 3c7b4e7 — Task 1 commit
- [x] cd89fd5 — Task 2 commit

### Build
- [x] `npm run build` passes with no errors
- [x] `/alerts` route appears in build output

## Self-Check: PASSED
