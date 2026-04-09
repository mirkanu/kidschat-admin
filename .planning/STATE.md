---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: "Completed quick task 9: Hide AdminChatWidget on /test-mode page on mobile"
last_updated: "2026-04-09T21:19:06.951Z"
last_activity: "2026-04-06 — Completed quick task 8: Make Last 24 Hours boxes on admin dashboard clickable links"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
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
Last activity: 2026-04-09 — Completed quick task 9: Chat bubble overlaps Send button on mobile Test Mode page

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
- [Phase 13-parent-email-notifications]: Lazy import for resend in weekly-digest route — prevents build failure when RESEND_API_KEY absent
- [Phase 13-parent-email-notifications]: formatDigestStats extracted as pure function for unit testability without live MongoDB
- [Phase 13-parent-email-notifications]: notification_prefs.weeklyDigest !== false semantics: null/undefined means opted-in (default true)
- [Phase 13-parent-email-notifications]: Resend client uses lazy Proxy pattern — RESEND_API_KEY check deferred to call time so next build succeeds without the env var
- [Phase 13-parent-email-notifications]: Core notification logic in src/lib/notify-safety-alert.ts — server components call directly instead of internal fetch() to own API routes (anti-pattern)
- [Phase 13-parent-email-notifications]: email_notifications collection dedup: compound query on meta.conversationId + meta.matchedPattern + sentAt within 1 hour window
- [Phase 13-parent-email-notifications]: Notification page uses direct MongoDB query (server component) — consistent with rest of project
- [Phase 13-parent-email-notifications]: NotificationPrefsToggle uses native checkbox — Switch component not installed in shadcn ui folder
- [Phase 13-parent-email-notifications]: /api/notify/* excluded from auth middleware — routes use cron-secret header auth, not session cookies
- [Phase 14-enable-safeguard-image-generation]: Drawing agent created directly in MongoDB (agent_id: agent_kidschat_drawing_1775634945891) due to LibreChat rate-limit ban during setup
- [Phase 14-enable-safeguard-image-generation]: interface.agents uses object form {use:true, create:false, share:false, public:false} — not boolean true (deprecated in LibreChat v0.7.5+)
- [Phase 14-enable-safeguard-image-generation]: DALL-E 3 only: DALLE3_API_KEY set, DALLE2_API_KEY intentionally absent. ENDPOINTS updated to 'anthropic,agents'

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
| 3 | Blank AI response bubbles in conversations (text in content[] not text field) | 2026-04-05 | 65ba689 | [3-fix-blank-ai-response-bubbles](./quick/3-fix-blank-ai-response-bubbles-in-convers/) |
| 4 | Markdown rendering for AI responses in conversations, test mode, chatbot | 2026-04-05 | 34d9b1c | [4-markdown-rendering](./quick/4-enable-markdown-rendering-for-ai-respons/) |
| 5 | Fix mobile padding — responsive shell + remove double padding from pages | 2026-04-05 | 0ac31f9 | [5-fix-mobile-padding](./quick/5-fix-mobile-padding-on-admin-pages/) |
| 6 | Add prominent link to kid-facing frontend on admin Test Mode page | 2026-04-06 | 6bebd65 | [6-add-prominent-link-to-frontend-on-admin-](./quick/6-add-prominent-link-to-frontend-on-admin-/) |
| 7 | Disable Temporary Chat button on LibreChat frontend (fixed YAML parse error) | 2026-04-06 | f7f5fa9 | [7-disable-temporary-chat-button-on-librech](./quick/7-disable-temporary-chat-button-on-librech/) |
| 8 | Make Last 24 Hours boxes on admin dashboard clickable links | 2026-04-06 | bd0007b | [8-make-last-24-hours-boxes-on-admin-dashbo](./quick/8-make-last-24-hours-boxes-on-admin-dashbo/) |
| Phase 13-parent-email-notifications P02 | 22 | 2 tasks | 5 files |
| Phase 13-parent-email-notifications P01 | 25 | 2 tasks | 9 files |
| Phase 13-parent-email-notifications P03 | 13 | 2 tasks | 9 files |
| Phase 13-parent-email-notifications P03 | 45 | 3 tasks | 10 files |
| Phase 14-enable-safeguard-image-generation P01 | multi-session | 3 tasks | 1 files |
| 9 | Chat bubble overlaps Send button on mobile Test Mode page | 2026-04-09 | 7eeee8d | [9-on-mobile-on-the-test-mode-admin-page-th](./quick/9-on-mobile-on-the-test-mode-admin-page-th/) |

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 12 prerequisite: `GITHUB_GIST_TOKEN` must be added to Railway env before Phase 12 testing can begin (fine-grained PAT, Gist scope only)
- Phase 12 design decision needed during planning: rollback storage — new `prompt_history` collection vs. field on existing document

## Session Continuity

Last session: 2026-04-09T21:19:06.947Z
Stopped at: Completed quick task 9: Hide AdminChatWidget on /test-mode page on mobile
Resume file: None
