---
phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que
plan: 03
subsystem: infra
tags: [railway, mongodb, cron, budget, observability]

requires:
  - phase: 19-research
    provides: "Evidence that lastDailyReset = 2026-04-11 for both children (5 days stale)"

provides:
  - "Root cause of cron staleness documented with evidence (19-03-CRON-DIAGNOSIS.md)"
  - "Penelope's tokenCredits restored to dailyCostCapEur (217391 then 543478)"
  - "3 dedicated Railway cron services created: daily-reset-cron, monthly-reset-cron, daily-notifications-cron"
  - "Observability: cron_state.daily_reset.lastRunAt written on every invocation"

affects:
  - future-cron-failures
  - admin-dashboard-observability
  - kidschat-admin-deployments

tech-stack:
  added: [curlimages/curl Docker image for Railway cron services]
  patterns:
    - "Railway cron services via GraphQL API: create service + serviceInstanceUpdate(cronSchedule, startCommand, source.image) + serviceInstanceDeployV2"
    - "Observability via cron_state collection upsert: {key: 'daily_reset', lastRunAt, lastRunStats}"

key-files:
  created:
    - .planning/phases/19-.../19-03-CRON-DIAGNOSIS.md
    - .planning/phases/19-.../19-03-RESTORE-EVIDENCE.md
    - .planning/phases/19-.../19-03-FIX-APPLIED.md
    - .planning/phases/19-.../19-03-OBSERVABILITY-EVIDENCE.md
  modified:
    - src/app/api/cron/daily-reset/route.ts

key-decisions:
  - "railway.toml [[deploy.crons]] silently ignored when Dockerfile builder is used — switched to Railway GraphQL API to create dedicated cron services"
  - "3 separate Railway cron services created (daily-reset-cron, monthly-reset-cron, daily-notifications-cron) using curlimages/curl image + serviceInstanceUpdate(cronSchedule)"
  - "cron_state.daily_reset.lastRunAt uses separate key field (not _id) for new observability entry, consistent with future pattern"
  - "Observability write is non-fatal (try/catch) — cron cannot be broken by MongoDB observability failure"

patterns-established:
  - "Railway cron creation: serviceCreate -> serviceInstanceUpdate(cronSchedule + startCommand + source.image) -> variableUpsert(CRON_SECRET) -> serviceInstanceDeployV2"
  - "Silent cron failures detectable via cron_state.daily_reset.lastRunAt freshness check"

requirements-completed: []

duration: 95min
completed: 2026-04-16
---

# Phase 19 Plan 03: Cron Diagnosis, Balance Restore, and Observability Summary

**Railway daily-reset cron pipeline restored via 3 dedicated cron services; Penelope unblocked (tokenCredits 0 → 543478); cron_state observability added to detect future silent failures**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-04-16T21:00:00Z
- **Completed:** 2026-04-16T22:10:00Z
- **Tasks:** 3 auto-tasks complete (Task 4 is checkpoint — awaiting human UAT)
- **Files modified:** 1 source file + 4 evidence/documentation files

## Accomplishments

- Identified root cause: `[[deploy.crons]]` in railway.toml silently ignored when Dockerfile builder is active — crons were NEVER registered on Railway after April 12 redeployment
- Restored both children's tokenCredits via manual POST to `/api/cron/daily-reset`; Penelope unblocked from LibreChat "Insufficient Funds" hard stop
- Created 3 dedicated Railway cron services (daily-reset-cron, monthly-reset-cron, daily-notifications-cron) via GraphQL API with `nextCronRunAt` verified
- Added `cron_state.daily_reset.lastRunAt` observability write on every cron invocation; verified working post-deploy

## Task Commits

1. **Task 1: Diagnose** - `0898a64` (docs)
2. **Task 2: Restore + Fix** - `b131d10` (fix)
3. **Task 3: Observability** - `0638e43` (feat)

## Files Created/Modified

- `src/app/api/cron/daily-reset/route.ts` — Added Phase 19 observability block: writes `cron_state.daily_reset.lastRunAt` on every invocation
- `.planning/.../19-03-CRON-DIAGNOSIS.md` — Root cause analysis with log evidence, MongoDB state, manual trigger result, and verdict
- `.planning/.../19-03-RESTORE-EVIDENCE.md` — Before/after MongoDB snapshots for Penelope's balance restoration
- `.planning/.../19-03-FIX-APPLIED.md` — Fix applied: `railway up` (ineffective) + Railway GraphQL API cron service creation (effective)
- `.planning/.../19-03-OBSERVABILITY-EVIDENCE.md` — Post-deploy verification of cron_state.daily_reset write

## Decisions Made

- **railway.toml `[[deploy.crons]]` is dead config with Dockerfile builder.** Decision: created 3 independent Railway services (one per cron) via GraphQL API instead of fighting the toml parser. These services persist across kidschat-admin redeployments.
- **Used `curlimages/curl:latest` as Docker image** for the cron services — minimal image with curl, no need for a full Node runtime just to run a curl command.
- **Observability uses `key: "daily_reset"` field** (not `_id`) for the cron_state document, matching the spirit of the existing `poll_listener` entry but with a separate `key` field for future extensibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `railway up` did not register `[[deploy.crons]]` — switched to Railway GraphQL API**
- **Found during:** Task 2 (applying recommended fix)
- **Issue:** The plan's recommended fix "redeploy via `railway up`" was attempted and completed successfully but `nextCronRunAt` remained null. Investigation revealed Railway silently ignores `[[deploy.crons]]` when the service uses Dockerfile builder (confirmed from `fileServiceManifest.deploy: {}`).
- **Fix:** Created 3 dedicated Railway cron services via `serviceCreate + serviceInstanceUpdate(cronSchedule + startCommand + source.image) + variableUpsert(CRON_SECRET) + serviceInstanceDeployV2` for each of daily-reset, monthly-reset, and daily-notifications.
- **Files modified:** No source files — infrastructure change via Railway GraphQL API only
- **Verification:** `nextCronRunAt` confirmed for all 3 services via GraphQL query

**2. [Rule 3 - Blocking] Initial observability deployment used worktree not main project**
- **Found during:** Task 3 (post-deploy verification)
- **Issue:** `railway up` is run from `/data/home/KidAI` (main project directory) but the worktree edit was at `/data/home/KidAI/.claude/worktrees/agent-af076b49/`. The first two deployments uploaded the unmodified main project file.
- **Fix:** Copied the modified `route.ts` from worktree to main project, then redeployed. Verified via Railway SSH that the minified bundle contains the observability code.
- **Files modified:** `src/app/api/cron/daily-reset/route.ts` (in both worktree and main project)
- **Verification:** `cron_state.daily_reset.lastRunAt` updated to `2026-04-16T21:58:46Z` after post-fix trigger

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues during execution)
**Impact on plan:** The architectural deviation (Rule 3 #1) resulted in a BETTER fix — dedicated cron services persist independently of kidschat-admin deployments, eliminating the "redeployment silently kills crons" failure mode. Scope: additive (2 extra Railway services created for monthly-reset and daily-notifications).

## Issues Encountered

- Railway CLI `logs` command returns only the last ~7 lines, insufficient for historical investigation. Used Railway GraphQL API deployment metadata + MongoDB evidence instead.
- Railway `[[deploy.crons]]` config-as-code does NOT work with Dockerfile builder. The `propertyFileMapping` in deployment metadata shows Railway reads the key but `fileServiceManifest.deploy: {}` confirms nothing is applied.
- `railway up` uploads from the current working directory, not the worktree. This caused two wasted deployments before the observability code was correctly deployed.

## User Setup Required

None — all Railway services created and configured automatically via GraphQL API.

## Railway Cron Services Created (new)

| Service | ID | Schedule | Command |
|---------|-----|----------|---------|
| daily-reset-cron | 2d6a65f1-7761-48d3-8bb4-ed4e6e866b79 | `0 0 * * *` | POST /api/cron/daily-reset |
| monthly-reset-cron | 815169c6-8ac0-4a99-af50-c8969a47d99b | `0 0 1 * *` | POST /api/cron/monthly-reset |
| daily-notifications-cron | 7f05c92e-a7a0-4a2b-8a9a-3767a2d27ffc | `0 8 * * *` | POST /api/notify/daily-summary + weekly-digest |

All 3 services have `CRON_SECRET` variable set and `nextCronRunAt` confirmed.

## Next Phase Readiness

- Task 4 (checkpoint) awaiting parent UAT verification
- After UAT approval: overnight check needed to confirm `daily-reset-cron` fires at midnight UTC 2026-04-17T00:00:00Z
- Future follow-up: add admin dashboard widget showing `cron_state.daily_reset.lastRunAt` freshness

---
*Phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que*
*Completed: 2026-04-16*
