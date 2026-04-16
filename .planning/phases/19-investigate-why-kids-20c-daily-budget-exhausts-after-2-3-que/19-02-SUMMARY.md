---
phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que
plan: 02
subsystem: database
tags: [mongodb, budget, cost-cap, tokenCredits, cost-estimates]

# Dependency graph
requires:
  - phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que
    provides: Research (19-RESEARCH.md) establishing correct credit math, realistic daily cap, and actual SYSTEM_PROMPT_TOKENS baseline

provides:
  - budget.ts HARDCODED_DEFAULTS.dailyCostCapEur raised to 0.50 with accurate dollar-denominated credit-math JSDoc
  - settings.ts ensureDefaultSettings seeds 0.50 for fresh installs
  - cost-estimates.ts SYSTEM_PROMPT_TOKENS corrected from 400 to 3290
  - MongoDB settings.global_defaults.dailyCostCapEur updated to 0.50 in live DB
  - 19-02-MONGO-EVIDENCE.md with before/after snapshots and live getEffectiveBudget checks

affects:
  - daily-reset cron (topUpDailyBudget reads dailyCostCapEur from getEffectiveBudget — will now top up to 543,478 credits per child)
  - admin dashboard cost estimates (SYSTEM_PROMPT_TOKENS now 3290 → per-message cost ~8x more realistic)
  - 19-03-PLAN.md (cron health check plan)
  - 19-04-PLAN.md (DALL-E tool separation plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dollar-denominated credit model: 1 credit = $0.000001 USD; output tokens cost 5 credits each (rate=5)"
    - "Capacity sanity baseline: 0.50 EUR buys ~55-83 text turns or ~33 drawing turns"

key-files:
  created:
    - .planning/phases/19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que/19-02-MONGO-EVIDENCE.md
  modified:
    - src/lib/budget.ts
    - src/lib/settings.ts
    - src/lib/cost-estimates.ts

key-decisions:
  - "dailyCostCapEur default raised from 0.10 (code) / 0.20 (DB) to 0.50 — research Area 7 shows 0.50 EUR is the realistic minimum for mixed text+drawing usage"
  - "SYSTEM_PROMPT_TOKENS set to 3290 (not branched per endpoint) — correct baseline for current all-presets-have-DALL-E state; comment notes to lower to 710 after Plan 19-01 removes DALL-E from text presets"
  - "getEffectiveBudget precedence chain (child_override > global_defaults > HARDCODED_DEFAULTS) preserved byte-identical — no logic changes"
  - "monthlyCostCapEur left at 2.00 throughout — out of scope for this plan"

patterns-established:
  - "Evidence files (19-02-MONGO-EVIDENCE.md) capture before/after MongoDB state for any live-DB update tasks"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-04-16
---

# Phase 19 Plan 02: Budget Cap Fix Summary

**Raised daily cap to 0.50 EUR in code + live MongoDB, corrected credit-math JSDoc, and fixed SYSTEM_PROMPT_TOKENS from 400 to 3290 so admin cost estimates reflect actual 8x-higher agent overhead**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-16T00:00:00Z
- **Completed:** 2026-04-16
- **Tasks:** 3 auto tasks (Task 4 is checkpoint — awaiting human verification)
- **Files modified:** 4 (3 source files + 1 evidence file)

## Accomplishments

- Rewrote budget.ts top JSDoc to accurately document the dollar-denominated credit model: 1 credit = $0.000001 USD, output tokens cost 5 credits each (rate=5), and added capacity sanity figures from Phase 19 research
- Raised `HARDCODED_DEFAULTS.dailyCostCapEur` from 0.10 → 0.50 in budget.ts and `ensureDefaultSettings` seed from 0.10 → 0.50 in settings.ts
- Fixed `SYSTEM_PROMPT_TOKENS` from 400 → 3290 in cost-estimates.ts with a note to lower to 710 after Plan 19-01 removes DALL-E from text presets
- Updated live MongoDB `settings.global_defaults.dailyCostCapEur` from 0.20 → 0.50 (was previously manually raised by admin from code default 0.10 — now code and DB are in sync)
- Verified `getEffectiveBudget` returns 0.50 for both Sebastian and Penelope (no per-child overrides exist)

## Task Commits

Each task was committed atomically:

1. **Task 1: budget.ts JSDoc + HARDCODED_DEFAULTS + settings.ts seed** — `cc50e1e` (fix)
2. **Task 2: SYSTEM_PROMPT_TOKENS 400 → 3290** — `70c7476` (fix)
3. **Task 3: MongoDB global_defaults update + evidence file** — `a489dd9` (fix)

## Files Created/Modified

- `src/lib/budget.ts` — Replaced misleading JSDoc with accurate dollar-denominated credit model; bumped HARDCODED_DEFAULTS.dailyCostCapEur 0.10 → 0.50
- `src/lib/settings.ts` — Bumped ensureDefaultSettings seed value 0.10 → 0.50
- `src/lib/cost-estimates.ts` — SYSTEM_PROMPT_TOKENS 400 → 3290 with Phase 19 audit comment
- `.planning/phases/19-.../19-02-MONGO-EVIDENCE.md` — Before/after MongoDB snapshots, no-override confirmation, live getEffectiveBudget outputs for both children

## Decisions Made

- `SYSTEM_PROMPT_TOKENS` set to single value 3290, not branched per endpoint — correct for current state where all 4 presets carry DALL-E tool schema; comment documents the follow-up to lower to 710 after Plan 19-01
- MongoDB update used `updateOne({$set: ...})` not upsert — matchedCount=1 confirmed doc existed; stopping on matchedCount=0 as specified in plan
- Throwaway script `scripts/19-02-check-effective-budget.ts` deleted after evidence captured

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript errors in `tests/lib/budget.test.ts` were verified to be pre-existing (confirmed via git stash) and are out of scope per scope boundary rules.

## Issues Encountered

- Top-level `await` in initial throwaway script failed with CJS output format error — wrapped in `async function main()` pattern, standard fix.

## User Setup Required

None — no external service configuration required. MongoDB update was applied directly via the Railway switchyard proxy.

## Next Phase Readiness

- Task 4 (human verification checkpoint) is next — parent should verify:
  1. Admin dashboard shows 0.50 EUR cap for Sebastian
  2. Cost estimates on analytics page look more realistic (per-message ~8x higher than before)
  3. Daily-reset cron (Plan 19-03 subject) will top up to ~543,478 credits on next run
  4. If a child override is set, it wins over the 0.50 global default

---
*Phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que*
*Completed: 2026-04-16*
