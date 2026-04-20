---
gsd_state_version: 1.0
milestone: v2.9
milestone_name: Kid Image Search + Test Mode Preset Parity
status: executing
stopped_at: Completed 20-01-PLAN.md (kidschat-image-search-mcp live on Railway)
last_updated: "2026-04-20T11:27:58.149Z"
last_activity: 2026-04-20 -- Phase 20 execution started
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 6
  completed_plans: 4
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.
**Current focus:** Phase 20 — image-search-research-poc

## Current Position

Phase: 20 (image-search-research-poc) — EXECUTING
Plan: 1 of 6
Status: Executing Phase 20
Last activity: 2026-04-20 -- Phase 20 execution started

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
- [Phase 15-safety-alert-extension-rate-limiting]: IMAGE_PROMPT_PATTERNS exported from safety-patterns.ts; horror pattern requires adjacent attack/person context to avoid cartoon-monster false positives
- [Phase 15-safety-alert-extension-rate-limiting]: settings.ts HARDCODED_DEFAULTS: dailyImageLimit=10, dailyMessageLimit=50, monthlyCostCapEUR=10, weeklyBonusCap=5, bonusPackSize=2
- [Phase 15-safety-alert-extension-rate-limiting]: CONFIG_PATH pins specific Gist revision 8a4a743 for reproducible deploys; GITHUB_GIST_TOKEN in Railway is expired and needs refresh
- [Phase 15-safety-alert-extension-rate-limiting]: balances collection is plural (not balance) — all Plan 01/02 code uses db.collection('balances')
- [Phase 15-safety-alert-extension-rate-limiting]: aclentries use principalId (not user) and resourceId is MongoDB ObjectId — must resolve agent _id before ACL query
- [Phase 15-safety-alert-extension-rate-limiting]: tokenCount is flat integer — cost ledger must apply char-formula for input/output split billing
- [Phase 15-safety-alert-extension-rate-limiting]: Synthetic message VERDICT: GO — admin-inserted messages render in LibreChat child UI; Pattern 8 bonus offer delivery is viable
- [Phase 15-safety-alert-extension-rate-limiting]: Two-tier locking: ACL entry removal (daily/soft) + tokenCredits=0 (monthly/hard); hard lock also calls lockImageAccess for belt-and-suspenders
- [Phase 15-safety-alert-extension-rate-limiting]: awaitingBonusConfirmation state stored in settings override_{userId} doc — avoids new collection
- [Phase 15-safety-alert-extension-rate-limiting]: Railway cron schedules require manual dashboard configuration — no CLI/GraphQL API support available
- [Phase 15-safety-alert-extension-rate-limiting]: serviceInstanceRedeploy reuses cached Docker image — must use railway up for fresh source builds
- [Phase 15-safety-alert-extension-rate-limiting]: Navigation fix: child name rows in /users list link to /users/{userId} — admin rows unchanged (no detail page for admins)
- [Phase 15-safety-alert-extension-rate-limiting]: Per-child overrides broken + schema rework pending: dailyImageLimit+dailyMessageLimit to be replaced by dailyCostCapEur in gap-closure phase 15.1
- [Phase 15-safety-alert-extension-rate-limiting]: Railway MongoDB is standalone (error 40573): change streams NOT supported, Plan 15-04 uses 60s setInterval polling in instrumentation.ts instead
- [Phase 15-safety-alert-extension-rate-limiting]: instrumentation.ts register() fires at Next.js 15 startup in ~850ms — no experimental flag needed, viable as in-process polling host
- [Phase 15-safety-alert-extension-rate-limiting]: LibreChat native balance display confirmed visible to children ('Balance: 10,000,000' in Settings); Plan 15-05 supplements with threshold synthetic messages, not a custom UI
- [Phase 15-safety-alert-extension-rate-limiting]: Original Path B (/api/cron/tick with CRON_SECRET) superseded by in-process setInterval — simpler, no HTTP hop, no new Railway service for the tick loop
- [Phase 15-safety-alert-extension-rate-limiting]: Path chosen: instrumentation.ts + 60s setInterval polling (change streams unavailable — locked by 15-03)
- [Phase 15-safety-alert-extension-rate-limiting]: budget.ts replaces cost-ledger.ts + enforcement.ts: native tokenCredits as single source of truth
- [Phase 15-safety-alert-extension-rate-limiting]: railway.toml config-as-code for daily-reset + monthly-reset crons (no dashboard clicks)
- [Phase 15-safety-alert-extension-rate-limiting]: Migration run via temporary API endpoint (Railway internal MongoDB not accessible externally via railway run)
- [Phase 15.2]: Option 7 validated: agent delivered probe marker verbatim; field path is agents.instructions not model_options.system; query key is {id: agentId}
- [Phase 15.2]: uuid@9 used (not v13) because v13 is ESM-only and breaks ts-jest
- [Phase 15.3-simplification]: LibreChat native "Insufficient Funds" hard block replaces all custom 70% warning + bonus offer + YES-confirmation flow; parent top-up is manual one-click €0.10 from admin UI
- [Phase 15.3-simplification]: ~~balance_state.monthlySpendEur is a dead field never incremented~~ — RESOLVED in Phase 15.4 by `accumulateYesterdaySpend()` in daily-reset cron (verified live 2026-04-17: Penelope €0.50, Sebastian €0.36)
- [Phase 15.3-simplification]: instrumentation.ts polling loop deleted; no setInterval listener at Next.js startup
- [Phase 15.4]: $max operator chosen for daily refill: atomic, one-line, no schema change — preserves parent top-ups above dailyCap
- [Phase 15.4]: displayedMonthlySpendEur = stored monthlySpendEur + today's partial spend (live view); DB truth only written at midnight UTC via $inc
- [Phase 15.4]: Monthly cap enforcement choke point is daily-reset cron at midnight UTC; topUpDailyBudget gates on displayedMonthlySpendEur >= monthlyCostCapEur
- [Phase 16-interface-hardening]: HARDEN-DELETE-01 accepted as limitation — LibreChat v0.8.4 config has no role-scoped chat delete suppression; delete still present and hard-deletes from MongoDB. CRITICAL follow-up: HARDEN-DELETE-02
- [Phase 16-interface-hardening]: RAILWAY_RUN_AS_ROOT=true required on LibreChat Railway service for Volume mount write access (image generation EACCES fix)
- [Phase 16-interface-hardening]: Gist config push requires CONFIG_PATH update to new commit hash after every push — old pinned hash fetches stale config on redeploy
- [Phase 17-conversation-delete-protection-icon-fix]: Approach D (periodic snapshot cron) rejected by parent — "5 minute delay not good enough"; replaced with MongoDB permission-based blocking
- [Phase 17-conversation-delete-protection-icon-fix]: Iconify Design API with ?color=%23e2e8f0 provides light-colored SVGs — no Gist hosting required for icon fix
- [Phase 17-conversation-delete-protection-icon-fix]: customCSS NOT in LibreChat v0.8.x schema — CSS delete button hide skipped to avoid ZodError
- [Phase 17-conversation-delete-protection-icon-fix]: MongoDB roles are strictly additive (no deny rules) — must enumerate every collection explicitly; wildcards cannot be used to restrict specific collections
- [Phase 17-conversation-delete-protection-icon-fix]: librechat_safe MongoDB user — find/insert/update on conversations+messages; full readWrite on all 35 other collections; LibreChat MONGO_URI updated and redeployed
- [Phase 17-conversation-delete-protection-icon-fix]: Railway internal MongoDB accessible externally via switchyard.proxy.rlwy.net:57501 (TCP proxy) — discovered via Railway GraphQL API v2
- [Phase 18]: notification_recipients collection decoupled from users — both parents receive alerts without admin accounts
- [Phase 18]: ADMIN-user fallback in senders ensures backward compat until recipients are configured
- [Phase 18]: Green header for daily summary, orange for account activity — four distinct email color themes
- [Phase 18]: Account activity alerts opt-in only (no ADMIN fallback); Railway cron runs daily, weekly-digest self-skips on non-Mondays
- [Phase 20]: Openverse is the sole image-search provider (Google CSE dropped; Amendment B). Custom MCP server at services/image-search-mcp/ deployed to Railway as kidschat-image-search-mcp.
- [Phase 20]: Option-iii click-through policy enforced at the MCP tool boundary (openverse.ts strips foreign_landing_url and url), not at the agent prompt layer.
- [Phase 20]: railway up --path-as-root <subdir> is the working pattern for monorepo-subdirectory deploys; RAILWAY_ROOT_DIRECTORY env var is NOT recognized by Railway.

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
| 10 | Fix tech debt + clear chat history for fresh Monday launch | 2026-04-12 | — | [10-fix-tech-debt-and-clear-chat-history-for](./quick/10-fix-tech-debt-and-clear-chat-history-for/) |
| 11 | Fix Phase 18 verification gaps: notification badges + activity wiring | 2026-04-12 | a587b32 | [11-fix-phase-18-verification-gaps-notificat](./quick/11-fix-phase-18-verification-gaps-notificat/) |
| 260417-afs | Fix broken Railway cron authentication — wrap startCommand in sh -c so $CRON_SECRET expands | 2026-04-17 | 544971e | [260417-afs](./quick/260417-afs-fix-broken-railway-cron-authentication-w/) |
| 260417-cs0 | Preset-aware guidance — kids told to switch presets for image vs text to save tokens ✓ UAT passed | 2026-04-17 | 99a19b3 | [260417-cs0](./quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/) |
| 260417-kgn | Rename "Daily cap/limit" UI labels → "Daily allowance" to match $max-floor refill semantics | 2026-04-17 | c6f11ef | [260417-kgn](./quick/260417-kgn-rename-daily-cap-limit-ui-labels-to-matc/) |
| 260417-m3p | Parents auto-refill to 1M tokens via daily-reset cron + rename nav "Settings" → "Usage Limits" | 2026-04-17 | 5740b2f | [260417-m3p](./quick/260417-m3p-parents-auto-refill-to-1m-ceiling-rename/) |
| 260417-njb | Consolidate per-child Usage & Limits (bars + top-up) into /settings; remove from /users/{id} | 2026-04-17 | 5a3a863 | [260417-njb](./quick/260417-njb-consolidate-per-child-usage-limits-into-/) |
| 260417-p94 | Daily-summary email overhaul: drop image-requests/presets-used; add Alerts + Haiku 4.5 paraphrased per-kid summary | 2026-04-18 | fdd5a92 | [260417-p94](./quick/260417-p94-daily-summary-email-overhaul-drop-image-/) |
| 260420-g6h | Headless LibreChat chat-test CLI — Claude can drive any preset end-to-end without a browser (JWT + 2-step SSE + tool-call capture) | 2026-04-20 | 950901c | [260420-g6h](./quick/260420-g6h-headless-librechat-chat-test-cli-for-end/) |
| Phase 15-safety-alert-extension-rate-limiting P01 | 35 | 3 tasks | 12 files |
| Phase 15-safety-alert-extension-rate-limiting P00 | 35 | 4 tasks | 10 files |
| Phase 15-safety-alert-extension-rate-limiting P02 | 70 | 4 tasks | 21 files |
| Phase 15-safety-alert-extension-rate-limiting P04 | 63 | 4 tasks | 19 files |
| Phase 15.4-cost-cap-alert-contract-fixes P01 | 15 | 5 tasks | 6 files |
| Phase 17-conversation-delete-protection-icon-fix P01 | 44 | 2 tasks | 10 files |
| Phase 18 P01 | 6 | 2 tasks | 4 files |
| Phase 18 P03 | 5 | 2 tasks | 8 files |
| Phase 20 P01 | 35 | 3 tasks | 8 files |

### Roadmap Evolution

- Phase 18 added: Email Alert System — transactional email service for automated parent notifications
- Phase 19 added: Investigate why kids' 20c/day budget exhausts after 2-3 questions — audit full cost pipeline (LibreChat tokenCredits vs eurToTokens conversion, conversation-history compounding, agent-preset system-prompt sizes, LibreChat config multipliers)
- Phase 20 added: Image Search — Research + POC (v2.9) — pick tool mechanism, provider, hotlink mitigation, Test Mode architecture; stand up staging POC
- Phase 21 added: Image Search — Production rollout (v2.9) — kid-facing preset, domain blocklist, search-count cap, oversight, UAT
- Phase 22 added: Test Mode preset parity (v2.9) — admin-facing all-6-preset selector with tool parity + daily-summary email enrichment

### Pending Todos

1 pending — see `.planning/todos/pending/`. Most recent:

- **Set up Resend custom domain for multi-recipient email delivery** (2026-04-18) — Emily-Kate alerts disabled until done; daily-summary cron only sends to Manuel

### Blockers/Concerns

- Phase 20 has real open tech questions (search provider, tool mechanism, Test Mode architecture) — decisions must be resolved before Phase 21/22 can commit to an implementation
- Phase 12 prerequisite: `GITHUB_GIST_TOKEN` must be added to Railway env before Phase 12 testing can begin (fine-grained PAT, Gist scope only)
- Phase 12 design decision needed during planning: rollback storage — new `prompt_history` collection vs. field on existing document

## Session Continuity

Last session: 2026-04-18T23:51:17.158Z
Stopped at: Completed 20-01-PLAN.md (kidschat-image-search-mcp live on Railway)
Resume file: None
