---
phase: 13-parent-email-notifications
plan: 03
subsystem: ui
tags: [email, notifications, mongodb, next.js, lucide-react, shadcn]

# Dependency graph
requires:
  - phase: 13-parent-email-notifications plan 01
    provides: email_notifications MongoDB collection, safety alert email delivery
  - phase: 13-parent-email-notifications plan 02
    provides: weekly digest email delivery, notification_prefs field on users
provides:
  - Admin notification history page at /notifications (server component, MongoDB direct query)
  - GET /api/notify/history endpoint returning sent email records
  - Notification preference toggles (Safety Alerts + Weekly Digest) on users page for ADMIN users
  - Bell icon Notifications link in sidebar navigation after Safety Alerts
  - PATCH /api/users/[userId] extended to accept notification_prefs updates
  - NotificationPrefsToggle client component with optimistic UI updates
affects: [future phases using email preferences, users management features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server component direct MongoDB query (no self-fetch anti-pattern)"
    - "Optimistic toggle with revert-on-error pattern in client component"

key-files:
  created:
    - src/app/(dashboard)/notifications/page.tsx
    - src/app/(dashboard)/notifications/loading.tsx
    - src/app/api/notify/history/route.ts
    - src/components/dashboard/notification-prefs-toggle.tsx
  modified:
    - src/components/dashboard/nav-sidebar.tsx
    - src/components/dashboard/users-table.tsx
    - src/app/api/users/[userId]/route.ts
    - src/app/api/users/route.ts
    - src/app/(dashboard)/users/page.tsx

key-decisions:
  - "Notification page uses direct MongoDB query (server component) — consistent with rest of project, avoids self-fetch anti-pattern"
  - "Notification prefs toggle uses native checkbox (no Switch component) — Switch not installed in shadcn ui folder"
  - "notification_prefs defaults: safetyAlerts ?? true, weeklyDigest ?? true — undefined means opted-in per plan 02 semantics"
  - "NotificationPrefsToggle extracted as separate client component — keeps UsersTable server-safe"

patterns-established:
  - "NotificationPrefsToggle: optimistic state update, revert on fetch error with toast.error"
  - "PATCH endpoint: extends validation to allow notification_prefs-only updates without requiring name/role/password"

requirements-completed:
  - NOTIFY-04
  - NOTIFY-05

# Metrics
duration: 13min
completed: 2026-04-05
---

# Phase 13 Plan 03: Notification History UI & Preference Toggles Summary

**Admin notification history table at /notifications plus per-user email preference toggles on the users page, completing the Phase 13 email notification feature set**

## Performance

- **Duration:** ~45 min (including human-verify checkpoint)
- **Started:** 2026-04-05T19:42:35Z
- **Completed:** 2026-04-05
- **Tasks:** 3 of 3 (all complete including human-verify checkpoint)
- **Files modified:** 10

## Accomplishments
- Built server component at /notifications querying email_notifications collection directly, with table showing type badges, recipients, child/subject, date, and Resend ID
- Added Notifications link to sidebar navigation with Bell icon from lucide-react
- Extended PATCH /api/users/[userId] to accept notification_prefs updates; added NotificationPrefsToggle client component to UsersTable for ADMIN rows with optimistic updates
- Loading skeleton created for notifications page matching table layout

## Task Commits

1. **Task 1: Build notification history page and API** - `5315987` (feat)
2. **Task 2: Add notification preference toggles to users page** - `58168ab` (feat)
3. **Task 3: Verify complete email notification system** - checkpoint approved by user (no code commit)
4. **Deviation fix: Exclude /api/notify/* from auth middleware** - `fe0c7b6` (fix)

## Files Created/Modified
- `src/app/(dashboard)/notifications/page.tsx` - Server component: notification history table with type badges, summary counts
- `src/app/(dashboard)/notifications/loading.tsx` - Skeleton loading state with 8 table row placeholders
- `src/app/api/notify/history/route.ts` - GET endpoint for email notification history (limit 100, sorted by sentAt desc)
- `src/components/dashboard/notification-prefs-toggle.tsx` - Client component with optimistic checkbox toggles for safetyAlerts/weeklyDigest
- `src/components/dashboard/nav-sidebar.tsx` - Added Bell icon + Notifications link after Safety Alerts
- `src/components/dashboard/users-table.tsx` - Added Notifications column, NotificationPrefsToggle for ADMIN users
- `src/app/api/users/[userId]/route.ts` - PATCH handler extended to accept notification_prefs field
- `src/app/api/users/route.ts` - Added NotificationPrefs type, notification_prefs to UserSummary interface and GET mapping
- `src/app/(dashboard)/users/page.tsx` - Updated mapping to include notification_prefs field
- `src/middleware.ts` - Excluded /api/notify/* from session auth (cron-secret routes)

## Decisions Made
- Used native `<input type="checkbox">` for notification toggles — Switch component not installed in this project's shadcn setup
- Notifications page uses direct MongoDB query (server component pattern established by alerts page)
- NotificationPrefsToggle is a separate client component file to keep UsersTable boundary clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PATCH validation to allow notification_prefs-only updates**
- **Found during:** Task 2 (PATCH endpoint extension)
- **Issue:** Existing validation `if (!name && !role && !password)` would reject a notification_prefs-only PATCH request with 400 error
- **Fix:** Extended condition to also check `notification_prefs === undefined` so prefs-only updates are accepted
- **Files modified:** src/app/api/users/[userId]/route.ts
- **Verification:** Build passes; logic allows notification_prefs-only payload
- **Committed in:** 58168ab (Task 2 commit)

---

**2. [Rule 2 - Missing Critical] Excluded /api/notify/* from session auth middleware**
- **Found during:** After Task 2 (discovered by orchestrator post-commit)
- **Issue:** /api/notify/weekly-digest and /api/notify/history were caught by NextAuth session middleware and would return 401 to Railway's cron scheduler, which authenticates via `x-cron-secret` header (not session cookies)
- **Fix:** Updated src/middleware.ts matcher to exclude /api/notify/* from session-required routes
- **Files modified:** src/middleware.ts
- **Verification:** Build passed; cron routes now bypass session check and use own auth
- **Committed in:** fe0c7b6

---

**Total deviations:** 2 auto-fixed (1 Rule 1 - Bug, 1 Rule 2 - Missing Critical)
**Impact on plan:** Both fixes essential for correctness and security. No scope creep.

## Issues Encountered
None — build passed cleanly on both auto tasks. Middleware gap caught post-implementation.

## User Setup Required
None - no additional external service configuration required beyond what Plans 01-02 established.

## Next Phase Readiness
- Full Phase 13 email notification system is complete and verified by human review
- Resend dashboard will show sent emails once RESEND_API_KEY is active in Railway
- To test weekly digest manually: `curl -X POST https://kidschat-admin-production.up.railway.app/api/notify/weekly-digest -H "x-cron-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"trigger":"manual"}'`
- No blockers for the next milestone

---
*Phase: 13-parent-email-notifications*
*Completed: 2026-04-05*
