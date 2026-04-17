---
phase: quick-260417-m3p
plan: 01
subsystem: budget-cron + admin-ui
tags: [cron, budget, refill, admin, parent, rename, ui, labels]
dependency_graph:
  requires:
    - "balances collection (LibreChat native)"
    - "cron_state observability (Phase 19-03)"
    - "src/lib/budget.ts topUpDailyBudget $max idiom"
  provides:
    - "Parents always have ≥1M tokenCredits after midnight UTC"
    - "admins_refilled counter in cron_state + response JSON"
    - "Consistent admin-nav→page heading: 'Usage Limits'"
  affects:
    - "daily-reset cron for all users (not just kids)"
    - "Admin sidebar /settings label"
    - "/settings page <h1>"
tech_stack:
  added: []
  patterns:
    - "$max atomic refill (reused from kids' topUpDailyBudget)"
    - "Role branching inside user loop (no double-query)"
    - "Upsert via $max (creates balances doc if missing — handles fresh parents)"
key_files:
  created: []
  modified:
    - src/lib/budget.ts
    - src/app/api/cron/daily-reset/route.ts
    - src/components/dashboard/nav-sidebar.tsx
    - src/app/(dashboard)/settings/page.tsx
decisions:
  - "ADMIN_REFILL_CREDITS = 1_000_000 (≈ $1 USD / €0.92) — finite ceiling prevents runaway drain"
  - "topUpAdminBudget uses $max (preserves manual top-ups above 1M)"
  - "No accumulation / no monthly cap for admins — untracked by design in v1"
  - "Deploy executed from /data/home/KidAI (Railway linked path); worktree files synced before `railway up`, reverted after — kidschat-admin service is NOT git-linked and CLI resolves project link via cwd-walk to the registered project path"
  - "Label rename ('Settings' → 'Usage Limits') covers nav + page h1 only; component identifiers (SettingsPage, SettingsForm, saveGlobalDefaults, etc.) and route path (/settings) unchanged"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-17"
  tasks: 3
  files_modified: 4
  lines_changed: 55
requirements:
  - M3P-A-PARENT-AUTOREFILL
  - M3P-B-NAV-RENAME
---

# Phase quick-260417-m3p Plan 01: Parents Auto-Refill + Usage Limits Rename Summary

Daily-reset cron now refills parents to a 1M-credit ceiling (via `$max`) alongside the existing kids' flow, plus renamed the admin sidebar `Settings` → `Usage Limits` so the nav label matches the page's actual scope (daily/monthly cost caps + per-child overrides).

## Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Auto-refill parents to 1M tokens in daily-reset cron | `bb69560` | budget.ts, daily-reset/route.ts |
| 2 | Rename admin nav 'Settings' → 'Usage Limits' | `5740b2f` | nav-sidebar.tsx, settings/page.tsx |
| 3 | Deploy + verify (no code commit) | — | (Railway deployment `f98054d0-eaf4-4fc2-af55-90f777a701a3`) |

## Changes

### Task 1 — Parent auto-refill (`bb69560`)

**`src/lib/budget.ts`:**
- Added `export const ADMIN_REFILL_CREDITS = 1_000_000` near conversion constants
- Added `export async function topUpAdminBudget(userId, db)` at module bottom:
  - `balances.updateOne({ user: ObjectId(userId) }, { $max: { tokenCredits: 1_000_000 } }, { upsert: true })`
  - No `accumulateYesterdaySpend`, no settings lookup, no monthly-cap gate (admins untracked in v1)

**`src/app/api/cron/daily-reset/route.ts`:**
- Import extended: `import { accumulateYesterdaySpend, topUpAdminBudget, topUpDailyBudget } from "@/lib/budget"`
- User query: removed `{ role: { $ne: "ADMIN" } }` filter; now fetches ALL users with `{ projection: { _id: 1, role: 1 } }`
- Loop branches on `user.role === "ADMIN"`:
  - ADMIN → `topUpAdminBudget`, increment `admins_refilled`
  - else → existing path (`accumulateYesterdaySpend` + `topUpDailyBudget`)
- `admins_refilled` added to completion log, `cron_state.lastRunStats`, and response JSON

### Task 2 — UI label rename (`5740b2f`)

- `src/components/dashboard/nav-sidebar.tsx:24` — `label: "Settings"` → `label: "Usage Limits"` (route `/settings` + lucide `Settings` icon unchanged)
- `src/app/(dashboard)/settings/page.tsx:150` — `<h1>Settings</h1>` → `<h1>Usage Limits</h1>`
- No identifier renames, no other string changes

### Task 3 — Deploy + Verify (no commit)

**Railway deployment:** `f98054d0-eaf4-4fc2-af55-90f777a701a3`
- Service: `kidschat-admin` (`83b7b7d1-76bd-4e99-8466-d2a1bf44f8d2`)
- Status: SUCCESS (2026-04-17 ~15:20 UTC)
- Note: First `railway up` from the worktree cwd built the old main-repo source (kidschat-admin is not git-linked; Railway CLI resolves the project link via cwd-walk to the registered path `/data/home/KidAI` and uploaded from there). Recovered by syncing the 4 modified files into `/data/home/KidAI`, running `railway up` from that path, then `git checkout --` reverting the 4 files in main repo after deploy succeeded. Worktree retains the authoritative commits.

**Cron trigger response:**
```json
{"reset":2,"accumulated":2,"admins_refilled":2,"errors":[]}
```

**Live balances (MongoDB `balances` collection, db `test`):**

| User | Role | Before | After | Expected |
| ---- | ---- | ------ | ----- | -------- |
| Manuel (`69cfd4ed…f4044c9e5e4c039a`) | ADMIN | 989,191 | 1,000,000 | ≥ 1,000,000 ✓ |
| Emily-Kate (`69cfd67f…f4044c9e5e4c03a7`) | ADMIN | (no doc) | 1,000,000 | ≥ 1,000,000 ✓ |
| Penelope (`69d03157…63d6125f1f553e98`) | USER | 543,478 | 543,478 | ≥ 543,478 AND < 1,000,000 ✓ |
| Sebastian (`69d03157…63d6125f1f553e97`) | USER | 543,478 | 543,478 | ≥ 543,478 AND < 1,000,000 ✓ |

**cron_state observability:**

| Field | Before | After |
| ----- | ------ | ----- |
| `lastRunAt` | 2026-04-17T06:37:38Z | 2026-04-17T15:20:16Z |
| `lastRunStats.reset` | 2 | 2 |
| `lastRunStats.accumulated` | 2 | 2 |
| `lastRunStats.admins_refilled` | (absent) | 2 |
| `lastRunStats.errors` | 0 | 0 |

## Verification

Truths from PLAN `must_haves.truths` (all passing):
- [x] Daily-reset cron processes both kids AND admins (no `$ne: ADMIN` skip)
- [x] Both parents have `balances.tokenCredits ≥ 1_000_000`
- [x] Both kids have `balances.tokenCredits ≥ 543_478` (eurToTokens(0.50))
- [x] Kids' tokenCredits are NOT bumped to 1M (regression guard — admin refill is admin-only)
- [x] Admin refill uses `$max` semantics (Manuel was at 989,191 and bumped up to 1,000,000; had he been at e.g. 5M from a prior top-up, he'd stay at 5M)
- [x] Admin sidebar nav label reads 'Usage Limits' instead of 'Settings' in production
- [x] Settings page `<h1>` reads 'Usage Limits' to match nav
- [x] `cron_state.daily_reset.lastRunStats` includes `admins_refilled` count alongside `reset`/`accumulated`/`errors`

Typecheck: zero NEW errors introduced (pre-existing `tests/lib/*` TS errors unchanged from 260417-kgn baseline; no errors on any of the 4 touched files).

## Deviations from Plan

### [Rule 3 - Blocking Issue] Worktree source not uploaded by initial `railway up`

**Found during:** Task 3 Step 1 (first deploy).

**Issue:** Running `railway up --service kidschat-admin --detach` from cwd `/data/home/KidAI/.claude/worktrees/agent-ad308b4c` produced a SUCCESSFUL deployment (`cb50a801-648a-4ab2-8f54-941e144c7d7c`), but the deployed code reflected the OLD main-repo state, not the worktree's new commits. Evidence: cron response returned `{"reset":2,"accumulated":2,"errors":[]}` with NO `admins_refilled` field.

**Root cause:** The kidschat-admin service is not git-linked (confirmed earlier in task 260417-kgn and re-confirmed via GraphQL `serviceInstances.source = { repo: null }`). Railway CLI resolves the project link by walking up from cwd until it finds a registered `projectPath` in `~/.railway/config.json`. The first match is `/data/home/KidAI`, so the upload tarball was built from THAT path — uploading the unchanged main-repo source, not the worktree's modified files.

**Fix:** Copied the 4 modified files (`src/lib/budget.ts`, `src/app/api/cron/daily-reset/route.ts`, `src/components/dashboard/nav-sidebar.tsx`, `src/app/(dashboard)/settings/page.tsx`) from the worktree into `/data/home/KidAI`, ran `railway up` from there (deployment `f98054d0-eaf4-4fc2-af55-90f777a701a3`, SUCCESS), then reverted the 4 files in main via `git checkout --` so the only authoritative source of the commits remains the worktree. Worktree retains both `bb69560` + `5740b2f` for orchestrator merge.

**Files modified:** none (deploy-sync only; reverted after success)

**Commit:** no commit (deploy-sync is ephemeral; the authoritative commits are on the worktree branch)

## Self-Check: PASSED

**Created files:**
- `.planning/quick/260417-m3p-parents-auto-refill-to-1m-ceiling-rename/260417-m3p-SUMMARY.md` — FOUND

**Commits present in worktree git log:**
- `bb69560` feat(260417-m3p): auto-refill parents to 1M tokens in daily-reset cron — FOUND
- `5740b2f` feat(260417-m3p): rename admin nav 'Settings' → 'Usage Limits' — FOUND

**Live verification:**
- Cron response contains `"admins_refilled":2` — FOUND
- Manuel + Emily-Kate at tokenCredits ≥ 1,000,000 — FOUND
- Penelope + Sebastian at tokenCredits ≥ 543,478 AND < 1,000,000 — FOUND
- cron_state.daily_reset.lastRunStats.admins_refilled === 2 — FOUND
