---
phase: 15-safety-alert-extension-rate-limiting
plan: "02"
subsystem: api, ui, infra
tags: [mongodb, nextjs, railway, cron, rate-limiting, acl, enforcement, bonus-purchases, recharts]

requires:
  - phase: 15-safety-alert-extension-rate-limiting/15-01
    provides: cost-ledger, bonus-purchases, bonus-detection libs; balance system enabled in LibreChat

provides:
  - enforcement.ts: lockImageAccess, unlockImageAccess, hardLockAllAccess, unlockAllAccess, enforceChildLimits
  - bonus-delivery.ts: sendBonusOfferMessage, detectBonusConfirmation, applyBonusCredit
  - 5 Railway cron endpoints: cost-ledger-sweep, limit-enforcement, bonus-detection, daily-reset, monthly-reset
  - Admin settings page (/settings) with global defaults + per-child overrides
  - User detail page (/users/[userId]) with live usage stats + Progress bars
  - Alerts page image_prompt filter tab
  - Analytics page image trend BarChart (30-day)
  - Weekly digest extended with bonus purchase stats
  - Production deployment live on Railway

affects: [phase-16, any future feature touching ACL, rate limits, or bonus flows]

tech-stack:
  added: [recharts (already installed), shadcn progress, shadcn tabs]
  patterns:
    - MongoDB typed collections to handle string _id: "db.collection<SettingsDoc>(name)" + "as Parameters<typeof col.findOne>[0]" cast
    - Two-tier locking: ACL removal (soft/daily) + tokenCredits:0 (hard/monthly)
    - Cron state persisted in "cron_state" collection with per-job _id keys
    - TDD with pipeline-inspection mocks to distinguish multi-aggregate calls

key-files:
  created:
    - src/lib/enforcement.ts
    - src/lib/bonus-delivery.ts
    - src/app/api/cron/cost-ledger-sweep/route.ts
    - src/app/api/cron/limit-enforcement/route.ts
    - src/app/api/cron/bonus-detection/route.ts
    - src/app/api/cron/daily-reset/route.ts
    - src/app/api/cron/monthly-reset/route.ts
    - src/app/(dashboard)/settings/page.tsx
    - src/app/(dashboard)/settings/settings-form.tsx
    - src/app/(dashboard)/settings/actions.ts
    - src/app/(dashboard)/settings/loading.tsx
    - src/app/(dashboard)/users/[userId]/page.tsx
    - src/app/(dashboard)/users/[userId]/loading.tsx
    - src/components/dashboard/image-trend-card.tsx
    - tests/lib/enforcement.test.ts
    - tests/lib/bonus-delivery.test.ts
    - .planning/phases/15-safety-alert-extension-rate-limiting/15-02-DEPLOYMENT.md
  modified:
    - src/middleware.ts (add /api/cron bypass)
    - src/lib/weekly-digest.ts (bonus stats extension)
    - src/components/emails/weekly-digest-email.tsx (bonus section)
    - src/lib/settings.ts (typed partial fix)
    - src/app/(dashboard)/alerts/page.tsx (imagePromptCount badge)
    - src/components/dashboard/alerts-table.tsx (image_prompt tab)
    - src/app/(dashboard)/analytics/page.tsx (ImageTrendSection)
    - src/components/dashboard/nav-sidebar.tsx (settings nav item)
    - src/components/dashboard/users-table.tsx (child name → /users/{userId} link)
    - tsconfig.json (exclude scripts dir)

key-decisions:
  - "Two-tier locking: ACL entry removal for image lock (soft/daily), tokenCredits=0 for hard lock (monthly)"
  - "awaitingBonusConfirmation state stored in settings collection under override_{userId} to avoid new collection"
  - "Railway cron schedules must be configured manually in dashboard — no CLI/GraphQL API support"
  - "serviceInstanceRedeploy reuses cached Docker image — must use railway up for fresh source builds"
  - "Pipeline inspection pattern for TDD mocks: inspect $match stage keys to distinguish aggregate calls"

patterns-established:
  - "MongoDB string-_id typed collections: db.collection<T & { _id?: string }>(name) + cast filters"
  - "Belt-and-suspenders enforcement: hard lock always also calls lockImageAccess for belt-and-suspenders"
  - "Cron state persistence: cron_state collection with lastPoll field, default to 5min lookback on first run"

requirements-completed: [IMG-ENFORCE-01, IMG-ENFORCE-02, IMG-ENFORCE-03, IMG-BONUS-01, IMG-BONUS-02, IMG-ADMIN-01]

duration: 75min
completed: 2026-04-10
---

# Phase 15 Plan 02: Safety Alert Extension & Rate Limiting Summary

**ACL-based image enforcement + bonus purchase flow + 5 Railway crons deployed live, with admin settings UI and per-child usage dashboards**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-04-10T11:00:00Z (approx)
- **Completed:** 2026-04-10T12:17:00Z
- **Tasks:** 5 of 5 complete
- **Files modified:** 22

## Accomplishments

- Full rate-limiting enforcement pipeline deployed: cost sweep → limit check → bonus offer → YES detection → credit apply → daily/monthly reset
- Admin UI ships settings page (global + per-child overrides), user detail with live usage bars, image trend chart, alerts image_prompt filter
- All 5 production cron endpoints return correct 200/401 responses on Railway (deployment d7cde82)

## Task Commits

1. **Task 1: Enforcement + bonus-delivery libs with TDD** - `d43b9f4` (feat)
2. **Task 2: 5 cron endpoints + middleware + weekly digest** - `133c3ba` (feat)
3. **Task 3: Admin UI - settings, user detail, alerts, analytics** - `d7cde82` (feat)
4. **Task 4: Deploy to Railway + cron schedule docs** - `e34839b` (chore)
5. **Task 5: Navigation fix (child rows → /users/{userId}) + SUMMARY + state updates** - *(this commit)* (fix+docs)

## Files Created/Modified

- `src/lib/enforcement.ts` — Core locking logic: ACL removal (image lock), tokenCredits=0 (hard lock), enforceChildLimits orchestrator
- `src/lib/bonus-delivery.ts` — Synthetic message insertion, YES detection, bonus credit application
- `src/app/api/cron/cost-ledger-sweep/route.ts` — Polls new AI messages, calculates EUR cost, deduplicates into cost_ledger
- `src/app/api/cron/limit-enforcement/route.ts` — Iterates non-ADMIN users, calls enforceChildLimits
- `src/app/api/cron/bonus-detection/route.ts` — Finds awaiting-confirmation states, detects YES, applies credit
- `src/app/api/cron/daily-reset/route.ts` — Unlocks daily image/message locks, clears awaiting state
- `src/app/api/cron/monthly-reset/route.ts` — Restores tokenCredits, unlocks monthly_cost_cap ACL entries
- `src/app/(dashboard)/settings/page.tsx` — Settings page server component with Suspense
- `src/app/(dashboard)/settings/settings-form.tsx` — Tabbed form with useTransition pending state
- `src/app/(dashboard)/settings/actions.ts` — Server actions: saveGlobalDefaults, saveChildOverride, deleteChildOverride
- `src/components/dashboard/image-trend-card.tsx` — recharts BarChart for 30-day image generation
- `tests/lib/enforcement.test.ts` — 8 TDD test cases with pipeline-inspection mock
- `tests/lib/bonus-delivery.test.ts` — Tests for sendBonusOfferMessage, detectBonusConfirmation, applyBonusCredit

## Decisions Made

- **Two-tier locking:** ACL entry removal (soft, reversible, daily scope) + tokenCredits=0 (hard, monthly scope). Hard lock always also calls lockImageAccess for belt-and-suspenders.
- **awaitingBonusConfirmation in settings:** Stored under `override_{userId}` to avoid a new collection. Fields: `awaitingBonusConfirmation`, `confirmationOfferedAt`, `lockType`, `activeConversationId`.
- **Railway cron limitation:** Railway does not support cron configuration via CLI or GraphQL. Schedules require manual creation in the Railway dashboard (documented in 15-02-DEPLOYMENT.md).
- **Fresh builds via `railway up`:** `serviceInstanceRedeploy` and `serviceInstanceDeploy` mutations only redeploy the cached image. Source changes require `railway up`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TDD pipeline-inspection mock to distinguish aggregate calls**
- **Found during:** Task 1 (enforcement TDD RED phase)
- **Issue:** `getWeeklyBonusSpend` and `getActiveBonusCredit` both call `bonus_purchases.aggregate()`. Single mock returned same value, causing `activeBonus` to be 0 when test expected 2.0.
- **Fix:** Built custom mock that inspects `pipeline[0].$match` keys — `expiresAt` presence identifies `getActiveBonusCredit`, `purchasedAt` identifies `getWeeklyBonusSpend`.
- **Files modified:** tests/lib/enforcement.test.ts
- **Committed in:** d43b9f4

**2. [Rule 3 - Blocking] bonus-delivery.test.ts missing insertMany/deleteMany in makeCollection**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** `unlockImageAccess` calls `aclentries.insertMany()` and `locked_acl_entries.deleteMany()`, but `makeCollection` helper didn't include those methods.
- **Fix:** Added `insertMany` and `deleteMany` jest.fn() to the collection factory.
- **Files modified:** tests/lib/bonus-delivery.test.ts
- **Committed in:** d43b9f4

**3. [Rule 3 - Blocking] TypeScript: string _id not assignable to Filter<Document>**
- **Found during:** Task 2 (build verification)
- **Issue:** MongoDB TS types expect `_id: Condition<ObjectId>` but settings/cron collections use string `_id` values like `"global_defaults"`.
- **Fix:** Consistent typed-collection pattern throughout: `db.collection<T & { _id?: string }>(name)` + `as Parameters<typeof col.findOne>[0]` cast on all filter objects.
- **Files modified:** settings.ts, settings/actions.ts, enforcement.ts, bonus-detection/route.ts, cost-ledger-sweep/route.ts
- **Committed in:** 133c3ba, d43b9f4

**4. [Rule 1 - Bug] settings.ts type narrowing lost on `globalDoc ?? {}`**
- **Found during:** Task 2 (build)
- **Issue:** `const g = globalDoc ?? {}` caused TypeScript to infer `{}` type, losing `EffectiveLimits` field access.
- **Fix:** Added explicit type annotation: `const g: Partial<EffectiveLimits> = globalDoc ?? {}`.
- **Files modified:** src/lib/settings.ts
- **Committed in:** 133c3ba

**5. [Rule 1 - Bug] Recharts Tooltip formatter type mismatch**
- **Found during:** Task 3 (build)
- **Issue:** `(value: number) => [value, "Images"]` didn't match Recharts `Formatter` type signature.
- **Fix:** Changed to `(value) => [String(value), "Images"]` — infers type from context.
- **Files modified:** src/components/dashboard/image-trend-card.tsx
- **Committed in:** d7cde82

**6. [Rule 1 - Bug] tsconfig.json including scripts/ directory causing dotenv type error**
- **Found during:** Task 2 (build)
- **Issue:** `tsconfig.json` glob `**/*.ts` included `scripts/deploy-librechat-yaml.ts` which imports `dotenv` (not installed as type dep).
- **Fix:** Added `"scripts"` to the `exclude` array in tsconfig.json.
- **Files modified:** tsconfig.json
- **Committed in:** 133c3ba

**7. [Rule 1 - Bug] Railway deployment returning 307 redirect (old code still running)**
- **Found during:** Task 4 (smoke test)
- **Issue:** `serviceInstanceRedeploy` GraphQL mutation only redeploys cached Docker image. Middleware bypass for `/api/cron` wasn't live.
- **Fix:** Used `railway up --no-gitignore` to force fresh source build.
- **Files modified:** None (deployment action only)
- **Committed in:** N/A (deployment artifact)

**8. [Rule 1 - Bug] Navigation dead-end: no link from /users list to /users/{userId}**
- **Found during:** Task 5 (human verification — checkpoint:human-verify)
- **Issue:** Child rows in `/users` list had no navigation to the detail page; `/users/{userId}` was reachable only by typing the URL directly
- **Fix:** Added `<Link href={/users/${userId}}>` wrapping the child's name cell in `users-table.tsx`; admin rows unchanged (admin has no detail page)
- **Files modified:** src/components/dashboard/users-table.tsx
- **Verification:** Build passes, deployed to Railway
- **Committed in:** Task 5 commit

---

**Total deviations:** 8 auto-fixed (2 blocking, 5 bugs, 1 type)
**Impact on plan:** All fixes necessary for build correctness, deployment, and UX reachability. No scope creep.

## Issues Encountered

- Railway CLI `railway up` intermittently failed with "error decoding response body" — retried after a few minutes, succeeded.
- Railway `variables` table output truncates the 64-char CRON_SECRET. Used `--json` flag + python3 to extract full value for smoke test.

## User Setup Required

Railway cron schedules must be configured manually in the Railway dashboard. See `15-02-DEPLOYMENT.md` for the exact 5 cron entries with schedules, URLs, methods, and headers.

## Known Issues / Deferred to Phase 15.1

The following items were surfaced during human verification and are intentionally deferred to a gap-closure phase (15.1). Do NOT attempt to fix these under plan 15-02.

### 1. Per-Child Overrides tab broken (settings page)

- **Status:** Known broken — the Per-Child Overrides tab in `/settings` does not persist or apply overrides correctly
- **Root cause:** Likely a server action / form data wiring issue in `settings-form.tsx` + `actions.ts`
- **Deferral reason:** The entire override schema is about to change (see item 2 below). Fixing against the current schema would be wasted work.

### 2. Schema shift: dailyImageLimit + dailyMessageLimit → dailyCostCapEur

- **Requirement:** Replace the two separate integer limits (`dailyImageLimit`, `dailyMessageLimit`) with a single `dailyCostCapEur` (float, EUR) — one number the parent sets ("how much can my child spend on AI per day")
- **Scope:** Rework `settings.ts`, `enforcement.ts` / `enforceChildLimits`, admin settings page, per-child overrides UI, and all cron endpoints that reference image/message count limits
- **Enforcement logic:** Daily soft-lock fires when `sum(cost_ledger WHERE date=today AND userId=X) >= dailyCostCapEur`; no separate image vs message enforcement at the soft-lock layer

### 3. 70% warning to children via in-chat synthetic message

- **Requirement:** When a child reaches 70% of their daily cost cap, insert a synthetic in-chat message (reuse Pattern 8 bonus-delivery infrastructure): "You've used 70% of your daily chat budget. Use it wisely!"
- **Trigger:** In `enforceChildLimits`, check `currentDailyCost / dailyCostCapEur >= 0.70` before the lock threshold; if threshold crossed and not already warned today, call `sendBonusOfferMessage` (or a variant) with the 70% warning template
- **State tracking:** Store `warnedAt70PctToday: Date` on the `override_{userId}` settings doc to prevent repeat warnings

### 4. Usage progress visible to kids (LibreChat frontend — needs research)

- **Requirement:** Children should see a usage progress indicator in LibreChat showing how much of their daily budget they've consumed (e.g. "You've used €0.04 of your €0.10 daily limit")
- **Challenge:** LibreChat frontend is not directly owned code — requires research into whether a custom banner/widget can be injected via `librechat.yaml`, a LibreChat plugin, or whether a synthetic "assistant" message at conversation start can carry dynamic usage context
- **Suggested research:** Check LibreChat's `interface.ui` YAML options for custom banners; investigate system prompt injection with dynamic usage context
- **Admin view:** Usage progress must also be visible at a top-level admin glance (not buried in /users/{id}). Consider adding a usage overview card to the main dashboard showing each child's daily spend vs cap as a progress bar

### 5. Re-fix per-child overrides under new cost-cap schema

- After schema shift (item 2), the per-child override UI needs to expose `dailyCostCapEur` (not the old image/message integer fields) with working persistence and application in enforcement

## Next Phase Readiness

- All enforcement infrastructure deployed and verified in production
- Navigation: child detail pages (/users/{userId}) now reachable from the /users list
- Cron schedules pending manual Railway dashboard configuration (see DEPLOYMENT.md)
- Gap-closure phase 15.1 should address: cost-cap schema rework, 70% warning, per-child override UI fix, LibreChat usage progress research

---
*Phase: 15-safety-alert-extension-rate-limiting*
*Completed: 2026-04-10*
