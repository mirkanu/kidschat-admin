# Phase 19 Plan 01 — Deploy Record

**Deployed:** 2026-04-16T21:31:39Z

---

## Gist Update

- **GIST_ID:** `e23b999f1d3cd77726a97c20e26f0abf`
- **OLD_HASH (BEFORE):** `6955fe5460029748740069165ace7a056ab8b008`
- **NEW_HASH (AFTER):** `3295aeb17d6ab47c867fc69dfedd2a632508f471`

## New CONFIG_PATH

```
https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/3295aeb17d6ab47c867fc69dfedd2a632508f471/librechat.yaml
```

HTTP 200 confirmed: `curl -sI <NEW_CONFIG_PATH>` returned `HTTP/2 200`

## Railway Updates

- **CONFIG_PATH updated on LibreChat service:** Railway `variableUpsert` mutation → `{"data":{"variableUpsert":true}}`
- **LibreChat redeployed:** `serviceInstanceRedeploy` → `{"data":{"serviceInstanceRedeploy":true}}`
- **Redeploy timestamp:** `2026-04-16T21:31:39Z`

## Changes in This Deploy

### (A) maxContextTokens cap
- Added `maxContextTokens: 8000` under `endpoints.agents` in librechat.yaml
- Prevents conversation history from compounding unbounded

### (B) startBalance fix
- Changed `startBalance: 10000000` to `startBalance: 0`
- New accounts now start at 0 credits; daily cron's `topUpDailyBudget` sets the correct daily cap on first run
- Prevents `$max(10_000_000, 217_391)` no-op bypass

### (C) Drawing Studio preset added to yaml
- Added 5th modelSpec `drawing-studio` pointing to `agent_kidschat_drawing_1775634945891`
- Drawing Studio MongoDB agent CREATED (was missing — see 19-01-AUDIT.md)
- Drawing Studio agent has `tools: ["dalle"]`

### (D) DALL-E removal from text presets
- DALL-E binding is at MongoDB agent level (not yaml level — see 19-01-AUDIT.md Appendix A)
- Task 3 (MongoDB edit) handles the removal from the 4 text agents

## MongoDB Changes

### Drawing Studio Agent Created
- **agent_id:** `agent_kidschat_drawing_1775634945891`
- **MongoDB _id:** `ObjectId('69e154d5dbb800a024236665')`
- **tools:** `["dalle"]`
- **Created:** `2026-04-16T21:29:57.425Z`

## Expected Impact (after Task 3 removes DALL-E from text agents)
- Text-only turns: ~1,900–2,200 credits (down from ~4,494) — ~50% reduction in prompt cost
- Drawing turns: still available via Drawing Studio preset only
- New accounts: start at 0 credits, properly gated by daily cron
- Long conversations: capped at 8,000 context tokens, preventing runaway history compounding
