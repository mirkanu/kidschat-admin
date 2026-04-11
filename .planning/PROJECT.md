# KidsChat — Family AI Chat App

## What This Is

A private, self-hosted AI chat application for two children (Sebastian, 14; Penelope, 12), deployed on Railway using LibreChat. The app provides a safe, parent-controlled interface to Claude Haiku 4.5 with enforced content boundaries rooted in Reformed Christian family values. Each child has their own account with separate chat history and four switchable conversation tone presets that can generate DALL-E 3 images on demand. Parents have full oversight and trust through a dedicated admin dashboard with conversation logs, usage analytics, safety alerts (including image-prompt abuse detection), transparent safety rules, an embedded test mode to verify safety boundaries firsthand, email notifications for safety events and weekly activity summaries, and per-child daily/monthly cost caps with one-click top-ups.

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

### Active

(None — planning next milestone)

### Out of Scope

- Custom domain — Railway-provided URL is sufficient
- Per-child different system prompts — same safety rules for both
- RAG, embeddings — not needed for children's chat
- Mobile app — browser access is sufficient
- Real-time push notifications — email alerts cover this need now
- Modifying LibreChat config from dashboard — config lives in GitHub Gist
- ML-based safety detection — text pattern matching sufficient for now

## Context

Shipped v2.4 on 2026-04-11. Six milestones complete.
- **LibreChat URL:** https://librechat-production-bff2.up.railway.app
- **Admin Dashboard URL:** https://kidschat-admin-production.up.railway.app
- **Config:** https://gist.github.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf
- **Stack:** LibreChat + Next.js 15 admin dashboard, MongoDB, Meilisearch on Railway
- **Admin dashboard stack:** Next.js 15, NextAuth v5, Tailwind CSS v3, shadcn/ui, Recharts, Anthropic SDK (Haiku + Sonnet), Resend + React Email, react-markdown, MongoDB direct queries, DALL-E 3 via agents endpoint
- **Accounts:** 4 total (2 ADMIN parents, 2 USER children)
- **Cost enforcement:** Native LibreChat `balances.tokenCredits` — `budget.ts` lib handles EUR↔tokens conversion, Railway crons reset daily/monthly, admin UI for per-child cap overrides, one-click parent top-up
- **Tests:** 65 passing across 6 suites
- **Known limitation:** LibreChat v0.8.4 has outdated config schema warnings (non-blocking)
- **Known limitation:** Safety detection uses text pattern matching (26 redirect + 15 jailbreak + image-prompt patterns) — may have false positives/negatives
- **Tech debt from v2.4:** Phase 14 has no VERIFICATION.md; stale LibreChat `agent_F6ITBo7EuorE7vqrXsNAm` test agent never cleaned up; duplicate MongoDB query logic between `alerts/page.tsx` and `/api/alerts/route.ts`; 3/8 UAT checks deferred on Phase 15.3 (hard block at 0 balance, top-up recovery, Railway log grep)

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
| Railway cron for weekly digest | Native Railway feature, no external dependencies | ✓ Good — needs cron service setup |
| Lazy Resend proxy singleton | Avoids build failures when RESEND_API_KEY not set | ✓ Good — build-safe pattern |
| DALL-E 3 via LibreChat Agents endpoint (not custom integration) | Leverages existing agent infrastructure, no new API client, safety rules already in agent system prompts | ✓ Good (v2.4) |
| LibreChat-native `balances.tokenCredits` for cost caps (vs custom cost_ledger) | Single source of truth, LibreChat's built-in hard block when depleted, no shadow accounting | ✓ Good after 15.3 teardown — the original custom layer in 15-04 was over-engineered |
| Synthetic message injection for warnings/offers | Tried 5 approaches (direct insert, React Query invalidation, agent system-prompt injection) — all failed live UAT render | ✗ Abandoned in 15.3 — LibreChat's React Query cache doesn't refetch on external writes |
| `$max` for daily cap refill (vs `$set`) | Atomic preservation of parent top-ups above daily cap — one-line MongoDB operator | ✓ Good (v2.4 — 15.4 fix) |
| Monthly cap enforcement at daily-cron refill gate (not per-request) | No new middleware; when exhausted, daily refill becomes no-op → next midnight the child starts at 0 → native block takes over | ✓ Good (v2.4 — 15.4 design) |
| Deferred gap closure via decimal phases (15.2, 15.3, 15.4) | Rather than rework failed phase 15.2 in place, tear down + rebuild cleanly in 15.3, then close audit gaps in 15.4 | ✓ Good — honest delivery + clean git history |

---
*Last updated: 2026-04-11 after v2.4 milestone completion*
