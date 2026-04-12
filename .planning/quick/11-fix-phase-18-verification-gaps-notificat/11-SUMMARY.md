---
phase: quick-11
plan: 01
subsystem: notifications
tags: [email, badges, account-activity, notifications]
dependency_graph:
  requires: [phase-18]
  provides: [notification-badge-rendering, account-activity-wiring]
  affects: [notifications-page, auth-flow, recipient-management]
tech_stack:
  patterns: [fire-and-forget-notifications, dynamic-import-lazy-load]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/notifications/page.tsx
    - src/auth.ts
    - src/app/api/notification-recipients/route.ts
decisions:
  - "Multi-branch conditional rendering (not helper function) for badge types — simpler, co-located with JSX"
  - "Dynamic import() for notifyAccountActivity in all call sites — consistent with existing lazy-load pattern in account-activity.ts"
metrics:
  duration_minutes: 6
  completed: "2026-04-12"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Quick Task 11: Fix Phase 18 Verification Gaps — Notification Badges + Activity Wiring

Notification history page now renders all 4 email types with distinct colored badges; account activity notifications fire automatically on admin login and recipient add/remove.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add daily_summary and account_activity badges | 6ff5db5 | Expanded type union, added green/amber badges, updated summary counts and table rendering |
| 2 | Wire notifyAccountActivity into auth + recipients | a587b32 | signIn event in auth.ts, fire-and-forget calls in POST/DELETE handlers |
| 3 | Build verification and deploy | — | npm run build passes, deployed to Railway |

## What Changed

### Notification History Page (notifications/page.tsx)
- **Type union** expanded from 2 to 4 types: `safety_alert | weekly_digest | daily_summary | account_activity`
- **Summary badges** section shows counts for all 4 types with color-coded badges (red, blue, green, amber)
- **Table badge rendering** uses multi-branch conditionals instead of binary ternary
- **Child/Subject column** shows contextual info per type: child name (safety), week (digest), date (summary), activity type (account)

### Auth Login Event (auth.ts)
- Added `events.signIn` handler that calls `notifyAccountActivity({ activityType: "login" })` via dynamic import
- Fire-and-forget with `.catch()` — login flow never blocked by notification failure

### Recipient Mutations (notification-recipients/route.ts)
- POST handler fires `notifyAccountActivity({ activityType: "recipient_added" })` after successful add
- DELETE handler fires `notifyAccountActivity({ activityType: "recipient_removed" })` after successful remove
- Both use dynamic import + `.catch()` pattern — primary API responses unaffected

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript: no new errors from modified files (pre-existing node_modules type noise only)
- Build: `npm run build` completes successfully
- Badge colors: red (safety_alert), blue (weekly_digest), green (daily_summary), amber (account_activity)
- All `notifyAccountActivity` calls are fire-and-forget with `.catch()`
- Deployed to Railway

## Self-Check: PASSED
