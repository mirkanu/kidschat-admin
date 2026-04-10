---
phase: 15-safety-alert-extension-rate-limiting
plan: "03"
subsystem: infra
tags: [mongodb, change-streams, instrumentation, nextjs15, polling, librechat, railway]

# Dependency graph
requires:
  - phase: 15-safety-alert-extension-rate-limiting
    provides: "Plan 15-02 enforcement/bonus/admin UI, plus 15.1-CONTEXT.md gap-closure brief identifying three unverified architecture assumptions"
provides:
  - "Empirically locked architecture for Plan 15-04: instrumentation.ts + 60s setInterval polling"
  - "Confirmed: Railway MongoDB is standalone — change streams NOT supported (error 40573)"
  - "Confirmed: Next.js 15 register() fires at startup in ~850ms — instrumentation.ts viable"
  - "Confirmed: LibreChat native balance display visible to children (Settings page)"
  - "15-03-DECISIONS.md with all fields locked for Plan 15-04 consumption"
affects: [15-04, 15-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Change stream probe: standalone npx tsx script using railway run for env injection"
    - "Instrumentation verification: throwaway src/instrumentation.ts + build + revert pattern"
    - "Architecture decision doc: probe results → locked decisions → plan dependency"

key-files:
  created:
    - scripts/change-stream-probe.ts
    - scripts/verify-instrumentation.ts
    - .planning/phases/15-safety-alert-extension-rate-limiting/15-03-DECISIONS.md
  modified: []

key-decisions:
  - "change_stream: no — Railway MongoDB standalone (not replica set), error 40573 empirically confirmed"
  - "instrumentation_hook: yes — register() fires at Next.js startup in <1s, empirically confirmed"
  - "approach: instrumentation.ts + 60s setInterval polling by messages.createdAt > balance_state.lastSeenAt (no new Railway services, no CRON_SECRET, no HTTP hop)"
  - "reset_crons_mechanism: railway.toml (daily-reset + monthly-reset as separate Railway cron services)"
  - "resumeToken_persistence: none (change streams unavailable; lastSeenAt replaces resumeToken)"
  - "native_balance_display: visible — 'Balance: 10,000,000' shown in LibreChat Settings for children; Plan 15-05 supplements with synthetic threshold messages, not full custom UI"

patterns-established:
  - "Probe-before-implement: write standalone probe scripts, run against production env, lock results in DECISIONS.md before writing implementation code"

requirements-completed: []

# Metrics
duration: multi-session (operator-gated probe execution)
completed: 2026-04-10
---

# Phase 15 Plan 03: Architecture Probe Summary

**Three empirical probes killed the Plan 15-04 unknowns: Railway MongoDB has no change streams (error 40573), Next.js 15 instrumentation.ts fires at startup (~850ms), and LibreChat shows "Balance: 10,000,000" to children natively — locking the architecture as in-process 60s setInterval polling with railway.toml reset crons.**

## Performance

- **Duration:** Multi-session (probes required Railway execution and operator visual verification)
- **Started:** 2026-04-10T18:50:00Z
- **Completed:** 2026-04-10
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments

- Probe Task 1 (change-stream-probe.ts): Empirically confirmed Railway MongoDB does NOT support change streams — standalone instance, not replica set, error code 40573. This closes the highest-risk assumption in Plan 15-04.
- Probe Task 2 (verify-instrumentation.ts): Empirically confirmed Next.js 15 `register()` fires at server startup in ~850ms — instrumentation.ts is viable as the polling loop host, zero additional Railway services needed.
- Human verification Task 3: Operator confirmed LibreChat renders "Balance: 10,000,000" for the Sebastian test child account in the Settings page. Native balance display works; Plan 15-05 supplements rather than replaces it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Change-stream probe** - `324897e` (feat) — FAILED as expected (error 40573, confirms no replica set)
2. **Task 2: Instrumentation.ts probe** - `80d9086` (feat) — FIRED (register() confirmed at startup)
3. **Task 3: LibreChat balance UI verification + decisions lock** - (this commit) (docs)

## Files Created/Modified

- `scripts/change-stream-probe.ts` — Standalone one-shot script that opens a watch cursor on the messages collection; ran via `railway run npx tsx`; proved change streams unsupported
- `scripts/verify-instrumentation.ts` — Manual checklist + throwaway instrumentation.ts content for operator to temporarily add, build, observe, and revert
- `.planning/phases/15-safety-alert-extension-rate-limiting/15-03-DECISIONS.md` — All three probe outcomes recorded; `Locked Decisions for Plan 15-04` section fully populated and approved

## Decisions Made

**change_stream: no** — Railway's managed MongoDB is a standalone instance (not a replica set). `$changeStream` requires replica set mode; Railway does not provide this without a custom cluster. Error code 40573 is definitive.

**instrumentation_hook: yes** — Next.js 15 ships instrumentation.ts enabled by default (the `experimental.instrumentationHook` flag was removed in v15; it was only needed in v14). `register()` fired in the `nodejs` runtime at startup before the "Ready" message — confirmed via throwaway `src/instrumentation.ts` with a timestamped `console.log`.

**approach: instrumentation.ts + 60s setInterval** — The combination of `change_stream=no` and `instrumentation_hook=yes` maps directly to: run a polling loop inside `register()` using `setInterval(60_000)`, querying `messages` collection for documents where `createdAt > balance_state.lastSeenAt`. This supersedes the original Path B (`/api/cron/tick` HTTP endpoint) — the in-process approach is simpler: no CRON_SECRET required, no HTTP hop, no additional Railway service for the tick loop.

**reset_crons_mechanism: railway.toml** — Daily and monthly balance resets ship as Railway cron services defined in `railway.toml`, consistent with the Automate Railway user preference (config-as-code).

**resumeToken_persistence: none** — Change streams unavailable; `balance_state.lastSeenAt` (createdAt of last processed message) replaces the resumeToken pattern.

**native_balance_display: visible** — LibreChat renders the raw token credit balance in Settings for children. Plan 15-05 should add synthetic threshold messages (e.g., at 70% daily usage) for proactive human-readable alerts rather than building a custom balance UI from scratch.

## Deviations from Plan

None - plan executed exactly as written. Both probe scripts were created and run against Railway; outcomes were recorded as the plan specified. The LibreChat balance check was performed by the operator and reported at the checkpoint. The human-verify checkpoint fired and paused execution as designed.

## Issues Encountered

- Task 1 commit is labeled `FAILED` in the completed_tasks table — this is expected behavior, not a failure. The probe script ran correctly and returned error 40573, which is the correct outcome (proves the negative assumption). The commit message reflects this: the probe ran, the result is recorded, the assumption is killed.
- Original Path B (`/api/cron/tick` HTTP endpoint with CRON_SECRET) described in 15.1-CONTEXT.md has been superseded by the in-process setInterval approach. Plan 15-04 should not implement the HTTP endpoint — the simpler in-process path is locked.

## User Setup Required

None - no external service configuration required for this plan. (Plan 15-04 will require `src/instrumentation.ts` to be committed; Plan 15-04/15-05 will require `railway.toml` cron entries.)

## Next Phase Readiness

**Plan 15-04 is unblocked.** All three architecture assumptions are now empirically resolved:
- Implement `src/instrumentation.ts` with `register()` containing a 60s setInterval
- Polling loop: `db.collection('messages').find({ createdAt: { $gt: balance_state.lastSeenAt } })`
- On each message found: debit `balances.tokenCredits`, update `balance_state.lastSeenAt`, check thresholds
- Add `daily-reset` and `monthly-reset` cron services to `railway.toml`

**Plan 15-05** can leverage LibreChat's native balance display (visible to children in Settings) and focus on synthetic threshold messages rather than building a custom balance UI.

---
*Phase: 15-safety-alert-extension-rate-limiting*
*Completed: 2026-04-10*
