# Milestones

## v2.8 Budget Hardening (Shipped: 2026-04-18)

**Phases completed:** 1 phases, 4 plans, 12 tasks

**Key accomplishments:**

- DALL-E tool schema (~2,580 tokens) removed from all 4 text agent presets via MongoDB $pull; maxContextTokens:8000 added to librechat.yaml; startBalance fixed to 0; Drawing Studio agent created; LibreChat redeployed to new Gist revision 3295aeb
- Raised daily cap to 0.50 EUR in code + live MongoDB, corrected credit-math JSDoc, and fixed SYSTEM_PROMPT_TOKENS from 400 to 3290 so admin cost estimates reflect actual 8x-higher agent overhead
- Railway daily-reset cron pipeline restored via 3 dedicated cron services; Penelope unblocked (tokenCredits 0 → 543478); cron_state observability added to detect future silent failures
- Railway logs + MongoDB forensics classified mystery drain as D (unknown); image size limit guardrail (serverFileSizeLimit:2MB) deployed to Gist 7049fc8 + LibreChat redeployed; thinking tokens confirmed counted in billing

---

## v2.7 Email Alerts (Shipped: 2026-04-13)

**Phases completed:** 3 phases, 5 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v2.6 Oversight Protection (Shipped: 2026-04-12)

**Phases completed:** 1 phase (17), 1 plan
**Timeline:** 2026-04-12 (single day)

**Key accomplishments:**

- **Conversation delete protection** — MongoDB role `librechat_no_delete_convos` blocks `remove` on `conversations` + `messages` collections at the database level. LibreChat's delete button is visible but non-functional (error 13). Parent oversight is structurally protected — kids cannot erase conversation history.
- **Icon dark-mode fix** — replaced black-stroke lucide SVGs with Iconify API URLs using `?color=%23e2e8f0` (slate-200); all 4 preset icons now clearly visible on LibreChat's dark sidebar
- **Railway Volume permissions fix** — set `RAILWAY_RUN_AS_ROOT=true` so LibreChat can write DALL-E images to the volume mount at `/app/client/public/images`

**Delivered:** Parent oversight cannot be defeated by children deleting their chat history. The MongoDB permission layer is invisible, unkillable from the client, and requires no LibreChat fork.

**Approach pivot:** Started with a 5-min archive cron (copies conversations before deletion); user rejected the delay window. Pivoted to MongoDB restricted user — zero delay, zero data loss, simpler code (archive cron removed entirely).

**Known limitation:** Delete button still visible in LibreChat's UI (v0.8.4 has no `customCSS` config key to inject CSS). Button is a dead button — safe but slightly confusing UX.

---

## v2.5 Interface Hardening (Shipped: 2026-04-11)

**Phases completed:** 1 phase (16), 1 plan
**Timeline:** 2026-04-11 (single day)

**Key accomplishments:**

- **MCP server UI disabled** — `interface.mcpServers: {use: false, create: false, share: false, public: false}` — kids cannot add arbitrary tool-running MCP servers (confirmed via Railway logs: `[MCP_SERVERS] Forbidden: Insufficient permissions for User`)
- **Agent Marketplace disabled** — `interface.marketplace: {use: false}` — kids cannot browse or install community-published agents
- **4 distinct preset icons** — lucide SVGs assigned to Friendly Tutor (graduation-cap), Casual Buddy (smile), Balanced Helper (scale-3d), Standard Formal (briefcase)
- **Accepted limitation documented:** LibreChat v0.8.4 has no config toggle for disabling conversation deletion (addressed in v2.6)

**Delivered:** LibreChat's kid-facing UI is locked down — no capability escalation via MCP servers or marketplace agents. Each preset is visually distinct.

---

## v2.4 Image Generation (Shipped: 2026-04-11)

**Phases completed:** 5 phases (14, 15, 15.2, 15.3, 15.4), 9 plans
**Timeline:** 2026-04-08 → 2026-04-11 (4 days)
**Git range:** 35 feat/fix commits

**Key accomplishments:**

- **DALL-E 3 image generation** enabled in LibreChat with child-appropriate guardrails across all 4 agent presets (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal); `modelSpecs.enforce: true` locks kids to Haiku 4.5 + DALL-E tool
- **Per-child cost cap enforcement** shipped via LibreChat-native `balances.tokenCredits` — `budget.ts` as the central lib with `eurToTokens`/`tokensToEur` conversion, admin settings UI for daily/monthly caps, Railway crons for daily/monthly resets
- **Image-prompt safety detection** added `IMAGE_PROMPT_PATTERNS` to the safety-patterns lib, wired to `detectSafetyEvent` → parent email alerts via Phase 13 Resend infrastructure
- **Simplification teardown (Phase 15.3)** — deleted ~800 LOC of custom warning/bonus/injection code after Phase 15.2's agent-injection approach failed live UAT; replaced with LibreChat's native "Insufficient Funds" red block + one-click parent "Top up €0.10" button at `/users/{childId}` (useTransition + sonner toast + active:scale-95)
- **Gap-closure Phase 15.4** — wired `monthlySpendEur` write path (`$inc` in daily-reset cron), fixed `$set`→`$max` clobber that was erasing parent top-ups at midnight UTC, enforced monthly cap via refill gate (`displayedMonthlySpendEur >= monthlyCostCapEur`), whitelisted `image_prompt` alertType in `/api/notify/safety-alert`

**Delivered:** Kids can now generate DALL-E 3 images inside the existing safety guardrails. Parents get per-child daily/monthly spend caps with real-time tracking, one-click top-ups, and image-prompt abuse alerts via email. Budget enforcement uses LibreChat's native balance system — no custom chat-thread injections.

**Tech debt carried forward:** Phase 14 has no VERIFICATION.md artifact; stale LibreChat `agent_F6ITBo7EuorE7vqrXsNAm` test agent never cleaned up; duplicate aggregation logic between `alerts/page.tsx` and `/api/alerts/route.ts`; 3/8 UAT checks deferred on Phase 15.3 (hard block at 0 balance, top-up recovery, Railway log grep).

**Superseded / intentionally deleted:**

- IMG-BONUS-01, IMG-BONUS-02 — bonus purchase flow (Phase 15 → deleted in 15.3)
- SYNTH-RENDER-01 — agent system-prompt injection for synthetic messages (Phase 15.2 → deleted in 15.3)

---

## v2.3 Parent Notifications (Shipped: 2026-04-05)

**Phases completed:** 1 phases, 3 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v2.2 Admin Intelligence (Shipped: 2026-04-05)

**Phases completed:** 3 phases, 6 plans + 5 quick tasks
**Timeline:** 2026-04-05 (single day)

**Key accomplishments:**

- Cost tracking: token-formula estimates with per-model breakdown (Haiku/Sonnet), 30-day trend chart, Anthropic billing link
- AI admin chatbot: floating widget on all pages, Claude Sonnet 4.6 with streaming, context-aware (reads safety rules, logs, app structure), UNTRUSTED framing for child content
- Rules editor: full edit → AI review → test sandbox → deploy to Gist workflow, with rollback and Safety Rules auto-sync
- LibreChat redeploy trigger from admin dashboard
- Markdown rendering for AI responses across all views
- Fixed blank AI response bubbles (LibreChat stores text in content[] blocks)
- Fixed mobile padding (responsive shell + removed double padding)

**Delivered:** An intelligent admin dashboard where parents can ask an AI about the app, safely edit safety rules with a review-test-deploy workflow, and track API costs.

---

## v2.1 Parent Trust (Shipped: 2026-04-05)

**Phases completed:** 3 phases, 6 plans
**Timeline:** 2026-04-04 → 2026-04-05
**Lines of code:** 5,879 TypeScript/TSX (+1,479 from v2.0)

**Key accomplishments:**

- Trust-focused dashboard home: safety status indicator, 24h activity digest, recent alerts preview, quick-link navigation
- Users page bug fixed (self-referencing fetch → direct MongoDB query)
- Safety Rules transparency page: parent-friendly content boundary summary, expandable full system prompt, tone preset descriptions
- Parent Test Mode: embedded chat sandbox calling Claude Haiku 4.5 with safety prompt, predefined scenario buttons, real-time safety detection badges
- Improved safety pattern detection: 26 redirect patterns with descriptive labels (up from 10)

**Delivered:** A trust center for parents — Emily-Kate can see all safety systems are active, read every content rule in plain language, and personally test the safety boundaries through an embedded chat sandbox.

---

## v2.0 Admin Dashboard (Shipped: 2026-04-04)

**Phases completed:** 3 phases, 8 plans
**Timeline:** 2026-04-03 → 2026-04-04 (2 days)
**Git range:** fcbff81..a6c8f2b (50+ commits)
**Lines of code:** 4,400 TypeScript/TSX

**Key accomplishments:**

- Next.js 15 admin dashboard deployed to Railway with NextAuth v5 admin-only auth gate
- Conversation monitoring: searchable list with per-child filtering and full chat-bubble message threads
- User management: full CRUD for accounts with role management, password hashing, and self-deletion protection
- Usage analytics: Recharts charts for messages/day, active hours, and tone preset usage with per-child breakdown toggle
- Safety alert detection: pattern-matching library (10 redirect + 15 jailbreak patterns) with timestamped event log and conversation links

**Delivered:** A standalone admin dashboard giving parents browser-based oversight of all children's AI conversations, user account management, usage analytics, and automated safety alert detection.

---

## v1.0 KidsChat MVP (Shipped: 2026-04-04)

**Phases completed:** 3 phases, 10 plans
**Timeline:** 2026-04-03 (single day, ~12 hours)
**Git range:** fff0453..6d1c9c4 (26 commits)

**Key accomplishments:**

- LibreChat Lite deployed on Railway with MongoDB + Meilisearch, two admin accounts created
- Anthropic API connected, all registration and social login paths closed
- GitHub Gist config wired via CONFIG_PATH with modelSpecs enforcement
- Production safety system prompt with Reformed Christian values, jailbreak resistance, and 4 tone presets
- Four family accounts operational (2 ADMIN parents, 2 USER children via MongoDB insert)
- Admin conversation oversight verified via MongoDB direct queries

**Delivered:** A private, locked-down AI chat for two children with parent-controlled safety guardrails, four conversational tone presets, and full conversation oversight.

---
