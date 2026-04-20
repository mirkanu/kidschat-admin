---
phase: quick-260420-g6h
plan: 01
subsystem: scripts
tags: [librechat, cli, testing, sse, agents]
dependency_graph:
  requires: []
  provides: [scripts/chat-test.ts]
  affects: []
tech_stack:
  added: []
  patterns: [native-fetch, AbortController, SSE-streaming, env-file-manual-parse]
key_files:
  created:
    - scripts/chat-test.ts
  modified:
    - .env.local.example
decisions:
  - Chat endpoint is POST /api/agents/chat (not /api/ask/agents which returns 404 in v0.8.x)
  - Agent identity resolved via GET /api/agents (not /api/presets) — agents list has id + name
  - No dotenv import: .env.local parsed manually with fs.readFileSync to avoid new dep
  - Email masked in startup log (m***s@gmail.com); JWT and password never echoed
metrics:
  duration: ~15 min
  completed: 2026-04-20
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 1
---

# Phase quick-260420-g6h Plan 01: Headless LibreChat Chat-Test CLI Summary

**One-liner:** Single-file TypeScript CLI (`scripts/chat-test.ts`, 182 LOC) that authenticates against LibreChat, resolves a preset by name, streams SSE tool calls + final reply to stdout — zero new npm deps.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Confirm LibreChat auth + chat endpoint shapes | (probe, no commit) | /tmp/chat-test-probe.txt |
| 2 | Implement scripts/chat-test.ts + .env.local.example | 95b16ef | scripts/chat-test.ts, .env.local.example |

## Task 3: Awaiting Human Verify

**Status:** CHECKPOINT — awaiting human verification

**What to do:** Set `LIBRECHAT_TEST_PASSWORD` in `.env.local`, then run:
```
npx tsx scripts/chat-test.ts "Image Search" "origami cats"
npx tsx scripts/chat-test.ts "Chat" "say hello in one word"
```
See PLAN.md Task 3 `<how-to-verify>` for full expected output spec.

## Confirmed LibreChat v0.8.x API Contracts (Task 1 Findings)

| # | Finding |
|---|---------|
| a | **Auth:** `POST /api/auth/login` `{email, password}` → `{token, user}`. HTTP 404 on wrong email/password. |
| b | **Chat endpoint:** `POST /api/agents/chat` (Bearer token, SSE). `/api/ask/agents` returns **404** — does not exist in v0.8.x. |
| c | **Preset listing:** `GET /api/agents` → `{data:[{id, name, …}]}`. `/api/presets` also exists (returns 401) but agent listing preferred for agent_id resolution. |
| d | **SSE events:** `event:message` (streaming delta), `event:tool_call` (tool name/args/result), `event:final` (responseMessage.text), `data:[DONE]` sentinel. |

## Script Behaviour

- Missing args → usage + exit 1
- Missing env var → named error + exit 1
- Auth failure → `[ERROR] auth status=404 message=Incorrect password.` + exit 1
- Preset not found → lists available preset names + exit 1
- Tool calls printed as: `[TOOL] <name> args={…} result=<first 200 chars>`
- Output banners: `===== TOOL CALLS =====`, `===== ASSISTANT =====`, `===== END =====`
- 60s `AbortController` timeout per stage → `[TIMEOUT] <stage>` + exit 1
- Email masked to `m***s@gmail.com`; JWT and password never logged

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written with one minor note:

**Endpoint discovery confirmed plan assumption:** The plan listed `/api/ask/agents` as a possible path but noted it needed Task 1 probe verification. Probe confirmed `/api/ask/agents` returns 404; only `/api/agents/chat` exists. Implementation uses `/api/agents/chat` throughout, consistent with the plan's fallback note.

## Known Stubs

None — the script is fully wired. It will fail at runtime (exit 1 with clear message) until `LIBRECHAT_TEST_PASSWORD` is set in `.env.local`, which is by design (Task 3 checkpoint).

## Threat Flags

None — all T-g6h-0x mitigations implemented:
- T-g6h-01: email masked; JWT/password never logged
- T-g6h-02: .env.local gitignored (confirmed via .gitignore)
- T-g6h-04: AbortController 60s timeout on all three stages

## Self-Check

- [x] `scripts/chat-test.ts` exists and is 182 LOC
- [x] Commit 95b16ef exists
- [x] `.env.local.example` contains `LIBRECHAT_BASE_URL`
- [x] `package.json` diff shows zero new dependencies
- [x] Missing args → exit 1 with usage (verified)
- [x] Bad credentials → `[ERROR] auth status=404` + exit 1 (verified)
- [x] TypeScript strict compile: zero errors
