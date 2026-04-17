---
phase: 260417-njb
plan: 01
subsystem: admin-ui-settings-consolidation
tags: [perceived-performance, suspense, revalidation, ui-refactor]
tech_stack:
  added: []
  patterns:
    - Per-child Suspense boundaries for independent streaming
    - Dual revalidatePath (users/{id} + /settings) for mutation-to-read-view invalidation
key_files:
  created: []
  modified:
    - src/app/(dashboard)/settings/page.tsx
    - src/app/(dashboard)/users/[userId]/page.tsx
    - src/app/(dashboard)/users/[userId]/loading.tsx
    - src/app/(dashboard)/users/[userId]/actions.ts
decisions:
  - Reuse overrides array from existing getSettingsData() rather than add a second fetcher; two MongoDB roundtrips on /settings accepted as fine given Next.js 15 request-scoped connection reuse
  - Keep /users/{userId} revalidation in place alongside new /settings revalidation (over-invalidation is free)
  - space-y-6 container on /settings bumped to space-y-8 to give new section + tabs block breathing room
metrics:
  duration_minutes: 7
  completed_date: 2026-04-17
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 260417-njb: Consolidate per-child Usage & Limits into /settings

**One-liner:** Moved per-child UsageBars + Top-up button from `/users/{userId}` onto `/settings` (rendered as stacked cards above the existing Global Defaults / Per-Child Overrides tabs), and wired `topUpChildBalance` to revalidate `/settings` so bars refresh after top-up.

## Objective (recap)

Consolidate all budget/usage controls onto `/settings` so parents see live balance and top-up affordance in the same place they configure limits. Eliminates the extra nav hop through `/users/{userId}` purely to check spend or top up. `/users/{userId}` becomes lean: breadcrumb + heading + Account Details only.

## Outcome

| Check | Result |
|---|---|
| `grep -c UsageBars src/app/(dashboard)/users/[userId]/page.tsx` | `0` (target: 0) |
| `grep -c UsageBars src/app/(dashboard)/settings/page.tsx` | `4` (target: >=2) |
| `grep -c 'revalidatePath("/settings")' ...actions.ts` | `1` (target: 1) |
| `grep 'Usage & Limits' ...loading.tsx` | no match (target: no match) |
| `grep 'visit the Settings page' ...page.tsx` | no match (target: no match) |
| `grep -c Suspense src/app/(dashboard)/users/[userId]/page.tsx` | `0` (unused import removed) |
| `grep -c TopUpButton src/app/(dashboard)/users/[userId]/page.tsx` | `0` (unused import removed) |
| `npx tsc --noEmit` new errors in `src/` | 0 (baseline: 32 pre-existing test-file errors unchanged) |
| Git diff scope | exactly 4 files modified, no drift |

## Tasks completed

### Task 1 — Atomic 4-file edit

**Commit:** `5a3a863` — `feat(260417-njb): move Usage & Limits from /users/{id} to /settings + add revalidatePath('/settings') to topUpChildBalance`

- **`src/app/(dashboard)/settings/page.tsx`** — added `UsageBars`/`UsageBarsSkeleton` and `TopUpButton` imports; new `ChildUsageSection` server component (reuses `overrides` from `getSettingsData()`); new `ChildUsageSectionSkeleton` matching-shape fallback; page JSX container bumped from `space-y-6` to `space-y-8` and new "Current usage" `<section>` rendered above the existing tabs `<Suspense>`. Each child card wraps `<UsageBars>` in its own `<Suspense fallback={<UsageBarsSkeleton />}>` so bars stream independently (perceived-performance rule 2).
- **`src/app/(dashboard)/users/[userId]/page.tsx`** — removed the Usage & Limits block and the obsolete "visit the Settings page" link. Pruned now-unused imports: `Suspense` (react), `UsageBars`/`UsageBarsSkeleton`, `TopUpButton`. `Link` kept (still used for breadcrumb).
- **`src/app/(dashboard)/users/[userId]/loading.tsx`** — removed the Usage & Limits 2-bar skeleton block; loading state now ends with the Account details card skeleton.
- **`src/app/(dashboard)/users/[userId]/actions.ts`** — added `revalidatePath("/settings")` after the existing `/users/${userId}` revalidation in `topUpChildBalance`, so the moved bars refresh after a top-up.

### Task 2 — Railway deploy

- **Railway deploy ID:** `0165dd96-ca9e-446e-88fe-91d7ed90c965`
- **Service:** `kidschat-admin` (`83b7b7d1-76bd-4e99-8466-d2a1bf44f8d2`)
- **Environment:** `fd18f36e-b726-425a-9d96-95d59d768635`
- **Build image digest:** `sha256:cc5589c038d7aba94fd853e547726a1258d0f90771a90c55bfef16b6cbff6d82`
- **Timeline:** created 2026-04-17T16:06:23Z → SUCCESS 2026-04-17T16:08:15Z (~1m52s)
- **Final status:** `SUCCESS`
- **Live HTTP check:** `curl -I https://kidschat-admin-production.up.railway.app/settings` returns `307` → `/login?callbackUrl=...` (expected: admin-only page redirects unauthenticated requests).
- **"Current usage" string in /login client chunks:** not present — expected, since `/settings` is a server component and the literal string only renders in SSR HTML for authenticated sessions. Visual verification deferred to parent's next admin session (no UAT checkpoint in this plan).

## Deviations from Plan

**None.** Plan executed exactly as written. The planned "refactor into a shared data fetcher" was explicitly flagged as out-of-scope and left for a future task; `getSettingsData()` is now called twice per `/settings` request (once by `ChildUsageSection`, once by `SettingsContent`). Request-scoped MongoDB client reuse absorbs the cost.

## Follow-ups flagged

- **`balance_state.monthlySpendEur` dead field (from 15.3 decisions log):** now that the "This month" bar is the first thing parents see on `/settings`, the always-0% bar will be more visible. Existing follow-up — not addressed in this task.
- **Visual confirmation:** Parent should confirm on next admin session that per-child cards render above the tabs on `/settings` and that `/users/{any-kid-id}` has no residual Usage & Limits/settings-link UI.
- **End-to-end smoke test of `revalidatePath("/settings")` wiring:** click Top up €0.10 on `/settings` and confirm Today bar reflects the updated balance on the same page. (Server-side change is deployed; browser-side confirmation pending parent.)

## Self-Check: PASSED

- [x] `src/app/(dashboard)/settings/page.tsx` exists (modified)
- [x] `src/app/(dashboard)/users/[userId]/page.tsx` exists (modified)
- [x] `src/app/(dashboard)/users/[userId]/loading.tsx` exists (modified)
- [x] `src/app/(dashboard)/users/[userId]/actions.ts` exists (modified)
- [x] Commit `5a3a863` present in `git log`
- [x] Railway deployment `0165dd96-ca9e-446e-88fe-91d7ed90c965` in `SUCCESS` state
- [x] `npx tsc --noEmit` — 0 new errors in `src/`/`app/` (baseline 32 test-file errors unchanged)
- [x] All grep gates from plan `<done>` criteria pass
