---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Admin Intelligence
status: planning
stopped_at: Completed 12-02-PLAN.md (awaiting checkpoint human-verify Task 3)
last_updated: "2026-04-05T15:42:16.540Z"
last_activity: 2026-04-05 — v2.2 roadmap created, Phase 10 ready
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.
**Current focus:** v2.2 Admin Intelligence — Phase 10: Cost Tracking

## Current Position

Phase: 10 of 12 (Cost Tracking)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-04-05 — v2.2 roadmap created, Phase 10 ready

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**v1.0:** 10 plans, 1 day
**v2.0:** 8 plans, 2 days
**v2.1:** 6 plans, 1 day

## Accumulated Context

### Decisions

- MongoDB database name is "test" (Railway template default)
- LibreChat URL: https://librechat-production-bff2.up.railway.app
- Admin Dashboard URL: https://kidschat-admin-production.up.railway.app
- Server components query MongoDB directly (not self-referencing fetch)
- Test mode calls Anthropic API directly (not through LibreChat)
- System prompt shared via src/lib/system-prompt.ts (single source of truth)
- [Phase 10-cost-tracking]: GET /api/cost-estimate: Sonnet count hardcoded to 0 for Phase 11 admin chatbot placeholder
- [Phase 10-cost-tracking]: Cost API daily trend counts ALL messages; monthly Haiku count filters non-ADMIN users via conversation lookup
- [Phase 10-cost-tracking]: CostSummaryCard uses inline formatUSD to avoid importing server-only module in client component
- [Phase 10-cost-tracking]: Analytics page cost section gracefully degrades to null when /api/cost-estimate fetch fails
- [Phase 11-admin-chatbot]: recentAlertCount is 0 — safety alerts are client-side pattern-matches, not stored in MongoDB
- [Phase 11-admin-chatbot]: Streaming admin chat returns new Response(stream.toReadableStream()) — plain Response, not NextResponse wrapper
- [Phase 11-admin-chatbot]: Child conversation logs in admin chatbot context truncated to 500 chars per message to manage context window
- [Phase 11-admin-chatbot]: AdminChatWidget uses z-40, stays below Sheet sidebar (z-50) on mobile
- [Phase 11-admin-chatbot]: Chat widget context fetched once on first open and cached in state (no re-fetch per message)
- [Phase 11-admin-chatbot]: Session-only message history in AdminChatWidget — resets on unmount, no persistence
- [Phase 12-prompt-editor]: Deploy route saves full YAML to prompt_history before Gist PATCH for byte-perfect rollback
- [Phase 12-prompt-editor]: app_config.active_prompt sync in deploy is non-fatal — log error but don't fail the deploy
- [Phase 12-prompt-editor]: Review response JSON parsing strips markdown code fences before parse attempt
- [Phase 12-prompt-editor]: Server component wraps MongoDB query in try/catch and silently falls back to SYSTEM_PROMPT — avoids crashes during first-deploy scenario

### v2.2 Architecture Decisions (from research)

- Cost estimates use token formula, not flat per-message rate: `(system_prompt_tokens + input_chars/4) * $0.000001 + (output_chars/4) * $0.000005`
- Chatbot context fetched once on widget open (not per-message) via `/api/admin-chat/context`
- All child log content framed as UNTRUSTED in chatbot system prompt (OWASP LLM01:2025)
- Gist token stored as `GITHUB_GIST_TOKEN` (no `NEXT_PUBLIC_` prefix), never in client bundle
- Use REST API for Gist PATCH — not `gh gist edit` (incompatible with fine-grained PATs, Issue #7803)
- Pre-deploy rollback: save current Gist content to MongoDB before every deploy

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | UI broken on mobile, menu stuck and consuming 80% width | 2026-04-04 | 2f4db60 | [1-ui-broken-on-mobile](./quick/1-ui-broken-on-mobile-menu-stuck-and-consu/) |
| 2 | Admin conversation pages crash with SyntaxError (HTML parsed as JSON) | 2026-04-04 | 7ebf0a0 | [2-fix-admin-conversation-page-server-error](./quick/2-fix-admin-conversation-page-server-error/) |
| Phase 10-cost-tracking P01 | 12 | 2 tasks | 3 files |
| Phase 10-cost-tracking P02 | 3 | 2 tasks | 2 files |
| Phase 11-admin-chatbot P01 | 4 | 2 tasks | 3 files |
| Phase 11-admin-chatbot P02 | 7 | 2 tasks | 3 files |
| Phase 12-prompt-editor P01 | 15 | 2 tasks | 5 files |

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 12 prerequisite: `GITHUB_GIST_TOKEN` must be added to Railway env before Phase 12 testing can begin (fine-grained PAT, Gist scope only)
- Phase 12 design decision needed during planning: rollback storage — new `prompt_history` collection vs. field on existing document

## Session Continuity

Last session: 2026-04-05T15:42:03.092Z
Stopped at: Completed 12-02-PLAN.md (awaiting checkpoint human-verify Task 3)
Resume file: None
