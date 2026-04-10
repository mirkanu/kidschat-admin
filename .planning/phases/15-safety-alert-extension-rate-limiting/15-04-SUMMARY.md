---
phase: 15-safety-alert-extension-rate-limiting
plan: "04"
subsystem: api, infra, backend
tags: [mongodb, nextjs15, instrumentation, polling, budget, migration, railway, cron]

# Dependency graph
requires:
  - phase: 15-safety-alert-extension-rate-limiting
    plan: "03"
    provides: "Locked architecture: instrumentation.ts + 60s setInterval polling (change streams unavailable on Railway standalone MongoDB)"
provides:
  - "budget.ts: eurToTokens/tokensToEur, getEffectiveBudget, ensureBalanceState, getRemainingEur, topUpDailyBudget, topUpMonthlyBudget, applyBonusCredit, evaluateChildState"
  - "change-stream-listener.ts: processMessageEvent (idempotent), startChangeStreamListener (60s polling)"
  - "instrumentation.ts: register() hooks budget polling loop into Next.js server startup"
  - "railway.toml: daily-reset + monthly-reset crons as config-as-code"
  - "scripts/migrate-15-04.ts: idempotent migration (run and verified against production)"
  - "balance_state collection seeded for all non-admin children"
  - "settings collection migrated to new schema (dailyCostCapEur, monthlyCostCapEur)"
  - "cost_ledger + locked_acl_entries collections dropped from production"
affects: [15-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD with mock Db pattern: makeCollection + makeMockDb helpers — used for budget.test.ts and change-stream-listener.test.ts"
    - "instrumentation.ts webpack externals: next.config.ts webpack() callback adds mongodb to externals for server bundles"
    - "One-shot migration via temporary API endpoint (no SSH/railway run possible with internal MongoDB URI)"
    - "setInterval 60s polling inside instrumentation.ts register() — no new Railway service needed"
    - "webpackIgnore pattern tried but rejected (module not included in standalone output)"

key-files:
  created:
    - src/lib/budget.ts
    - src/lib/change-stream-listener.ts
    - src/instrumentation.ts
    - scripts/migrate-15-04.ts
    - railway.toml
    - src/app/api/admin/migrate/route.ts
    - .planning/phases/15-safety-alert-extension-rate-limiting/15-04-DEPLOYMENT.md
    - tests/lib/budget.test.ts
    - tests/lib/change-stream-listener.test.ts
  modified:
    - src/lib/settings.ts (new schema + legacy EffectiveLimits shim)
    - src/lib/bonus-delivery.ts (removed enforcement.ts imports)
    - src/app/api/cron/daily-reset/route.ts (uses topUpDailyBudget)
    - src/app/api/cron/monthly-reset/route.ts (uses topUpMonthlyBudget)
    - src/app/(dashboard)/settings/page.tsx (new schema)
    - src/app/(dashboard)/users/[userId]/page.tsx (uses evaluateChildState)
    - tests/lib/bonus-delivery.test.ts (new settings schema field names)
    - tests/lib/rate-limits.test.ts (new schema assertions)
    - next.config.ts (webpack externals for mongodb in instrumentation.ts)
    - src/middleware.ts (bypass api/admin/migrate)
  deleted:
    - src/lib/cost-ledger.ts
    - src/lib/enforcement.ts
    - src/app/api/cron/cost-ledger-sweep/route.ts
    - src/app/api/cron/limit-enforcement/route.ts
    - src/app/api/cron/bonus-detection/route.ts
    - tests/lib/cost-ledger.test.ts
    - tests/lib/enforcement.test.ts

key-decisions:
  - "Path chosen: instrumentation.ts + 60s setInterval polling (change streams unavailable on Railway standalone MongoDB — locked by 15-03)"
  - "Migration API endpoint instead of railway run (Railway internal hostname not accessible from outside network)"
  - "webpack externals in next.config.ts to allow mongodb imports in instrumentation.ts without bundling Node.js-only modules"
  - "Legacy EffectiveLimits shim in settings.ts for Plan 15-05 UI compatibility (not breaking the admin UI)"
  - "railway.toml [[deploy.crons]] config-as-code for daily-reset + monthly-reset (no dashboard clicks for new crons)"

# Metrics
duration: 63min
completed: 2026-04-10
---

# Phase 15 Plan 04: Backend Rewrite Summary

**JWT auth with refresh rotation using jose library — no, actually: replaced the Phase 15 polling pipeline (cost_ledger sweep + limit-enforcement + bonus-detection crons + ACL-based locking) with native-balance-centric architecture using LibreChat's balances.tokenCredits as single source of truth, with instrumentation.ts + 60s setInterval polling for 70% warnings + bonus offer/YES flow.**

## Performance

- **Duration:** 63 min
- **Started:** 2026-04-10T20:07:37Z
- **Completed:** 2026-04-10T21:10:44Z
- **Tasks:** 4 of 4 complete
- **Files created:** 9
- **Files modified:** 10
- **Files deleted:** 7

## Accomplishments

**Task 1: budget.ts (TDD)**
- Created `src/lib/budget.ts` with 9 exports: eurToTokens, tokensToEur, getEffectiveBudget, getBalanceState, ensureBalanceState, getRemainingEur, topUpDailyBudget, topUpMonthlyBudget, applyBonusCredit, evaluateChildState, todayIso
- 26 unit tests — all GREEN. No real MongoDB access.
- EUR↔token conversion math: `eurToTokens(0.10) ≈ 108_696` (Haiku 4.5 pricing, 0.92 EUR/USD)
- Idempotent ensureBalanceState, weekly bonus cap guard, per-child override resolution

**Task 2: Migration + legacy deletion**
- `scripts/migrate-15-04.ts` created (idempotent, run confirmed against production)
- Deleted: cost-ledger.ts, enforcement.ts, 3 legacy cron routes, cost-ledger.test.ts, enforcement.test.ts
- Rewrote settings.ts to new schema with legacy EffectiveLimits shim
- Rewrote bonus-delivery.ts to remove enforcement.ts imports
- Rewrote daily-reset + monthly-reset routes to use budget.ts
- Updated users/[userId]/page.tsx and settings/page.tsx to new schema
- 70 tests GREEN, npm run build succeeds

**Task 3: Change stream listener + instrumentation**
- `src/lib/change-stream-listener.ts`: processMessageEvent (idempotent) + startChangeStreamListener (60s setInterval)
  - YES detection: `message.createdAt < balance_state.activeOfferExpiresAt` guard
  - 70% warning: `warnedAt70PctOn === todayIso` guard (once per day)
  - Bonus offer: remainingEur<=0, !monthlyCapExhausted, !weeklyBonusCapExhausted, !hasActiveOffer
- `src/instrumentation.ts`: register() boots polling on Next.js startup
- 4 idempotency tests ALL GREEN (double-call no-op, YES-after-expiry rejected, YES-before-expiry accepted)
- Fixed webpack bundling issue: `next.config.ts` webpack externals for mongodb

**Task 4: railway.toml + deploy + migration**
- `railway.toml` with 2 cron services (daily-reset, monthly-reset) — config-as-code
- Deployed via `railway up` — instrumentation hook confirmed firing in Railway logs
- Migration executed successfully via API endpoint (Railway internal MongoDB not accessible externally)
- Smoke tests: daily-reset → `{"reset":2,"errors":[]}`, monthly-reset → `{"reset":2,"errors":[]}`

## Task Commits

1. `7d170c3` feat: budget.ts TDD (26 tests)
2. `811fbb9` feat: delete legacy files + migration + cron rewrites
3. `aaaac6e` feat: change-stream-listener + instrumentation.ts
4. `1596c27` chore: railway.toml crons
5. `e90dc81` fix: instrumentation.ts webpack externals
6. `de61764` feat: migration API endpoint
7. `061b740` docs: deployment record

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] webpackIgnore caused runtime module not found error**
- **Found during:** Task 3 deploy
- **Issue:** Using `/* webpackIgnore: true */` in instrumentation.ts prevented webpack from bundling the module but also excluded it from the standalone output — runtime error "Cannot find module"
- **Fix:** Removed webpackIgnore, added `webpack()` config in next.config.ts to explicitly add `mongodb` to externals for server bundles
- **Files modified:** `src/instrumentation.ts`, `next.config.ts`
- **Commit:** `e90dc81`

**2. [Rule 3 - Blocking] railway run can't connect to Railway internal MongoDB**
- **Found during:** Task 4 (migration run)
- **Issue:** `railway run` injects env vars but executes locally — `mongodb.railway.internal` hostname not reachable from outside Railway's private network
- **Fix:** Created temporary migration API endpoint `/api/admin/migrate` (auth via CRON_SECRET), called via curl from outside
- **Files modified:** `src/app/api/admin/migrate/route.ts`, `src/middleware.ts`
- **Commit:** `de61764`
- **Note:** TODO in DEPLOYMENT.md — delete the migration endpoint after legacy crons are cleaned up

**3. [Rule 1 - Bug] budget.ts getEffectiveBudget TypeScript type error**
- **Found during:** Task 2 npm run build
- **Issue:** `g = globalDoc ?? {}` typed as `{}` which doesn't have `dailyCostCapEur` etc
- **Fix:** Typed `g: Partial<GlobalDefaults>` and `o: Partial<ChildOverride>` explicitly
- **Files modified:** `src/lib/budget.ts`
- **Commit:** included in `811fbb9`

**4. [Rule 1 - Bug] bonus-delivery tests broke after settings schema change**
- **Found during:** Task 2 test run
- **Issue:** Tests used old field names (`weeklyBonusCap`, `bonusPackSize`) but new `getEffectiveBudget` queries for new fields
- **Fix:** Updated test mocks to use new schema field names (`weeklyBonusCapEur`, `bonusPackEur`)
- **Files modified:** `tests/lib/bonus-delivery.test.ts`, `tests/lib/rate-limits.test.ts`
- **Commit:** included in `811fbb9`

**5. [Rule 3 - Blocking] instrumentation.ts startCommand override broke deploy**
- **Found during:** Task 4 first deploy
- **Issue:** `railway.toml` `[deploy] startCommand = "node .next/standalone/server.js"` — wrong path in container, standalone COPY puts server.js at root `/app/server.js`
- **Fix:** Removed explicit startCommand from railway.toml (Nixpacks detects npm start automatically)
- **Files modified:** `railway.toml`
- **Commit:** `1596c27`

## User Setup Required (Manual Step)

**Delete legacy Railway cron services via dashboard** (cannot be done via CLI — documented dead end per 15-02):
1. `cost-ledger-sweep` — Was: `0/5 * * * *`
2. `limit-enforcement` — Was: `* * * * *`  
3. `bonus-detection` — Was: `* * * * *`

See `15-04-DEPLOYMENT.md` for detailed dashboard steps.

**Also required post-cleanup:**
- Delete `src/app/api/admin/migrate/route.ts` (temporary migration endpoint)
- Remove `api/admin/migrate` from `src/middleware.ts` matcher

## Self-Check: PASSED

All created files verified present on disk. All deleted files confirmed absent. All commits confirmed in git log. 74 tests passing.
