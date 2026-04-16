---
phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que
plan: 01
subsystem: infra
tags: [librechat, mongodb, railway, dalle, budget, tokens, gist]

requires:
  - phase: 19-research
    provides: Confirmed DALL-E tool schema adds ~2,580 tokens per turn; startBalance=10M bypasses daily cap; no maxContextTokens configured

provides:
  - librechat.yaml updated: maxContextTokens:8000 under endpoints.agents, startBalance:0, Drawing Studio preset added
  - 4 text agents (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal): tools:[] — DALL-E tool schema removed from text turns
  - Drawing Studio agent (agent_kidschat_drawing_1775634945891) created in MongoDB with tools:["dalle"]
  - LibreChat redeployed pointing at new Gist revision 3295aeb

affects: [phase-19-02, budget-enforcement, dalle-access, daily-cost-cap]

tech-stack:
  added: []
  patterns:
    - "Gist PATCH via GitHub REST API + Railway variableUpsert pattern for config updates"
    - "MongoDB $pull operator for removing specific array elements from agent tool lists"

key-files:
  created:
    - .planning/phases/19-.../19-01-GIST-BEFORE.yaml
    - .planning/phases/19-.../19-01-GIST-AFTER.yaml
    - .planning/phases/19-.../19-01-AUDIT.md
    - .planning/phases/19-.../19-01-DIFF.txt
    - .planning/phases/19-.../19-01-DEPLOY.md
    - .planning/phases/19-.../19-01-AGENT-EDITS.md
  modified:
    - "(external) Gist e23b999f1d3cd77726a97c20e26f0abf — new revision 3295aeb"
    - "(external) Railway LibreChat CONFIG_PATH — updated to 3295aeb hash"
    - "(MongoDB) agents collection — 4 text agents tools:[], Drawing Studio created"

key-decisions:
  - "DALL-E binding is at MongoDB agent level (not yaml level) — Task 3 (MongoDB $pull) was the correct fix, not yaml edit"
  - "Drawing Studio agent (agent_kidschat_drawing_1775634945891) did not exist in MongoDB; created in Task 2 with DALL-E tool as required for kids to retain drawing ability"
  - "maxContextTokens:8000 added under endpoints.agents (not per-preset) — LibreChat v1.3.7 supports it at endpoint level"
  - "startBalance changed to 0: new accounts start at 0 and daily cron sets proper cap on first run, closing $max bypass"

patterns-established:
  - "Drawing preset separation: text agents have tools:[], drawing agent has tools:['dalle'] — future agents should follow this pattern"

requirements-completed: []

duration: 35min
completed: 2026-04-16
---

# Phase 19 Plan 01: Remove DALL-E Overhead from Text Presets Summary

**DALL-E tool schema (~2,580 tokens) removed from all 4 text agent presets via MongoDB $pull; maxContextTokens:8000 added to librechat.yaml; startBalance fixed to 0; Drawing Studio agent created; LibreChat redeployed to new Gist revision 3295aeb**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-16T21:15:00Z (approx)
- **Completed (Tasks 1-3):** 2026-04-16T21:35:00Z (approx)
- **Tasks:** 3/4 (Task 4 is human UAT checkpoint — awaiting parent verification)
- **Files modified:** 6 planning files + 3 external resources (Gist, Railway CONFIG_PATH, MongoDB)

## Accomplishments

- Confirmed DALL-E binding is at MongoDB agent level (not yaml) — audit baseline captured in 19-01-GIST-BEFORE.yaml + 19-01-AUDIT.md
- Updated librechat.yaml: added `maxContextTokens: 8000` under `endpoints.agents`, changed `startBalance: 10000000` → `startBalance: 0`, added Drawing Studio preset; pushed to Gist as revision 3295aeb; updated Railway CONFIG_PATH; redeployed LibreChat
- Removed `dalle` from tools array of all 4 text agents in MongoDB (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal); created Drawing Studio agent with `tools: ["dalle"]`

## Task Commits

1. **Task 1: Baseline audit** — `0c9daab` (chore: fetch live Gist, confirm DALL-E at MongoDB agent level)
2. **Task 2: Push updated yaml, create Drawing Studio, redeploy** — `1033cac` (feat: new Gist revision + Railway redeploy)
3. **Task 3: Remove dalle from 4 text agents in MongoDB** — `5b89c0c` (feat: $pull dalle from text agent tools arrays)

**Plan metadata (checkpoint):** `[pending — will be added by continuation agent after Task 4 UAT]`

## Files Created/Modified

- `.planning/phases/19-.../19-01-GIST-BEFORE.yaml` — Baseline snapshot of live Gist before edits (hash 6955fe5)
- `.planning/phases/19-.../19-01-AUDIT.md` — Audit findings: DALL-E at MongoDB level, startBalance=10M confirmed, no maxContextTokens
- `.planning/phases/19-.../19-01-GIST-AFTER.yaml` — New yaml with maxContextTokens:8000, startBalance:0, Drawing Studio preset
- `.planning/phases/19-.../19-01-DIFF.txt` — Diff showing only 3 categories of change (no extra edits)
- `.planning/phases/19-.../19-01-DEPLOY.md` — Deploy record: NEW_HASH=3295aeb, redeploy timestamp 2026-04-16T21:31:39Z
- `.planning/phases/19-.../19-01-AGENT-EDITS.md` — MongoDB before/after snapshots for all 4 text agents
- `(external) Gist librechat.yaml` — New revision 3295aeb17d6ab47c867fc69dfedd2a632508f471
- `(external) Railway LibreChat CONFIG_PATH` — Updated to 3295aeb URL
- `(MongoDB) agents collection` — 4 text agents: tools:[], Drawing Studio agent created with tools:["dalle"]

## Decisions Made

- **DALL-E binding location:** Confirmed at MongoDB agent document level, not yaml level. Yaml has no `tools:` entries — all binding via `agent_id` refs to MongoDB. Task 3 (MongoDB $pull) was the correct remediation path.
- **Drawing Studio agent creation:** agent_kidschat_drawing_1775634945891 referenced in STATE.md did not exist in MongoDB. Created in Task 2 with drawing-focused system prompt and `tools: ["dalle"]`. Required for plan correctness — removing DALL-E from text agents without creating the drawing agent would leave kids with zero drawing capability.
- **maxContextTokens at endpoint level:** Added under `endpoints.agents` (not per-preset) since LibreChat v1.3.7 supports it there and it applies to all agents uniformly.
- **startBalance: 0:** Closing the $max bypass — new accounts now start at 0 and the daily cron's `topUpDailyBudget` correctly sets the cap on first run. Previously, `$max(10_000_000, 217_391)` was a no-op, leaving new accounts with 10M credits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Drawing Studio agent created in MongoDB**
- **Found during:** Task 1 (baseline audit)
- **Issue:** STATE.md references `agent_kidschat_drawing_1775634945891` as the Drawing Studio agent. MongoDB `agents` collection query returned only 5 documents — the 4 text presets + 1 stale test agent. The Drawing Studio agent does not exist. Plan acceptance criteria requires `grep -qE "Drawing Studio|agent_kidschat_drawing_1775634945891" 19-01-GIST-AFTER.yaml` to pass, and UAT requires drawing to still work. Without creating the agent, removing DALL-E from text agents would leave kids with no drawing ability.
- **Fix:** Created `agent_kidschat_drawing_1775634945891` in MongoDB with drawing-focused system prompt, `tools: ["dalle"]`, same model/provider as text agents. Added matching `drawing-studio` modelSpec to librechat.yaml.
- **Files modified:** MongoDB `agents` collection (new doc), 19-01-GIST-AFTER.yaml (Drawing Studio preset added)
- **Verification:** `db.agents.findOne({id: 'agent_kidschat_drawing_1775634945891'})` confirms `tools: ["dalle"]`; grep of yaml confirms agent_id and label present
- **Committed in:** `1033cac` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** Required for plan correctness. Without it, kids would lose ALL drawing access. No scope creep — strictly necessary.

## Issues Encountered

- Drawing Studio agent (agent_kidschat_drawing_1775634945891) referenced in STATE.md did not exist in MongoDB — resolved via Rule 2 auto-fix (see Deviations above)
- Railway CLI `railway variables --service librechat` returned "Service not found" — resolved by using Railway GraphQL API directly (same pattern as deploy route)

## User Setup Required

None — all changes were automated (Gist PATCH, Railway variableUpsert, MongoDB $pull, serviceInstanceRedeploy).

## Next Phase Readiness

**Task 4 UAT (human checkpoint) still pending.** Parent must:
1. Send a 3-word text question via Friendly Tutor preset — verify cost is well below ~6,000 credits (expect ~2,000–2,500 prompt credits)
2. Send a drawing request via Drawing Studio preset — verify image is generated
3. Send 10 short messages in one conversation — verify prompt tokens plateau around maxContextTokens=8000
4. (Optional) Create new account — verify starting balance is 0

After UAT approval, the plan is complete.

---
*Phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que*
*Completed: 2026-04-16 (Tasks 1-3 done; Task 4 UAT pending)*
