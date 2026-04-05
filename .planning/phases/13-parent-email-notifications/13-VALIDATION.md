---
phase: 13
slug: parent-email-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) + `tsx` |
| **Config file** | None — invoked directly via CLI |
| **Quick run command** | `npx tsx --test src/lib/__tests__/email-templates.test.ts` |
| **Full suite command** | `npx tsx --test src/lib/__tests__/*.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx --test src/lib/__tests__/email-templates.test.ts`
- **After every plan wave:** Run `npx tsx --test src/lib/__tests__/*.test.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | NOTIFY-01 | unit | `npx tsx --test src/lib/__tests__/email-templates.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | NOTIFY-02 | unit | `npx tsx --test src/lib/__tests__/email-templates.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | NOTIFY-02 | unit | `npx tsx --test src/lib/__tests__/weekly-digest.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | NOTIFY-04 | unit | `npx tsx --test src/lib/__tests__/weekly-digest.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 2 | NOTIFY-05 | unit | `npx tsx --test src/lib/__tests__/weekly-digest.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | NOTIFY-03 | manual | Manual Railway deploy + check exit code | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/email-templates.test.ts` — covers NOTIFY-01 and NOTIFY-02 (template rendering smoke tests)
- [ ] `src/lib/__tests__/weekly-digest.test.ts` — covers NOTIFY-02, NOTIFY-04, NOTIFY-05 (aggregation shape + notification record schema)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway cron executes weekly | NOTIFY-03 | Cannot automate Railway cron schedule | Deploy cron service, check Railway logs for successful execution and process exit 0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
