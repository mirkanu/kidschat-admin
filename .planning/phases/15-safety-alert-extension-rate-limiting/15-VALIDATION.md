---
phase: 15
slug: safety-alert-extension-rate-limiting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (via Next.js built-in test runner) |
| **Config file** | `package.json` `"test"` script (Wave 0 sets up if missing) |
| **Quick run command** | `npm test -- --testPathPattern=safety-patterns` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds for quick, ~60 seconds for full |

---

## Sampling Rate

- **After every task commit:** `npm test -- --testPathPattern=<relevant>` (e.g. safety-patterns, rate-limits, cost-ledger)
- **After every plan wave:** `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke tests for enforcement
- **Max feedback latency:** ~60 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-00-01 | 00 | 0 | — | infra | `npm test` sanity | ❌ W0 | ⬜ pending |
| 15-00-02 | 00 | 0 | — | manual DB verify | `db.balance.findOne()` etc. | n/a | ⬜ pending |
| 15-01-01 | 01 | 1 | IMG-SAFETY-01..04 | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | IMG-LIMITS-01,02 | unit | `npm test -- --testPathPattern=rate-limits` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | IMG-LIMITS-03 | unit | `npm test -- --testPathPattern=cost-ledger` | ❌ W0 | ⬜ pending |
| 15-01-04 | 01 | 1 | IMG-LIMITS-04 | unit | `npm test -- --testPathPattern=bonus-purchases` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | IMG-ENFORCE-01 | manual smoke | n/a — Railway MongoDB + LibreChat verify | n/a | ⬜ pending |
| 15-02-02 | 02 | 2 | IMG-ENFORCE-02 | manual smoke | n/a — LibreChat UI preset visibility | n/a | ⬜ pending |
| 15-02-03 | 02 | 2 | IMG-BONUS-01 | unit | `npm test -- --testPathPattern=weekly-digest` | ❌ W0 | ⬜ pending |
| 15-02-04 | 02 | 2 | IMG-BONUS-02 | unit + manual | bonus confirm polling test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 is its own plan (`15-00-PLAN.md`) covering test infrastructure and live MongoDB inspection before any enforcement code is written.

- [ ] `package.json` — add Jest + `@types/jest` + `ts-jest` if not present
- [ ] `jest.config.js` — Next.js-compatible config
- [ ] `tests/lib/safety-patterns.test.ts` — stubs for safety pattern tests
- [ ] `tests/lib/rate-limits.test.ts` — stubs for effective-limit resolver
- [ ] `tests/lib/cost-ledger.test.ts` — stubs for ledger aggregation
- [ ] `tests/lib/bonus-purchases.test.ts` — stubs for weekly bonus aggregation
- [ ] `tests/api/weekly-digest.test.ts` — stubs for weekly digest with bonus section
- [ ] **Live MongoDB inspection** (admin dashboard one-shot script):
  - [ ] `db.balance.findOne()` — confirm field name (`tokenCredits` vs `credit`)
  - [ ] `db.aclentries.findOne()` — confirm field shape (`user` vs `principalId`, `resource` vs `resourceId`)
  - [ ] `db.messages.findOne({isCreatedByUser: false})` — check whether `tokenCount` exists; if not, use char-formula fallback
  - [ ] `db.files.find({context: "image_generation"}).limit(3)` — confirm per-child scoping via `user` field
  - [ ] **Synthetic message insertion test** — insert a test admin message directly into `messages` collection; verify LibreChat UI renders it to the child

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ACL removal hides preset | IMG-ENFORCE-02 | Requires live LibreChat UI | Set a test child's image count to over-limit; verify "KidsChat" presets disappear from selector |
| `balance.tokenCredits: 0` hard-locks replies | IMG-ENFORCE-01 | Requires live LibreChat API | Write `tokenCredits: 0` to balance for a test child; verify chat returns error |
| Synthetic admin message renders in chat | IMG-BONUS-02 | Requires live LibreChat UI | Insert synthetic message into `messages` collection; verify it appears in child's chat view |
| "YES" polling credits bonus | IMG-BONUS-02 | Requires live cron + MongoDB | Simulate a child hitting limit → agent message inserted → child types "YES" → verify bonus credit applied within 30s |
| Weekly digest includes bonus totals | IMG-BONUS-01 | Requires live Resend + cron trigger | Trigger weekly digest manually; verify email body has "Bonus purchased: €X" line per child |
| Settings page edits persist | IMG-ADMIN-01 | Requires live admin UI | Edit default daily image limit via admin settings page; verify MongoDB updated and next enforcement run picks it up |
| Daily limit reset at midnight UTC | IMG-ENFORCE-03 | Time-based, requires cron | Trigger daily-reset cron manually; verify ACL entries restored for previously-locked children |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or manual verify instructions
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (infra + unit tests cover all Plan 01 tasks)
- [ ] Wave 0 covers all MISSING references (Jest setup + MongoDB inspection)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 60s (unit tests) + manual smoke for enforcement
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 complete

**Approval:** pending (Wave 0 must complete first)
