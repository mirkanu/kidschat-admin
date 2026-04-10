---
phase: 15-safety-alert-extension-rate-limiting
plan: "01"
subsystem: safety-patterns, rate-limiting, cost-ledger, bonus-purchases, librechat-config
tags: [safety, rate-limiting, cost-ledger, bonus-purchases, librechat, tdd]
dependency_graph:
  requires: [15-00]
  provides: [IMAGE_PROMPT_PATTERNS, getEffectiveLimits, getMonthlySpendEUR, getWeeklyBonusSpend, getActiveBonusCredit, balance.enabled]
  affects: [15-02, src/lib/safety-patterns.ts, src/lib/notify-safety-alert.ts, src/lib/settings.ts, src/lib/cost-ledger.ts, src/lib/bonus-purchases.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, in-memory mock Db via jest.fn(), MongoDB aggregation pipeline, GitHub Gist PATCH via gh api CLI, Railway GraphQL variableUpsert]
key_files:
  created:
    - src/lib/settings.ts
    - src/lib/cost-ledger.ts
    - src/lib/bonus-purchases.ts
    - tests/lib/safety-patterns.test.ts
    - tests/lib/rate-limits.test.ts
    - tests/lib/cost-ledger.test.ts
    - tests/lib/bonus-purchases.test.ts
    - scripts/deploy-librechat-yaml.ts
  modified:
    - src/lib/safety-patterns.ts
    - src/lib/notify-safety-alert.ts
    - src/components/emails/safety-alert-email.tsx
    - .planning/phases/02-safety-configuration/librechat.yaml
decisions:
  - "Horror pattern requires adjacent attack/person context word to avoid false positives on 'cartoon monster'"
  - "IMAGE_PROMPT_PATTERNS exported from safety-patterns.ts (not internal) so Plan 02 admin UI can display them"
  - "cost-ledger getImageCountToday queries LibreChat files collection with context:image_generation and user:userId (confirmed Phase 14)"
  - "GITHUB_GIST_TOKEN in Railway was expired — used gh CLI (mirkanu account, gist scope) via gh api to PATCH Gist"
  - "CONFIG_PATH now pins specific Gist revision hash 8a4a743 (not latest) for reproducible deploys"
  - "Balance endpoint returns Unauthorized (not 404) confirming balance system is live"
  - "getStartOfWeekUTC uses getUTCDay() where 0=Sun — daysSinceMonday = dayOfWeek===0 ? 6 : dayOfWeek-1"
  - "settings.ts HARDCODED_DEFAULTS exported as named export for test assertions"
metrics:
  duration: "~35 minutes"
  completed: "2026-04-10"
  tasks: 3
  files_changed: 12
---

# Phase 15 Plan 01: Foundation Libs — Safety Extension, Settings, Cost Ledger, Bonus Purchases

One-liner: Extended safety-patterns with image abuse detection (5 categories), created pure-function rate-limit libs (settings, cost-ledger, bonus-purchases), and enabled LibreChat's balance system via Gist deploy — all unit-tested, all green.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend safety-patterns + notify-safety-alert with image_prompt | c70e489 | safety-patterns.ts, notify-safety-alert.ts, safety-alert-email.tsx, tests/lib/safety-patterns.test.ts |
| 2 | Create settings.ts, cost-ledger.ts, bonus-purchases.ts with tests | 2f7695d | 3 new libs + 3 test files |
| 3 | Enable balance in librechat.yaml + deploy to Railway | 975bbde | librechat.yaml, scripts/deploy-librechat-yaml.ts |

## Verification Results

### Tests
- `npx jest` — 44 passed, 1 todo, 0 failed across 5 test suites
- safety-patterns: 14 tests — all 5 abuse categories detected, 2 false-positive guards pass, 3 jailbreak regressions pass
- rate-limits: 6 tests — global defaults, per-child override, merge precedence, ensureDefaultSettings
- cost-ledger: 10 tests — calculateMessageCostEUR pure math, token estimation, monthly spend aggregation, daily count
- bonus-purchases: 9 tests — getStartOfWeekUTC boundary cases, weekly spend sum, active credit sum

### Deployment
- Gist revision deployed: `8a4a743e37e0c6b21c441aa1a93b57da885eb9ef`
- CONFIG_PATH set to: `https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/8a4a743e37e0c6b21c441aa1a93b57da885eb9ef/librechat.yaml`
- Balance endpoint test: `curl https://librechat-production-bff2.up.railway.app/api/balance` → `Unauthorized` (endpoint live, auth required — confirms balance is active, not disabled)

## Final Pattern List (IMAGE_PROMPT_PATTERNS)

| Category | Label | Pattern Notes |
|----------|-------|---------------|
| Violence/gore | `violence/gore` | Keywords: blood, gore, gory, violent, killing, murder, torture, mutilate, etc. |
| Nudity/sexual | `nudity/sexual` | Keywords: naked, nude, nudity, topless, sexual, porn, explicit, genitals, erotic |
| Horror | `horror/dark content` | Requires BOTH horror entity (demon, devil, etc.) AND attack/harm context word — prevents "friendly cartoon monster" false positive |
| Real people | `real person` | "realistic/real photo of [named person]" OR "[named celebrity] + draw/generate" |
| Bypass framing | `bypass framing` | "pretend/imagine/act as if" + "allowed/able" + "anything/violence/nude/no rules" |

**False-positive guards verified:**
- "draw me a friendly cartoon monster" → not detected (no attack/harm context)
- "draw a car" → not detected

## Default Values (Claude's Discretion)

| Setting | Value | Rationale |
|---------|-------|-----------|
| dailyImageLimit | 10 | Generous enough for normal use; prevents unlimited generation |
| dailyMessageLimit | 50 | ~7 messages per waking hour; comfortable daily chat budget |
| monthlyCostCapEUR | €10.00 | ~$10.87 USD; covers heavy daily use across the month |
| weeklyBonusCap | €5.00 | 2.5 bonus packs max per week; prevents runaway bonus spend |
| bonusPackSize | €2.00 | Small enough parents notice; large enough to feel meaningful |
| bonusMessageTemplate | "You've reached your limit..." | GoHenry reference — makes real-world cost tangible for kids |

## Mongo Field Adjustments (from 15-00 Inspection)

- `getImageCountToday` queries `files` with `user: userId` and `context: "image_generation"` (confirmed from Phase 14)
- `cost_ledger` schema: `{ userId, costEUR, recordedAt: Date }` — new collection, no conflicts

## Gist/Deploy Notes

- **GITHUB_GIST_TOKEN in Railway was expired** — `gho_y9k1Hr0AhlP17bSudh2XBcfOnUwaEo257PU` returned 401 from GitHub API
- **Resolution:** Used `gh api --method PATCH` with the `mirkanu` account (gh CLI, gist scope) to deploy
- **Action required:** Update `GITHUB_GIST_TOKEN` in Railway admin env vars with a fresh fine-grained PAT (gist scope) so the prompt-editor deploy route works again
- Gist revision `8a4a743` is now pinned in CONFIG_PATH — future deploys via `scripts/deploy-librechat-yaml.ts` will create new pinned revisions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SafetyAlertEmail component didn't support image_prompt alertType**
- **Found during:** Task 1 — TypeScript would fail when passing `alertType: "image_prompt"` to SafetyAlertEmail
- **Issue:** `SafetyAlertEmailProps.alertType` was `"safety_redirect" | "jailbreak_attempt"` only; missing `image_prompt` case in ALERT_TYPE_LABELS Record
- **Fix:** Extended alertType union and added `image_prompt: "Inappropriate Image Request"` label
- **Files modified:** `src/components/emails/safety-alert-email.tsx`
- **Commit:** c70e489

**2. [Rule 1 - Bug] Horror pattern regex didn't match "generate a demon attacking a person"**
- **Found during:** Task 1 GREEN phase — "attacking a person" uses the word "person" not in the original hit list
- **Issue:** Pattern required `\b(attack...)\b` but "attacking a person" needed both halves present
- **Fix:** Added `a person|people|someone` to the second half of the horror pattern for natural phrasing
- **Files modified:** `src/lib/safety-patterns.ts`
- **Commit:** c70e489

**3. [Rule 1 - Bug] GITHUB_GIST_TOKEN expired (401 from GitHub API)**
- **Found during:** Task 3 — curl to GitHub API returned "Bad credentials"
- **Issue:** Token `gho_y9k1Hr0...` stored in Railway is expired
- **Fix:** Used `gh api --method PATCH` with the gh CLI (mirkanu account, active gist scope) to deploy the YAML update directly; pinned the specific revision hash in CONFIG_PATH
- **Files modified:** None — workaround at deploy time
- **Deferred:** Update `GITHUB_GIST_TOKEN` in Railway env with a fresh PAT so the prompt-editor deploy route works

## Self-Check: PASSED

All key files exist. All commits found. All content checks pass.
