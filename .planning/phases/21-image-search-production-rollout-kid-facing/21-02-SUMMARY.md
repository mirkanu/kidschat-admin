---
phase: 21
plan: 02
subsystem: "image-search, admin-backend, cron"
tags: [search-quota, openverse, cron, admin, SEARCH-07]
requires:
  - src/lib/budget.ts (extended, not rewritten)
  - src/app/api/cron/daily-reset/route.ts (extended)
  - src/middleware.ts (matcher updated)
provides:
  - "POST /api/image-search/quota endpoint on kidschat-admin (production)"
  - "search_counters MongoDB collection (keyed by {userId, utcDay})"
  - "getEffectiveSearchCap(userId, db) budget helper"
  - "resetAllSearchCounters(db) called by daily-reset cron"
  - "cron_state.lastRunStats.search_counters_reset observability field"
affects:
  - Plan 21-01 (Openverse MCP) — it now has a counter endpoint to call
tech-stack:
  added: []
  patterns:
    - "Atomic $inc + post-increment cap check with $inc:-1 rollback on overage"
    - "x-quota-secret header constant-time (timingSafeEqual) — mirrors /api/cron + /api/notify auth"
    - "Bolt-on to existing daily-reset cron; no new schedule, no new Railway service"
key-files:
  created:
    - src/lib/image-search-quota.ts
    - src/app/api/image-search/quota/route.ts
    - tests/lib/image-search-quota.test.ts
    - tests/lib/budget-search-cap.test.ts
  modified:
    - src/lib/budget.ts
    - src/app/api/cron/daily-reset/route.ts
    - src/middleware.ts
    - tsconfig.json
    - .dockerignore
decisions:
  - "DB-name parity: client.db(\"test\") in quota route matches daily-reset + weekly-digest verbatim (W3 revision requirement)"
  - "Cap resolution order mirrors getEffectiveBudget: child_override > global_defaults > HARDCODED_DEFAULTS (20)"
  - "Race-safety: findOneAndUpdate post-increment check + $inc:-1 rollback beats pre-increment conditional update (simpler; equivalent under contention for our low-QPS MCP caller)"
  - "deleteMany on search_counters during daily-reset (not $set count=0) — simpler, utcDay key change makes it idempotent"
  - "services/ + tests/ excluded from admin tsconfig.json because Phase 20 added services/image-search-mcp as a sibling Railway service; admin Next.js type-checker was scooping its TS files and erroring on zod (Rule 3 deviation)"
metrics:
  duration_min: 30
  completed: 2026-04-21
requirements: [SEARCH-07]
---

# Phase 21 Plan 02: Image-Search Quota Admin Backend Summary

**One-liner:** kidschat-admin now exposes `POST /api/image-search/quota` with atomic per-child daily counting (cap 20, child-overridable), wired into the existing daily-reset cron for nightly wipe — closing SEARCH-07 on the admin side so the Openverse MCP from Plan 21-01 can call it.

## What shipped

1. **Schema extension** — `src/lib/budget.ts`: optional `dailySearchCountCap: number` on `GlobalDefaults` and `ChildOverride`, `HARDCODED_DEFAULTS.dailySearchCountCap = 20`, new `getEffectiveSearchCap(userId, db)` helper mirroring `getEffectiveBudget` resolution order. `EffectiveBudget` interface now returns the cap so a single call gets all three budget fields.
2. **Counter module** — `src/lib/image-search-quota.ts`: `checkAndIncrementSearchCount`, `getSearchCounter`, `resetAllSearchCounters` over a new `search_counters` collection keyed `{userId, utcDay}`. Atomic `$inc` via `findOneAndUpdate` returns post-increment; if `post > cap` we roll back `$inc:-1`.
3. **Production endpoint** — `src/app/api/image-search/quota/route.ts`: POST handler with `x-quota-secret` header auth (constant-time compared against `CRON_SECRET`), structured `image_search.quota.check` log line per call for future Sentry/dead-man wiring (Phase 999.1).
4. **Cron bolt-on** — `src/app/api/cron/daily-reset/route.ts`: added `resetAllSearchCounters(db)` after the user loop; `search_counters_reset` is now in the response JSON and `cron_state.lastRunStats` (T-21-12 observability mitigation).
5. **Middleware** — `/api/image-search` exempted from session auth matcher in `src/middleware.ts` (same pattern as `/api/notify`, `/api/cron`).
6. **Deploy** — `railway up --service kidschat-admin`; live at `https://kidschat-admin-production.up.railway.app/api/image-search/quota`.

## Verification transcript (live production)

### Truth 1 — 21-call sequence, cap=20

```
=== Reset counters via daily-reset cron (baseline) ===
{"reset":2,"accumulated":2,"admins_refilled":3,"search_counters_reset":0,"errors":[]}

=== 21 calls (userId=000000000000000000000001) ===
call 1:  {"allowed":true,"remaining":19}
call 2:  {"allowed":true,"remaining":18}
call 3:  {"allowed":true,"remaining":17}
call 4:  {"allowed":true,"remaining":16}
call 5:  {"allowed":true,"remaining":15}
call 6:  {"allowed":true,"remaining":14}
call 7:  {"allowed":true,"remaining":13}
call 8:  {"allowed":true,"remaining":12}
call 9:  {"allowed":true,"remaining":11}
call 10: {"allowed":true,"remaining":10}
call 11: {"allowed":true,"remaining":9}
call 12: {"allowed":true,"remaining":8}
call 13: {"allowed":true,"remaining":7}
call 14: {"allowed":true,"remaining":6}
call 15: {"allowed":true,"remaining":5}
call 16: {"allowed":true,"remaining":4}
call 17: {"allowed":true,"remaining":3}
call 18: {"allowed":true,"remaining":2}
call 19: {"allowed":true,"remaining":1}
call 20: {"allowed":true,"remaining":0}
call 21: {"allowed":false,"remaining":0}    ← cap hit, rollback engaged
```

### Truth 2 — post-cron reset restores quota

```
=== Trigger daily-reset (wipes counters) ===
{"reset":2,"accumulated":2,"admins_refilled":3,"search_counters_reset":1,"errors":[]}
                                                                         ^^^ the 21-call doc wiped

=== Next call for same user ===
{"allowed":true,"remaining":19}     ← counter is back to 0, increments to 1
```

### Truth 3 — unit tests for cap resolution order

```
$ npx jest --testPathPatterns "image-search-quota|budget-search-cap"
Test Suites: 2 passed, 2 total
Tests:       6 passed, 6 total
```

### Auth gate (T-21-08 mitigation, live)

```
$ curl -sS -X POST .../api/image-search/quota -d '{}' -H 'content-type: application/json'
{"error":"Unauthorized"}      ← HTTP 401 without x-quota-secret
```

### Structured log evidence (Railway deployment logs)

```
event="image_search.quota.check" userId="1001" allowed=true remaining=17
event="image_search.quota.check" userId="1001" allowed=true remaining=16
event="image_search.quota.check" userId="1001" allowed=true remaining=2
event="image_search.quota.check" userId="1001" allowed=true remaining=1
```

### DB-name parity (W3 revision)

```
$ grep -n "\.db(" src/app/api/image-search/quota/route.ts src/app/api/cron/daily-reset/route.ts src/app/api/notify/weekly-digest/route.ts
src/app/api/image-search/quota/route.ts:52:  const db = client.db("test");
src/app/api/cron/daily-reset/route.ts:23:    const db = client.db("test");
src/app/api/notify/weekly-digest/route.ts:29: const db = client.db("test");
```
All three call `.db("test")` verbatim — no TODO, no placeholder, no drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Railway deploy failed because admin tsconfig scooped services/image-search-mcp/src/*.ts**

- **Found during:** Task 21-02-02 (first `railway up` attempt)
- **Issue:** `tsconfig.json` had `include: ["**/*.ts", ...]` with no `services/` exclusion. Phase 20 added `services/image-search-mcp/` as a sibling Railway service with its own `package.json` (has `zod`), but the admin's root `node_modules` does not — so Next.js's type-checker failed on `import { z } from "zod"` inside the MCP's `server.ts`.
- **Fix:** Added `"services"` and `"scripts"` to `tsconfig.json` exclude. Also added `services` and `tests` to `.dockerignore` so the admin image stays small.
- **Files modified:** `tsconfig.json`, `.dockerignore`
- **Commit:** `66bc488` (`fix(21-02): exclude services/ + tests/ from admin tsconfig + docker context`)

No architectural changes needed — pre-existing mis-configuration surfaced the moment the admin redeployed after Phase 20 work.

## Threat Model compliance

| Threat ID | Status |
|-----------|--------|
| T-21-08 Spoofing | ✓ `timingSafeEqual(header, CRON_SECRET)` — live 401 verified |
| T-21-09 Tampering (race) | ✓ `findOneAndUpdate` post-increment + `$inc:-1` rollback |
| T-21-10 Info Disclosure | ✓ Accepted (cap public); constant-time on secret compare only |
| T-21-11 DoS | ✓ Shared secret gates all increments |
| T-21-12 Repudiation | ✓ `cron_state.lastRunStats.search_counters_reset` queryable post-hoc; structured logs enable Phase 999.1 alerting |

## Commits

- `341c831` — `test(21-02): add failing tests for search quota + effective search cap` (RED)
- `1d32a69` — `feat(21-02): add dailySearchCountCap schema + image-search-quota lib` (GREEN)
- `697993c` — `feat(21-02): /api/image-search/quota endpoint + daily-reset wire-up`
- `66bc488` — `fix(21-02): exclude services/ + tests/ from admin tsconfig + docker context`
- Railway deploy: live, first successful deployment post-Phase-20 sibling-service introduction.

## Self-Check: PASSED

- src/lib/image-search-quota.ts: FOUND
- src/app/api/image-search/quota/route.ts: FOUND
- tests/lib/image-search-quota.test.ts: FOUND
- tests/lib/budget-search-cap.test.ts: FOUND
- Commit 341c831: FOUND
- Commit 1d32a69: FOUND
- Commit 697993c: FOUND
- Commit 66bc488: FOUND
- Live endpoint returned 401 without secret, and 20-allow/1-deny pattern with secret.
- Cron reset observed to wipe the counter (`search_counters_reset:1`) and subsequent call returned remaining:19.
