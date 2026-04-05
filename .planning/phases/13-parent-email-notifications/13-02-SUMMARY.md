---
phase: 13-parent-email-notifications
plan: 02
subsystem: api
tags: [mongodb, resend, email, cron, railway, aggregation, typescript]

# Dependency graph
requires:
  - phase: 13-parent-email-notifications
    provides: "resend.ts, email-utils.ts, WeeklyDigestEmail template (Plan 01)"

provides:
  - MongoDB aggregation for per-child weekly stats (getWeeklyChildStats)
  - formatDigestStats pure transform function (testable without DB)
  - POST /api/notify/weekly-digest endpoint with dual auth (session + cron-secret)
  - railway-cron/ Node.js cron service for Railway deployment
  - email_notifications collection records on successful send

affects: [13-parent-email-notifications, railway-cron-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lazy dynamic import for resend module (avoids build-time throw on missing RESEND_API_KEY)
    - TDD with pure transform function extracted from DB aggregation logic
    - Dual auth pattern: session OR x-cron-secret header for cron endpoints

key-files:
  created:
    - src/lib/weekly-digest.ts
    - src/lib/__tests__/weekly-digest.test.ts
    - src/app/api/notify/weekly-digest/route.ts
    - railway-cron/index.mjs
    - railway-cron/package.json
  modified: []

key-decisions:
  - "Lazy import for resend in weekly-digest route — matches notify-safety-alert pattern, prevents build failure when RESEND_API_KEY absent"
  - "formatDigestStats extracted as pure function for testability — aggregation shape tested without live MongoDB"
  - "CRON_SECRET checked before session auth — cron calls have no session cookie"
  - "notification_prefs.weeklyDigest !== false semantics: null/undefined means opted-in (default true)"
  - "topPresets capped at 5 in formatDigestStats, null/empty strings filtered out"

patterns-established:
  - "Lazy dynamic import pattern for modules that throw at module-level (resend.ts)"
  - "Pure transform function extracted from aggregation pipeline for unit testability"
  - "Railway cron script pattern: validate env vars, POST with secret header, exit 0/1 by status"

requirements-completed: [NOTIFY-02, NOTIFY-03]

# Metrics
duration: 22min
completed: 2026-04-05
---

# Phase 13 Plan 02: Weekly Digest Pipeline Summary

**MongoDB aggregation pipeline + dual-auth digest API endpoint + Railway cron script for weekly per-child activity emails**

## Performance

- **Duration:** 22 min
- **Started:** 2026-04-05T19:10:39Z
- **Completed:** 2026-04-05T19:32:39Z
- **Tasks:** 2 (Task 1 had 2 commits: RED + GREEN)
- **Files modified:** 5 created

## Accomplishments

- Per-child 7-day aggregation pipeline: messages, distinct active days, top presets per child (ADMIN users excluded)
- Pure `formatDigestStats()` transform function extracted and tested with 10 unit tests (all passing)
- POST `/api/notify/weekly-digest` endpoint with dual auth: valid session OR `x-cron-secret` header
- Sends `WeeklyDigestEmail` via Resend to opted-in ADMIN users, records in `email_notifications`
- `railway-cron/` service: validates env vars, POSTs with secret, exits cleanly on success/failure

## Task Commits

1. **Task 1 RED: Failing tests for weekly digest aggregation** - `83a74f9` (test)
2. **Task 1 GREEN: Implement weekly digest aggregation logic** - `b8c5ee7` (feat)
3. **Task 2: Weekly digest API endpoint and Railway cron script** - `5d7683d` (feat)

## Files Created/Modified

- `src/lib/weekly-digest.ts` - WeeklyChildStats interface, getWeeklyChildStats MongoDB aggregation, formatDigestStats pure transform
- `src/lib/__tests__/weekly-digest.test.ts` - 10 unit tests: interface shape, transform function, notification record schema
- `src/app/api/notify/weekly-digest/route.ts` - POST endpoint with cron-secret + session auth, Resend send, DB record
- `railway-cron/index.mjs` - Railway cron trigger script (validates env, POSTs to endpoint, clean exit)
- `railway-cron/package.json` - ESM package manifest for Railway cron service

## Decisions Made

- **Lazy import for resend**: `await import("@/lib/resend")` inside POST handler instead of top-level static import. The `resend.ts` module throws at module-level when `RESEND_API_KEY` is absent. Lazy import defers this to runtime, matching the pattern established in `notify-safety-alert.ts`.
- **CRON_SECRET checked first**: Cron calls have no session cookie, so secret check runs before `auth()` — avoids unnecessary DB calls on automated triggers.
- **`notification_prefs?.weeklyDigest !== false`**: Default-opt-in semantics — only explicit `false` disables. Null/undefined means subscribed.
- **topPresets capped at 5**: Null/empty chatGptLabel values filtered; top 5 distinct preset labels taken per child.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy import for resend to prevent build-time throw**
- **Found during:** Task 2 (API endpoint, first build attempt)
- **Issue:** `src/lib/resend.ts` throws at module-level when `RESEND_API_KEY` is missing. Static import caused build to fail with "Missing environment variable RESEND_API_KEY" during page data collection.
- **Fix:** Changed to `const { resend } = await import("@/lib/resend")` inside POST handler, matching the established pattern in `notify-safety-alert.ts`
- **Files modified:** src/app/api/notify/weekly-digest/route.ts
- **Verification:** `npx tsc --noEmit` passes, `Compiled successfully` in next build
- **Committed in:** 5d7683d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Required for build correctness. No scope creep.

## Issues Encountered

- Pre-existing build infrastructure issue in dev environment: `pages-manifest.json` ENOENT after compiled step. This error also occurs on the baseline (pre-plan) codebase and is unrelated to plan changes. TypeScript check (`npx tsc --noEmit`) passes cleanly.

## User Setup Required

**External services require manual configuration.** Per plan frontmatter `user_setup`:

1. **Railway cron service** — Create new Railway service from `railway-cron/` directory:
   - Set root directory to `/railway-cron` in Railway settings
   - Set cron schedule to `0 8 * * 1` (Monday 8am UTC)
   - Set env vars:
     - `CRON_SECRET` — generate with `openssl rand -hex 32`, set on BOTH the cron service AND the admin app
     - `ADMIN_URL` — `https://kidschat-admin-production.up.railway.app` (cron service only)

2. **Admin app** — Add `CRON_SECRET` (same value as cron service)

## Next Phase Readiness

- Weekly digest pipeline complete: aggregation, API endpoint, cron script
- Plan 03 (notification preferences UI) can proceed: `notification_prefs.weeklyDigest` field already consumed by the endpoint
- Plan 01 `WeeklyDigestEmail` template was already created (discovered during execution — Plan 01 had partially completed)

---
*Phase: 13-parent-email-notifications*
*Completed: 2026-04-05*
