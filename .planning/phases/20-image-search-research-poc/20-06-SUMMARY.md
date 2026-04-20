---
phase: 20
plan: 06
status: complete
completed: 2026-04-20
---

# Plan 20-06 — Decision Lock + Phase Close — SUMMARY

**Outcome:** Phase 20 closed. 10 architectural decisions locked in `20-DECISIONS.md`. `CONFIG_PATH` revert intentionally skipped (replaced by ACL-gating per parent directive).

## What was done

1. **`20-DECISIONS.md` written** — 10 numbered decisions (D-1 through D-10) covering provider, tool mechanism, click-through policy, preset surface, pagination, output layout, content safety rule set, defense-in-depth, rollout gate, and config-path handling. Each decision carries its rationale ("Why") and constraint for future phases.
2. **Phase 21 scope locked** — 6 concrete tasks derived directly from the decisions + UAT caveats.
3. **Phase 22 scope locked** — 2 tasks (Test Mode parity + daily-summary enrichment).
4. **CONFIG_PATH intentionally NOT reverted** (D-10). Parent directive post-UAT: kids are ACL-gated (D-9 — already executed in 20-UAT.md work), so the extra redeploy churn provides no additional safety. Production Gist stays byte-identical at `6bf08d0e…` and is one command away if ever needed.
5. **Artifacts catalogued** — MCP service, dev Gist, agent doc + ACLs, test user, headless CLI — all survive Phase 20 and are Phase 21 inputs.

## Deviations from the original plan

- **CONFIG_PATH revert dropped** per parent decision after seeing that ACL-gating achieves the same "kids can't see Image Search" outcome without requiring two more redeploys.
- **Per-child policy simplified to single rule set** (D-7) — the Q13 breastfeeding caveat from 20-UAT.md was resolved by parent directive: "whatever's blocked for Sebastian is blocked for Penelope." This removes a significant Phase 21 complexity.
- **Adversarial UAT ran in-session** — originally plan 20-05 C-3 deferred these; the parent chose to run them via Telegram in the same UAT session once the CLI delivery mechanism was proven. All 5 categories reviewed, all approved.

## Must-haves — final status

| # | Truth | Verdict |
|---|-------|---------|
| 1 | 20-DECISIONS.md contains a numbered decision for every input Phase 21 needs | ✓ (10 decisions) |
| 2 | Each decision cites the evidence that produced it (UAT finding, research finding, parent directive) | ✓ |
| 3 | Phase 21 can start with zero architectural questions pending | ✓ |
| 4 | Production kids' LibreChat experience is restored (either via CONFIG_PATH revert OR ACL revocation) | ✓ (ACL path, D-9) |
| 5 | Dev Gist + MCP service + agent doc remain functional for Phase 21 iteration | ✓ |

## Next

Phase 21 — Image Search production rollout (v2.9).
