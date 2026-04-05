---
phase: 13-parent-email-notifications
plan: "01"
subsystem: api
tags: [resend, react-email, email, notifications, safety-alerts, mongodb, deduplication]

# Dependency graph
requires:
  - phase: 12-prompt-editor
    provides: Completed admin dashboard foundation, MongoDB client pattern established
provides:
  - Resend singleton client (lazy, build-safe) in src/lib/resend.ts
  - SafetyAlertEmail React Email template with inline styles
  - WeeklyDigestEmail React Email template with per-child stats
  - POST /api/notify/safety-alert endpoint with auth + dedup
  - Core notify logic in src/lib/notify-safety-alert.ts
  - 1-hour deduplication via email_notifications MongoDB collection
  - Alerts page wired to fire-and-forget email notifications on load
affects:
  - 13-parent-email-notifications (plan 02 weekly digest cron will reuse WeeklyDigestEmail + email-utils)

# Tech tracking
tech-stack:
  added:
    - resend ^4.x (email delivery SDK)
    - "@react-email/components" (React-based email templates)
  patterns:
    - Lazy Proxy singleton for Resend client (defers env var check to call time, safe at build time)
    - Shared lib file for core notification logic (avoids self-referencing fetch from server components)
    - Deduplication via email_notifications collection with compound query on conversationId + matchedPattern + sentAt window
    - Fire-and-forget email notifications on page load (try/catch to protect page rendering)

key-files:
  created:
    - src/lib/resend.ts
    - src/lib/email-utils.ts
    - src/components/emails/safety-alert-email.tsx
    - src/components/emails/weekly-digest-email.tsx
    - src/lib/notify-safety-alert.ts
    - src/app/api/notify/safety-alert/route.ts
    - src/lib/__tests__/email-templates.test.ts
  modified:
    - src/app/(dashboard)/alerts/page.tsx
    - package.json

key-decisions:
  - "Resend client uses lazy Proxy pattern — RESEND_API_KEY check deferred to first call, not import time, so Next.js build succeeds without the env var present"
  - "Core notification logic extracted to src/lib/notify-safety-alert.ts — server components call it directly instead of HTTP fetch to own API routes (anti-pattern)"
  - "email_notifications collection stores dedup records — compound query on meta.conversationId + meta.matchedPattern + sentAt within 1 hour"
  - "notification_prefs.safetyAlerts field absence treated as opt-in (default true) — only explicit false opts out admin from alerts"

patterns-established:
  - "Email templates: React Email components with explicit React import (required for tsx test runner without JSX transform)"
  - "Server component email dispatch: wrapped in try/catch, errors logged but never thrown to client"

requirements-completed:
  - NOTIFY-01

# Metrics
duration: 25min
completed: 2026-04-05
---

# Phase 13 Plan 01: Parent Email Notifications - Safety Alert Pipeline Summary

**Resend + React Email safety alert pipeline: templates, dedup logic, API endpoint, and server-side trigger wired into alerts page**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-05T19:10:32Z
- **Completed:** 2026-04-05T19:35:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Installed Resend and @react-email/components; both email templates (SafetyAlertEmail, WeeklyDigestEmail) pass 11 unit tests
- Built POST /api/notify/safety-alert with session auth, input validation, and 1-hour deduplication
- Wired alerts page to call notifyNewAlerts() server-side on each page load — only truly new alerts trigger emails

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, create Resend client, build both email templates, and add tests** - `f7325a4` (feat)
2. **Task 2: Build safety alert API endpoint with dedup, wire into alerts page** - `f7e2a6f` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 1 followed TDD — tests written first (RED), then implementation (GREEN)_

## Files Created/Modified
- `src/lib/resend.ts` - Lazy Proxy Resend singleton (build-safe, key checked at call time)
- `src/lib/email-utils.ts` - getFromAddress() and getAdminUrl() helpers
- `src/components/emails/safety-alert-email.tsx` - Safety alert React Email template (red heading, inline styles)
- `src/components/emails/weekly-digest-email.tsx` - Weekly digest React Email template (blue heading, per-child stats table)
- `src/lib/notify-safety-alert.ts` - Core notification logic with dedup and batch notifyNewAlerts()
- `src/app/api/notify/safety-alert/route.ts` - POST endpoint: auth, validation, calls core logic
- `src/lib/__tests__/email-templates.test.ts` - 11 unit tests for both email templates (all pass)
- `src/app/(dashboard)/alerts/page.tsx` - Added notifyNewAlerts() call after alert detection
- `package.json` - Added resend + @react-email/components

## Decisions Made
- Resend client uses lazy Proxy pattern: `RESEND_API_KEY` is checked only at call time, not import time, so `next build` succeeds without the env var (Railway provides it at runtime)
- Core notification logic lives in `src/lib/notify-safety-alert.ts` — server components call it directly instead of using internal `fetch()` to own API routes (Next.js anti-pattern)
- `email_notifications` MongoDB collection stores dedup records; 1-hour compound query on `meta.conversationId` + `meta.matchedPattern` prevents duplicate alerts
- `notification_prefs.safetyAlerts` field absence = opt-in by default (explicit `false` required to opt out)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React not in scope for tsx test runner**
- **Found during:** Task 1 (email template tests)
- **Issue:** `tsx --test` does not auto-inject React into JSX scope; templates threw `ReferenceError: React is not defined`
- **Fix:** Added `import React from "react"` to both email template files
- **Files modified:** src/components/emails/safety-alert-email.tsx, src/components/emails/weekly-digest-email.tsx
- **Verification:** All 11 tests pass after fix
- **Committed in:** f7325a4 (Task 1 commit)

**2. [Rule 1 - Bug] Resend singleton threw at import time, breaking Next.js build**
- **Found during:** Task 2 (build verification)
- **Issue:** Initial `src/lib/resend.ts` threw `Missing environment variable "RESEND_API_KEY"` during `Collecting page data` phase of build — RESEND_API_KEY is not available at build time (only at Railway runtime)
- **Fix:** Replaced eager throw with lazy Proxy singleton — error deferred to first `resend.emails.send()` call
- **Files modified:** src/lib/resend.ts
- **Verification:** Build succeeds cleanly without RESEND_API_KEY in environment
- **Committed in:** f7e2a6f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required for correctness. No scope creep.

## Issues Encountered
- Next.js `next build` had transient `.next` cache corruption requiring `rm -rf .next` to resolve a "File not found" TypeScript error for generated types. Resolved by clean rebuild.

## User Setup Required

Before safety alert emails will send, the following Railway environment variables must be added:

| Variable | Source |
|----------|--------|
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `RESEND_FROM_ADDRESS` | Your verified sending domain, e.g. `alerts@notifications.yourdomain.com` |

Domain must be verified in Resend Dashboard → Domains (SPF + DKIM DNS records).

Without these vars, the notification calls fail silently (error caught, page rendering unaffected).

## Next Phase Readiness
- WeeklyDigestEmail template is complete and ready for Plan 02 (weekly digest cron job)
- email_notifications collection structure is established (type, sentAt, to, meta fields)
- getFromAddress() and getAdminUrl() helpers available for both Plan 01 and Plan 02 routes

---
*Phase: 13-parent-email-notifications*
*Completed: 2026-04-05*

## Self-Check: PASSED

All artifacts verified present:
- FOUND: src/lib/resend.ts
- FOUND: src/lib/email-utils.ts
- FOUND: src/components/emails/safety-alert-email.tsx
- FOUND: src/components/emails/weekly-digest-email.tsx
- FOUND: src/lib/notify-safety-alert.ts
- FOUND: src/app/api/notify/safety-alert/route.ts
- FOUND: src/lib/__tests__/email-templates.test.ts
- FOUND: .planning/phases/13-parent-email-notifications/13-01-SUMMARY.md
- FOUND commit: f7325a4
- FOUND commit: f7e2a6f
