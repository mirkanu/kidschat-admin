---
phase: 15-safety-alert-extension-rate-limiting
plan: "00"
subsystem: testing
tags: [jest, ts-jest, mongodb, inspection, synthetic-message]

# Dependency graph
requires:
  - phase: 14-enable-safeguard-image-generation
    provides: Drawing agent IDs (agent_wxgt6su7d3pcosiil3, agent_y4w1cvoyg77p9thed9, agent_64q6z5s57552cpgl0hr, agent_aiv99mzvdzquym6y89k) and confirmed DALL-E integration
provides:
  - Jest harness with 5 test stubs covering all Phase 15 lib/api targets
  - MONGO-INSPECTION.md with exact live DB field names for Plan 02 enforcement code
  - Confirmed GO verdict: admin-inserted MongoDB messages render in LibreChat child UI
affects:
  - 15-01-safety-patterns-rate-limit-libs
  - 15-02-enforcement-and-bonus-delivery

# Tech tracking
tech-stack:
  added: [jest, @types/jest, ts-jest, @jest/globals]
  patterns: [TDD stubs with it.todo for every planned function, one-shot inspection script via npx tsx]

key-files:
  created:
    - jest.config.js
    - jest.setup.ts
    - tests/lib/safety-patterns.test.ts
    - tests/lib/rate-limits.test.ts
    - tests/lib/cost-ledger.test.ts
    - tests/lib/bonus-purchases.test.ts
    - tests/api/weekly-digest.test.ts
    - scripts/mongo-inspect.ts
    - .planning/phases/15-safety-alert-extension-rate-limiting/15-00-MONGO-INSPECTION.md
  modified: [package.json]

key-decisions:
  - "balances collection is plural (not balance) — all Plan 01/02 code uses db.collection('balances')"
  - "aclentries.principalId is the user field — NOT user. Plan 02 enforcement must use principalId"
  - "aclentries.resourceId is MongoDB ObjectId — must look up agent _id first, then query aclentries"
  - "tokenCount is flat integer (not input/output split) — cost ledger must apply char-formula for input/output split"
  - "balances collection is empty (balance.enabled NOT set) — Plan 01 must implement own cost_ledger collection"
  - "Synthetic message GO verdict — admin-inserted messages render in child LibreChat UI without extra signaling"

patterns-established:
  - "Inspection-first before writing enforcement code — document actual field names before implementing DB queries"
  - "Synthetic message probe pattern — insert, verify with real user, delete for go/no-go gating"

requirements-completed: []

# Metrics
duration: 35min
completed: "2026-04-10"
---

# Phase 15 Plan 00: MongoDB Inspection + Jest Harness Summary

**Jest test harness with 5 stubs installed; live MongoDB field names documented; admin-inserted message delivery confirmed GO via synthetic probe with Sebastian**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-10T10:35:00Z
- **Completed:** 2026-04-10T11:15:00Z
- **Tasks:** 4
- **Files modified:** 10

## Accomplishments

- Installed Jest + ts-jest with Next.js `@/` alias support; `npm test` exits 0 with 5 passing placeholder specs
- Ran live inspection script against Railway MongoDB and documented exact field names for all 6 collections Plan 02 targets
- Discovered 5 critical field-name surprises that would have caused Plan 02 enforcement code to fail silently (see Decisions)
- Inserted synthetic message, had Sebastian verify it rendered in LibreChat, confirmed Pattern 8 (bonus offer delivery via direct MongoDB insert) is viable — VERDICT: GO

## Task Commits

1. **Task 1: Install Jest and create empty test stubs** - `c345d69` (chore)
2. **Task 2: Write and run live MongoDB inspection script** - `d6a45ba` (feat)
3. **Task 3: Synthetic message insertion probe** - `f6344ea` (feat)
4. **Task 4: Human review — VERDICT: GO recorded, cleanup** - (this commit)

## Files Created/Modified

- `jest.config.js` - Jest config with ts-jest preset, node env, `@/` alias mapping
- `jest.setup.ts` - Global timeout set to 15000ms for MongoDB mocks
- `tests/lib/safety-patterns.test.ts` - Stubs: violent/nudity/horror/real-person/bypass pattern todos
- `tests/lib/rate-limits.test.ts` - Stubs: effective limit resolver, per-child override precedence
- `tests/lib/cost-ledger.test.ts` - Stubs: monthly spend aggregation, messageId dedup, char-formula fallback
- `tests/lib/bonus-purchases.test.ts` - Stubs: weekly bonus cap, Monday UTC week-start, active credit remaining
- `tests/api/weekly-digest.test.ts` - Stub: bonus totals in digest stats
- `scripts/mongo-inspect.ts` - Read-only inspection + synthetic message probe (with --cleanup flag)
- `package.json` - Added `test` and `test:watch` scripts
- `.planning/phases/15-safety-alert-extension-rate-limiting/15-00-MONGO-INSPECTION.md` - Live field findings + GO verdict

## Decisions Made

1. **`balances` not `balance`** — LibreChat's collection is plural. All Plan 01/02 code must use `db.collection("balances")`.
2. **`aclentries.principalId`** — The user reference field. Plan 02 enforcement queries `{ principalId: userId, resourceId: agent._id, resourceType: "agent" }`.
3. **`aclentries.resourceId` is MongoDB ObjectId** — Cannot filter by agent string ID directly. Must resolve agent `_id` first.
4. **`tokenCount` is flat integer** — No input/output split. Cost ledger must use char-formula: `(input_chars/4) * haiku_input_rate + (output_chars/4) * haiku_output_rate`.
5. **`balances` is empty** — LibreChat native balance system not enabled. Plan 01 implements own `cost_ledger` collection independently.
6. **Synthetic message VERDICT: GO** — Admin-injected messages appear in child's LibreChat UI without refresh or extra signaling. Pattern 8 is viable for bonus offer delivery.

## Deviations from Plan

None — plan executed exactly as written. The field-name surprises were expected discoveries (the plan's explicit goal was to surface them before Plan 02 started).

## Issues Encountered

None — MongoDB connection was live, all 4 drawing agents confirmed present with `dalle` tool, synthetic message inserted and rendered successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 01 (safety patterns + rate-limit libs) is ready to execute. All field names are confirmed. Key constraints for Plan 01/02 code:

- Use `db.collection("balances")` not `balance`
- Use `principalId` not `user` in aclentries queries
- Resolve agent `_id` before querying aclentries (can't filter by `agent_xxx` string directly)
- Apply char-formula for input/output cost split (tokenCount is flat total only)
- Bonus offer delivery via direct MongoDB message insert is confirmed viable

---
*Phase: 15-safety-alert-extension-rate-limiting*
*Completed: 2026-04-10*
