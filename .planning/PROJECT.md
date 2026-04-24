# KidsChat — Family AI Chat App

## What This Is

A private, self-hosted AI chat application for two children (Sebastian, 14; Penelope, 12), deployed on Railway using LibreChat. The app provides a safe, parent-controlled interface to Claude Haiku 4.5 with enforced content boundaries rooted in Reformed Christian family values. Each child has their own account with separate chat history and six switchable presets: four tone-based conversation modes, a Drawing Studio (DALL-E 3), and an Image Search preset backed by a custom Openverse MCP service. Parents have full oversight through a dedicated admin dashboard with conversation logs, usage analytics, safety alerts (including image-prompt and image-query abuse detection), transparent safety rules, an embedded test mode, automated email alerts (safety events, daily summaries, weekly digests, account activity) configurable per-recipient, and per-child daily/monthly cost caps and daily image-search count caps with one-click top-ups.

## Core Value

Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.

## Requirements

### Validated

- ✓ LibreChat deployed on Railway via Lite template, accessible at public URL — v1.0
- ✓ Registration closed — only manually created accounts can log in — v1.0
- ✓ Social login disabled — v1.0
- ✓ Claude Haiku 4.5 is the only available model (no model picker visible) — v1.0
- ✓ Safety system prompt enforced on all conversations — v1.0
- ✓ Content boundaries: Reformed theology alignment, no profanity, age-appropriate, anti-cheating — v1.0
- ✓ Tone presets: Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal — v1.0
- ✓ Two child accounts created and tested (Sebastian, Penelope) — v1.0
- ✓ System prompt resilient to basic jailbreak attempts — v1.0
- ✓ librechat.yaml hosted as GitHub Gist, referenced via CONFIG_PATH — v1.0
- ✓ Two admin accounts with conversation oversight capability — v1.0
- ✓ Admin web dashboard deployed on Railway with auth gate — v2.0
- ✓ Conversation log viewer with search, child filtering, and full message threads — v2.0
- ✓ User management CRUD (create, edit, delete accounts) from dashboard — v2.0
- ✓ Usage statistics: messages/day, active hours, tone preset usage with per-child breakdown — v2.0
- ✓ Safety alert detection: redirection and jailbreak pattern matching with event log — v2.0
- ✓ Trust-focused dashboard home with safety status, activity digest, recent alerts, quick links — v2.1
- ✓ Safety Rules page with parent-friendly summary and expandable full system prompt — v2.1
- ✓ Parent test mode: embedded chat sandbox with predefined safety scenario buttons — v2.1
- ✓ Safety detection badges showing which rule triggered in real-time — v2.1
- ✓ Users page bug fixed (was showing 0 users) — v2.1

- ✓ AI admin chatbot (Claude Sonnet 4.6) with streaming, context-aware, UNTRUSTED framing — v2.2
- ✓ Rules editor with AI review, test sandbox, Gist deploy, rollback, Safety Rules auto-sync — v2.2
- ✓ Cost tracking with per-model estimates, 30-day trend, Anthropic billing link — v2.2
- ✓ LibreChat redeploy trigger from admin dashboard — v2.2
- ✓ Markdown rendering for AI responses — v2.2
- ✓ Real-time safety alert emails via Resend with 1-hour dedup — v2.3
- ✓ Weekly activity summary emails per child with Railway cron scheduling — v2.3
- ✓ Notification history page and email preference toggles — v2.3

- ✓ DALL-E 3 image generation enabled in LibreChat via Agents endpoint on all 4 tone presets — v2.4
- ✓ Child-appropriate system prompt guardrails for image generation (no realistic people, no violence, age-appropriate) — v2.4
- ✓ Image-prompt abuse detection patterns wired into `detectSafetyEvent` → parent email alerts — v2.4
- ✓ Per-child daily/monthly cost caps enforced via LibreChat-native `balances.tokenCredits` — v2.4
- ✓ Admin settings UI for global defaults + per-child cap overrides — v2.4
- ✓ Real-time monthly spend tracking (live month-to-date including today's in-progress spend) — v2.4
- ✓ Monthly cap actually enforces (v2.4 gap closure — was a no-op pre-15.4) — v2.4
- ✓ One-click parent "Top up €0.10" button on `/users/{childId}` with `useTransition` pending state and sonner toast — v2.4
- ✓ LibreChat's native red "Insufficient Funds" block handles the 0-balance hard stop (no custom chat-thread injections) — v2.4

- ✓ MCP server UI disabled — kids cannot add arbitrary tool-running servers — v2.5
- ✓ Agent Marketplace disabled — kids cannot browse or install community agents — v2.5
- ✓ 4 distinct preset icons (graduation-cap, smile, scale-3d, briefcase) — v2.5
- ✓ Conversation delete protection — MongoDB restricted user blocks `remove` on conversations + messages at DB level — v2.6
- ✓ Preset icons visible on dark sidebar (Iconify light gray SVGs) — v2.6
- ✓ DALL-E image persistence across LibreChat redeploys (Railway Volume + RAILWAY_RUN_AS_ROOT) — v2.6
- ✓ Notification recipients decoupled from admin accounts — both parents receive alerts without admin login — v2.7
- ✓ Configurable Notifications Settings page with tabbed History + Settings, recipient manager with per-alert-type toggles — v2.7
- ✓ Daily summary emails (per-child 24h stats, green theme) sent at 8am UTC via Railway cron — v2.7
- ✓ Account activity alerts auto-triggered on login and recipient changes (amber theme, 5-min dedup) — v2.7
- ✓ 4 distinct email alert types with colored badges in notification history (red/blue/green/amber) — v2.7

- ✓ DALL-E tool schema removed from 4 text agent presets (~2,580 tokens/turn saved) — v2.8
- ✓ maxContextTokens=8000 cap on agents endpoint prevents conversation-history compounding — v2.8
- ✓ startBalance=0 closes the 10M-token-per-new-user loophole — v2.8
- ✓ Drawing Studio preset introduced as the single DALL-E-enabled agent (Clean text/image separation) — v2.8
- ✓ Daily cap raised €0.20 → €0.50; SYSTEM_PROMPT_TOKENS corrected 400 → 3290 so admin cost estimates reflect real agent overhead — v2.8
- ✓ Railway daily-reset cron pipeline restored via 3 dedicated cron services; cron_state.daily_reset.lastRunAt observability prevents future silent failures — v2.8
- ✓ 2MB image-size guardrail (serverFileSizeLimit) caps blast radius of upload-driven token drains — v2.8
- ✓ Parents auto-refill to 1M tokens via daily-reset cron; preset-aware guidance tells kids to switch presets for image vs text — v2.8

- ✓ Custom Openverse MCP image-search service deployed to Railway (kidschat-image-search-mcp); 7-regex query blocklist, 10-host domain blocklist, server-side /proxy hotlink fallback — v2.9
- ✓ "Image Search" LibreChat preset live for Penelope and Sebastian; inline image grid with no click-through links, no AI commentary — v2.9
- ✓ Per-child daily image-search count cap (default 20) enforced at MCP boundary; admin /settings UI override with same pattern as daily cost cap — v2.9
- ✓ Safety patterns extended with blocklist-aligned categories; image-search queries run through existing detectSafetyEvent → parent email alert pipeline — v2.9
- ✓ Admin /conversations shows Image Search sessions with "Image Search" preset badge (conversations.spec field) — v2.9
- ✓ Daily-summary email enriched with per-kid "Image searches: N" + Haiku-paraphrased query topic summary; raw queries stripped from email HTML and audit doc — v2.9

### Active

- [ ] **TESTMODE-01**: Test Mode exposes all 6 presets (4 text + Drawing Studio + Image Search) — deferred from v2.9 (Phase 22 dropped)
- [ ] **TESTMODE-02**: Test Mode executes selected preset with tool parity (DALL-E for Drawing Studio, Openverse for Image Search) — deferred from v2.9
- [ ] **TESTMODE-03**: Test Mode parity UAT — parent side-by-side verification before deploying preset changes — deferred from v2.9

### Out of Scope

- Custom domain — Railway-provided URL is sufficient
- Per-child different system prompts — same safety rules for both
- RAG, embeddings — not needed for children's chat
- Mobile app — browser access is sufficient
- Real-time push notifications — email alerts cover this need now
- Modifying LibreChat config from dashboard — config lives in GitHub Gist
- ML-based safety detection — text pattern matching sufficient for now

## Context

Shipped v2.9 on 2026-04-24. Eleven milestones complete (v1.0 through v2.9).
- **LibreChat URL:** https://librechat-production-bff2.up.railway.app
- **Admin Dashboard URL:** https://kidschat-admin-production.up.railway.app
- **Image Search MCP URL:** https://kidschat-image-search-mcp.up.railway.app
- **Config Gist (production):** b0c89395 (D-21-A — dev Gist anointed as prod; CONFIG_PATH unchanged)
- **Stack:** LibreChat + Next.js 15 admin dashboard + custom MCP service, MongoDB, Meilisearch on Railway
- **Admin dashboard stack:** Next.js 15, NextAuth v5, Tailwind CSS v3, shadcn/ui, Recharts, Anthropic SDK (Haiku + Sonnet), Resend + React Email, react-markdown, MongoDB direct queries, DALL-E 3 via agents endpoint
- **MCP stack:** Node.js/TypeScript, Openverse anonymous API, custom blocklist/proxy/quota-client modules
- **Accounts:** 4 total (2 ADMIN parents, 2 USER children) + 6 agent presets (4 text, Drawing Studio, Image Search)
- **Cost enforcement:** Native LibreChat `balances.tokenCredits` — `budget.ts` lib handles EUR↔tokens conversion, Railway crons reset daily/monthly, admin UI for per-child cap overrides, one-click parent top-up
- **Search enforcement:** `search_counters` MongoDB collection, `image-search-quota.ts`, daily-reset cron bolt-on, admin /settings override
- **Tests:** ~80 passing across 8 suites (65 pre-v2.9 + image-search-quota, budget-search-cap, image-search-summary)
- **Known limitation:** LibreChat v0.8.4 has outdated config schema warnings (non-blocking)
- **Known limitation:** Safety detection uses text pattern matching — may have false positives/negatives
- **Known limitation:** Openverse `mature=false` not explicit in MCP URL — relies on anonymous-tier default (SEARCH-03 tech debt)
- **Tech debt from v2.4:** Phase 14 has no VERIFICATION.md; stale LibreChat `agent_F6ITBo7EuorE7vqrXsNAm` test agent never cleaned up; duplicate MongoDB query logic between `alerts/page.tsx` and `/api/alerts/route.ts`
- **Tech debt from v2.9:** Phase 21 has no VERIFICATION.md; SEARCH-02 live hit-rate not re-sampled post-rollout; TESTMODE-01/02/03 deferred

## Constraints

- **Platform**: Railway deployment
- **Model**: Claude Haiku 4.5 only — cost-effective for children's usage
- **Auth**: No registration, no social login — admin-created accounts only
- **Content**: Must align with Reformed Christian family values
- **Config**: librechat.yaml hosted as GitHub Gist for easy editing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LibreChat over custom app | Proven UI, user management, preset support — no need to build from scratch | ✓ Good |
| Claude Haiku 4.5 | Cost-effective, fast, sufficient quality for children's conversations | ✓ Good |
| GitHub Gist for config | Easy to edit without redeploying, version history built-in | ✓ Good — requires redeploy to pick up changes |
| Tone presets (not per-child prompts) | Kids choose their experience; safety rules are universal | ✓ Good |
| Railway CLI for all ops | Automate everything, no manual dashboard steps | ✓ Good |
| Database name is "test" | Railway template default, not configurable without migration | ⚠️ Revisit — works but non-obvious |
| Safety prompt as identity | Frame rules as AI's values, not external constraints — better jailbreak resistance | ✓ Good |
| Separate Next.js dashboard | Decoupled from LibreChat — independent deploy, own auth, direct MongoDB | ✓ Good |
| Server components query MongoDB directly | Avoids self-referencing fetch auth issues in production | ✓ Good |
| Recharts for analytics | Lightweight, composable, Tailwind-compatible charting | ✓ Good |
| Text pattern matching for safety | No ML dependency, detects common patterns, fast | ⚠️ Revisit — may need ML for better accuracy |
| Direct Anthropic API for test mode | Dashboard calls Claude directly, not through LibreChat — simpler, admin-only | ✓ Good |
| Hardcoded system prompt in dashboard | Rarely changes, avoids Gist fetch complexity — update manually when prompt changes | ✓ Good — single source in system-prompt.ts |
| Resend for email | Modern API, React Email templates, generous free tier (3k/month) | ✓ Good — using onboarding@resend.dev for now, needs domain verification |
| Railway cron for weekly digest | Native Railway feature, no external dependencies | ✓ Good — daily-notifications cron in railway.toml |
| Notification recipients decoupled from users | Both parents receive alerts without admin accounts, ADMIN fallback for backward compat | ✓ Good (v2.7) |
| Railway.toml config-as-code for all crons | daily-reset, monthly-reset, daily-notifications — no dashboard clicks | ✓ Good (v2.7) |
| Lazy Resend proxy singleton | Avoids build failures when RESEND_API_KEY not set | ✓ Good — build-safe pattern |
| DALL-E 3 via LibreChat Agents endpoint (not custom integration) | Leverages existing agent infrastructure, no new API client, safety rules already in agent system prompts | ✓ Good (v2.4) |
| LibreChat-native `balances.tokenCredits` for cost caps (vs custom cost_ledger) | Single source of truth, LibreChat's built-in hard block when depleted, no shadow accounting | ✓ Good after 15.3 teardown — the original custom layer in 15-04 was over-engineered |
| Synthetic message injection for warnings/offers | Tried 5 approaches (direct insert, React Query invalidation, agent system-prompt injection) — all failed live UAT render | ✗ Abandoned in 15.3 — LibreChat's React Query cache doesn't refetch on external writes |
| `$max` for daily cap refill (vs `$set`) | Atomic preservation of parent top-ups above daily cap — one-line MongoDB operator | ✓ Good (v2.4 — 15.4 fix) |
| Monthly cap enforcement at daily-cron refill gate (not per-request) | No new middleware; when exhausted, daily refill becomes no-op → next midnight the child starts at 0 → native block takes over | ✓ Good (v2.4 — 15.4 design) |
| Deferred gap closure via decimal phases (15.2, 15.3, 15.4) | Rather than rework failed phase 15.2 in place, tear down + rebuild cleanly in 15.3, then close audit gaps in 15.4 | ✓ Good — honest delivery + clean git history |
| MongoDB restricted user for delete protection (v2.6) | Database-level `remove` block on conversations + messages — no LibreChat fork, no middleware, unkillable from client | ✓ Good — pivot from archive-cron approach after user rejected 5-min delay |
| Gist-hosted librechat.yaml with commit-pinned CONFIG_PATH | Config edits via `gh gist edit` + Railway env var pointing to commit-pinned URL avoids CDN cache staleness | ✓ Good — established pattern in v2.5/v2.6 |
| RAILWAY_RUN_AS_ROOT for volume permissions | LibreChat Docker image runs as non-root; Railway Volume mounts as root-owned | ✓ Good — solves EACCES on image writes, acceptable security trade-off for a private family app |
| DALL-E tool schema on Drawing Studio only (not all 4 text presets) | Tool schema adds ~2,580 tokens/turn even when unused; separating text/image presets reclaims the daily budget | ✓ Good (v2.8) — single biggest cost win in the milestone |
| Dedicated Railway cron services (one per schedule) | Consolidated multi-cron service had silent failures; isolating each cron makes failures visible and recoverable | ✓ Good (v2.8) — also added `cron_state.daily_reset.lastRunAt` observability |
| 194k-credit drain left classified as "D (unknown)" rather than forced to a root cause | Forensic evidence was inconclusive; manufacturing a narrative would mislead future debugging — defensive guardrails (image-size limit, context cap) shrink blast radius regardless | ✓ Good (v2.8) — honest uncertainty over false closure |
| $max operator for daily auto-refill | Preserves parent top-ups above daily allowance; atomic, one-line MongoDB operator | ✓ Good (v2.8 reconfirmed) — renamed UI "Daily cap" → "Daily allowance" to match $max-floor semantics |
| Openverse over Brave/Google CSE for image search | Google CSE deprecated for whole-web search + 403s at project level; Brave required paid key; Openverse is free, CC-licensed, anonymous-tier SafeSearch sufficient | ✓ Good (v2.9) — zero API cost, kid-safe content |
| Custom MCP server over LibreChat built-in web_search | MCP gives full control over blocklist, proxy, quota at tool boundary; LibreChat web_search has no kid-safety hooks | ✓ Good (v2.9) — defense-in-depth at the right layer |
| Option iii click-through policy (no source links) | Kids see inline images only; no navigation to source sites; proxy strips foreign_landing_url and url at MCP boundary | ✓ Good (v2.9) — zero click-through risk without LibreChat fork |
| Dev Gist anointed as production (D-21-A) | Pivoting away from Google/Brave mid-POC created a dev Gist; promoting it avoids a CONFIG_PATH swap and a production redeploy just to rename | ✓ Good (v2.9) — clean; old prod Gist archived |
| search_counters collection (not reuse balances) | Search cap is a count (not EUR), resets daily independently of monthly cost cap; separate collection avoids polluting budget semantics | ✓ Good (v2.9) |
| TESTMODE-01/02/03 deferred to v3.0 | Phase 22 dropped by parent decision after Phase 21 shipped; Test Mode parity is desirable but not blocking kid-facing Image Search | — Pending (v3.0 candidate) |

---
*Last updated: 2026-04-24 after v2.9 milestone completion*
