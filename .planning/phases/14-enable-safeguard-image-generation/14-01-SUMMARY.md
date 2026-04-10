---
phase: 14-enable-safeguard-image-generation
plan: 01
subsystem: infra
tags: [dalle3, librechat, agents, image-generation, openai, railway]
status: complete
completed: 2026-04-10
---

# Phase 14 Plan 01 — Enable & Safeguard Image Generation

## Goal
DALL-E 3 working in LibreChat with child-appropriate guardrails.

## What was built

Every tone preset (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal) is now an **agent** powered by Claude Haiku 4.5 + the DALL-E-3 tool. Children can ask any preset to draw without switching models. Generated images render in the admin Conversation History view so parents can see what their kids have seen.

### Final Architecture

- **4 agents** in LibreChat MongoDB (one per tone), each with:
  - Provider: `anthropic`, Model: `claude-haiku-4-5`
  - Tools: `["dalle"]`
  - Instructions: safety core + drawing cost-awareness + tone-specific voice
  - ACL entries: owner (Manuel) + viewer (all other users)
- **`librechat.yaml` modelSpecs** — 4 presets all using `endpoint: "agents"` with the respective `agent_id`
- **Railway env vars (LibreChat service):**
  - `DALLE3_API_KEY` — real OpenAI key (same value as `OPENAI_API_KEY`)
  - `DALLE3_SYSTEM_PROMPT` — child-safe prompt guidance
  - `OPENAI_API_KEY` — set from placeholder to real key (required for agents endpoint init)
  - `ENDPOINTS=anthropic,agents,openAI` (was `anthropic` only)
  - `BAN_VIOLATIONS=false`, `LOGIN_MAX=999`, `LOGIN_WINDOW=1` — prevents lockouts during automation
- **`librechat.yaml` config changes:**
  - `endpoints.agents.capabilities: ["tools"]` — enables DALL-E tool in agent builder
  - `interface.agents` — `{use: true, create: false, share: false, public: false}` (locked down)
- **Admin dashboard:**
  - `conversations/[conversationId]/page.tsx` — extracts image `attachments` from messages
  - `message-thread.tsx` — renders `<img>` tags inline below AI messages using LibreChat's public `/images/` URLs

### Drawing behaviour

Agents are instructed to **always clarify before drawing** (subject details, art style, scene, mood) in one message, to avoid wasted $0.04 DALL-E calls. If a child types "draw me a car", the agent first asks "what kind of car, what style, where is it?" before generating.

### Safety layers

1. **System prompt pre-filter** — each agent's instructions refuse violence/horror/immodest/real people drawings
2. **DALL-E 3 built-in content filter** — OpenAI's backstop
3. **Rate limiting** — deferred to Phase 15 (not in this plan)

## Files modified

- `.planning/phases/02-safety-configuration/librechat.yaml` — agents endpoint config, 4 agent-backed modelSpecs
- `src/app/(dashboard)/conversations/[conversationId]/page.tsx` — image attachment extraction
- `src/components/dashboard/message-thread.tsx` — inline image rendering
- `src/middleware.ts` — restored (temp `fix-agent` bypass removed)

## Railway env changes (LibreChat service)

- `DALLE3_API_KEY` — set
- `DALLE3_SYSTEM_PROMPT` — set
- `OPENAI_API_KEY` — fixed (was placeholder `"user_provided"`)
- `ENDPOINTS` — `anthropic,agents,openAI`
- `BAN_VIOLATIONS` — `false`
- `LOGIN_MAX` — `999`
- `LOGIN_WINDOW` — `1`

## MongoDB state (LibreChat `test` DB)

- `agents` collection:
  - `agent_wxgt6su7d3pcosiil3` → Friendly Tutor
  - `agent_y4w1cvoyg77p9thed9` → Casual Buddy
  - `agent_64q6z5s57552cpgl0hr` → Balanced Helper
  - `agent_aiv99mzvdzquym6y89k` → Standard Formal
  - (Also `agent_F6ITBo7EuorE7vqrXsNAm` — the original UI-created "Image Generator" test agent; can be cleaned up later)
- `aclentries` collection — each new agent has 5 entries (author owner + remoteAgent owner + 3 user viewers)
- `systemgrants` collection — `use:agents` and `read:agents` granted to USER role

## User verification (all passed)

- [x] All 4 presets appear in the model selector
- [x] Text chat works with each preset using the correct tone
- [x] Drawing request in any preset triggers clarifying questions first
- [x] After clarification, DALL-E generates a wholesome image
- [x] Inappropriate drawing requests are refused warmly
- [x] No "Create Agent" option visible to users
- [x] Generated images appear in the admin Conversation History view

## Lessons learned / pain points

1. **LibreChat has no public API for creating agents** — must use the UI or direct MongoDB insertion with full schema replication (author + ACL entries per user)
2. **`OPENAI_API_KEY` placeholder `"user_provided"` breaks the agents endpoint** even if you only use DALL-E (the agent itself needs a valid OpenAI provider to init)
3. **`ENDPOINTS` env var must include every provider you want available** — `anthropic,agents,openAI` (note camelCase for OpenAI)
4. **`capabilities: ["tools"]` must be explicit** under `endpoints.agents` or DALL-E doesn't appear in the agent tool list
5. **`CONFIG_PATH` points to a pinned Gist revision** (with commit hash) — must be updated after each YAML change
6. **`BAN_VIOLATIONS=true` causes 2-hour account bans** from rapid login attempts during automation; disable for dev/testing
7. **`railway up` while linked to wrong service overwrites it** — once accidentally deployed admin dashboard to LibreChat service, had to restore via GraphQL `serviceInstanceUpdate` mutation to reset the Docker image source
8. **`provider` field casing matters** — use lowercase `anthropic` to match the endpoint name
9. **Permission migration required message is not just cosmetic** — LibreChat won't display agents without proper ACL entries (owner for author, viewer for each other user)
