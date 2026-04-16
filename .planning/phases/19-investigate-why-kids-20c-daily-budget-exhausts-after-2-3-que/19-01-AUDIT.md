# Phase 19 Plan 01 — Baseline Audit

**Audited:** 2026-04-16
**Task:** Baseline capture before DALL-E removal / maxContextTokens / startBalance edits

---

## Current CONFIG_PATH (LibreChat service, pre-plan)

```
https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/6955fe5460029748740069165ace7a056ab8b008/librechat.yaml
```

- **Gist ID:** `e23b999f1d3cd77726a97c20e26f0abf`
- **Pinned commit hash (BEFORE):** `6955fe5460029748740069165ace7a056ab8b008`
- **Config URL pattern:** `gist.githubusercontent.com/mirkanu/{GIST_ID}/raw/{hash}/librechat.yaml`

---

## Grep Findings on 19-01-GIST-BEFORE.yaml

| Pattern | Result | Notes |
|---------|--------|-------|
| `tools:\|dalle` | **NOT FOUND** | No `tools:` or `dalle` entries anywhere in the yaml — confirms DALL-E binding is at MongoDB agent level, NOT yaml level |
| `maxContextTokens` | **NOT FOUND** | No context cap configured — confirms research Area 2 finding (unbounded history compounding) |
| `contextStrategy` | **NOT FOUND** | No context strategy configured |
| `startBalance:\s*10000000` | **FOUND** (line 102) | `startBalance: 10000000` confirmed — this is the loophole identified in Open Question #4 |

---

## ModelSpecs / Agents Currently Using DALL-E Tool

The yaml file uses `agent_id` references to MongoDB agent documents. There are **no** `tools:` arrays in the yaml itself. All DALL-E tool bindings are stored in the MongoDB `agents` collection.

### MongoDB agents collection (live query result):

| Agent ID | Name | tools field |
|----------|------|-------------|
| `agent_wxgt6su7d3pcosiil3` | KidsChat Friendly Tutor | `["dalle"]` |
| `agent_y4w1cvoyg77p9thed9` | KidsChat Casual Buddy | `["dalle"]` |
| `agent_64q6z5s57552cpgl0hr` | KidsChat Balanced Helper | `["dalle"]` |
| `agent_aiv99mzvdzquym6y89k` | KidsChat Standard Formal | `["dalle"]` |
| `agent_F6ITBo7EuorE7vqrXsNAm` | Image Generator (stale test agent) | `["dalle"]` |

**Drawing Studio agent (`agent_kidschat_drawing_1775634945891`):** Does NOT exist in MongoDB agents collection yet. Only 5 agents found total (4 text presets + 1 stale test agent). The Drawing Studio agent must be created as part of Task 2/3.

---

## Appendix A: DALL-E Binding Location Analysis

**Conclusion: DALL-E is bound at MongoDB agent level, NOT yaml level.**

Evidence:
- Grep of 19-01-GIST-BEFORE.yaml for `tools:` or `dalle` returns zero matches
- The 4 modelSpec presets in the yaml only specify `endpoint: "agents"` and `agent_id: "<id>"` — no `tools:` field at all
- Live MongoDB query confirmed: each of the 4 text agent documents has `tools: ["dalle"]`

**Implication:** Task 2 yaml edits cannot remove DALL-E from text presets (there is nothing to remove at yaml level). Task 2 will:
1. Add `maxContextTokens: 8000` to the `endpoints.agents` section
2. Change `startBalance: 10000000` to `startBalance: 0`
3. Add a new 5th modelSpec "Drawing Studio" pointing to a new agent_id that will have `tools: ["dalle"]`

**Task 3 must perform the MongoDB edit** to remove `dalle` from the 4 text agent documents.

---

## Additional Finding: Drawing Studio Agent Does Not Exist

STATE.md references `agent_id: agent_kidschat_drawing_1775634945891` as the Drawing Studio agent. However, this agent does NOT exist in the MongoDB `agents` collection. The collection only has the 4 text presets + 1 stale test agent.

**Action required:** Task 2 must:
1. Create a new Drawing Studio agent in MongoDB with `tools: ["dalle"]`
2. Add a Drawing Studio modelSpec to the yaml pointing to it

This is required for correctness — without a Drawing Studio agent, removing DALL-E from the 4 text agents would leave kids with NO drawing capability at all.
