---
phase: 18-email-alert-system
plan: 01
subsystem: database, api
tags: [mongodb, notification-recipients, email, crud]

requires:
  - phase: 13-parent-email-notifications
    provides: safety alert and weekly digest email senders, Resend integration
provides:
  - notification_recipients MongoDB collection with CRUD lib
  - REST API for managing notification recipients (GET/POST/DELETE/PATCH)
  - getRecipientsForType() used by safety-alert and weekly-digest senders
  - ensureDefaultRecipients() seeds from ADMIN users on first run
affects: [18-02, 18-03, settings-ui, email-notifications]

tech-stack:
  added: []
  patterns: [notification-recipients decoupled from user accounts, ADMIN-user fallback for backward compat]

key-files:
  created:
    - src/lib/notification-recipients.ts
    - src/app/api/notification-recipients/route.ts
  modified:
    - src/lib/notify-safety-alert.ts
    - src/app/api/notify/weekly-digest/route.ts

key-decisions:
  - "notification_recipients collection decoupled from users — both parents receive alerts without admin accounts"
  - "ADMIN-user fallback in both senders ensures backward compat until recipients are configured"
  - "Email stored lowercase for dedup; accountActivity defaults false while others default true"

patterns-established:
  - "getRecipientsForType pattern: query recipients collection first, fall back to ADMIN users if empty"
  - "Lazy import for notification-recipients in email senders (same pattern as resend imports)"

requirements-completed: [EMAIL-RECIPIENTS-01, EMAIL-MIGRATE-01]

duration: 6min
completed: 2026-04-12
---

# Phase 18 Plan 01: Notification Recipients Summary

**Notification recipients collection with CRUD API decoupling email alerts from ADMIN user accounts, with backward-compatible migration of safety-alert and weekly-digest senders**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-12T19:00:05Z
- **Completed:** 2026-04-12T19:06:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created notification_recipients collection with full CRUD operations (get, add, remove, update alerts)
- REST API with session auth for managing recipients (GET/POST/DELETE/PATCH)
- Migrated safety-alert and weekly-digest senders to use recipients collection first, with ADMIN-user fallback
- ensureDefaultRecipients() seeds collection from existing ADMIN users on first run

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notification_recipients data model and API** - `81f1512` (feat)
2. **Task 2: Migrate safety-alert and weekly-digest senders to use recipients** - `1faaee9` (feat)

## Files Created/Modified
- `src/lib/notification-recipients.ts` - CRUD operations for notification_recipients collection (getRecipients, addRecipient, removeRecipient, updateRecipientAlerts, getRecipientsForType, ensureDefaultRecipients)
- `src/app/api/notification-recipients/route.ts` - REST API with GET/POST/DELETE/PATCH endpoints, session auth
- `src/lib/notify-safety-alert.ts` - Updated to query getRecipientsForType('safetyAlerts') first, ADMIN fallback
- `src/app/api/notify/weekly-digest/route.ts` - Updated to query getRecipientsForType('weeklyDigest') first, ADMIN fallback

## Decisions Made
- notification_recipients collection is fully decoupled from user accounts — both parents can receive alerts without needing admin logins
- ADMIN-user fallback ensures zero-downtime migration: existing behavior preserved until recipients are explicitly configured
- Email addresses stored lowercase for consistent dedup
- accountActivity alert defaults to false (future use in Plan 03), all others default true

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- notification_recipients collection ready for Plan 02 (settings UI for managing recipients)
- getRecipientsForType pattern established for Plan 03 (daily summary, account activity alerts)
- No blockers

---
*Phase: 18-email-alert-system*
*Completed: 2026-04-12*
