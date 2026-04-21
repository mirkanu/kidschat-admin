# Roadmap: KidsChat

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-04-04)
- ✅ **v2.0 Admin Dashboard** — Phases 4-6 (shipped 2026-04-04)
- ✅ **v2.1 Parent Trust** — Phases 7-9 (shipped 2026-04-05)
- ✅ **v2.2 Admin Intelligence** — Phases 10-12 (shipped 2026-04-05)
- ✅ **v2.3 Parent Notifications** — Phase 13 (shipped 2026-04-05)
- ✅ **v2.4 Image Generation** — Phases 14, 15, 15.2, 15.3, 15.4 (shipped 2026-04-11)
- ✅ **v2.5 Interface Hardening** — Phase 16 (shipped 2026-04-11)
- ✅ **v2.6 Oversight Protection** — Phase 17 (shipped 2026-04-12)
- ✅ **v2.7 Email Alerts** — Phase 18 (shipped 2026-04-13)
- ✅ **v2.8 Budget Hardening** — Phase 19 (shipped 2026-04-18)
- 🚧 **v2.9 Kid Image Search + Test Mode Preset Parity** — Phases 20-22 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-04-04</summary>

LibreChat deployed on Railway with MongoDB + Meilisearch, two admin and two child accounts, safety system prompt with Reformed Christian values and four tone presets, jailbreak resistance validated.

- [x] **Phase 1** — Railway infrastructure, LibreChat deployed, MongoDB connected
- [x] **Phase 2** — LibreChat configured: registration closed, social login off, Claude Haiku 4.5 only
- [x] **Phase 3** — Safety system prompt, tone presets, family accounts, admin oversight verified

</details>

<details>
<summary>✅ v2.0 Admin Dashboard (Phases 4-6) — SHIPPED 2026-04-04</summary>

Standalone Next.js admin dashboard on Railway with auth gate, conversation monitoring, user management, usage analytics, and safety alert detection.

- [x] **Phase 4: Foundation** — Next.js app deployed on Railway, MongoDB connected, admin-only auth gate (completed 2026-04-04)
- [x] **Phase 5: Conversations & User Management** — Conversation logs with search/filter, full CRUD user management (completed 2026-04-04)
- [x] **Phase 6: Analytics & Safety Alerts** — Recharts usage charts with per-child toggle, safety pattern detection with event log (completed 2026-04-04)

</details>

<details>
<summary>✅ v2.1 Parent Trust (Phases 7-9) — SHIPPED 2026-04-05</summary>

Trust center for parents: dashboard home with safety status and activity digest, Safety Rules transparency page, embedded chat sandbox for testing safety boundaries.

- [x] **Phase 7: Trust Home** — Users page fix, dashboard home redesigned as trust center with safety status, digest, alerts, quick links (completed 2026-04-04)
- [x] **Phase 8: Safety Transparency** — Safety Rules page with content boundaries, expandable system prompt, tone presets (completed 2026-04-04)
- [x] **Phase 9: Parent Test Mode** — Embedded chat sandbox with scenario buttons and safety detection badges (completed 2026-04-05)

</details>

<details>
<summary>✅ v2.2 Admin Intelligence (Phases 10-12) — SHIPPED 2026-04-05</summary>

AI-powered admin tools: cost tracking, floating chatbot assistant, and rules editor with review-test-deploy workflow.

- [x] **Phase 10: Cost Tracking** — Token-formula cost estimates with per-model breakdown, 30-day trend, Anthropic billing link (completed 2026-04-05)
- [x] **Phase 11: Admin Chatbot** — Floating Claude Sonnet widget with streaming, context-aware, UNTRUSTED child content framing (completed 2026-04-05)
- [x] **Phase 12: Prompt Editor** — Rules editor with AI review, inline test sandbox, Gist deploy, rollback, Safety Rules auto-sync (completed 2026-04-05)

</details>

<details>
<summary>✅ v2.3 Parent Notifications (Phase 13) — SHIPPED 2026-04-05</summary>

Real-time safety alert emails and weekly activity summary emails to parents, powered by Resend with Railway cron scheduling.

- [x] **Phase 13: Parent Email Notifications** — Resend integration, safety alert emails with dedup, weekly digest with Railway cron, notification history page, preference toggles (completed 2026-04-05)

</details>

<details>
<summary>✅ v2.4 Image Generation (Phases 14, 15, 15.2, 15.3, 15.4) — SHIPPED 2026-04-11</summary>

DALL-E 3 image generation with child-appropriate guardrails, per-child daily/monthly cost caps (native LibreChat `balances.tokenCredits` enforcement), image-prompt safety detection with parent email alerts, and one-click parent top-up. Phase 15.2's synthetic-message-rendering attempt failed live UAT and was torn down in Phase 15.3 along with the entire custom bonus/warning flow (~800 LOC deleted). Phase 15.4 closed audit gaps: wired monthly spend accumulation, enforced monthly cap, fixed the $set→$max clobber, and whitelisted image_prompt in the alert API.

See [milestones/v2.4-ROADMAP.md](milestones/v2.4-ROADMAP.md) for full phase details.

- [x] **Phase 14: Enable & Safeguard Image Generation** — DALL-E 3 via LibreChat Agents endpoint, 4 agent presets with safety rules (completed 2026-04-10)
- [x] **Phase 15: Safety Alert Extension & Rate Limiting** — Image-prompt detection, per-child daily/monthly caps with admin UI, budget.ts on native tokenCredits, Railway crons (5/6 plans; bonus flow superseded by 15.3)
- [~] **Phase 15.2: Synthetic Message Rendering** — Agent system-prompt injection; superseded by 15.3 (code deleted)
- [x] **Phase 15.3: Simplification — Remove Bonus Flow** — Deleted ~800 LOC of custom warnings/bonus/injection; added one-click parent "Top up €0.10" button (completed 2026-04-11)
- [x] **Phase 15.4: Cost Cap & Alert Contract Fixes** — Gap closure: monthlySpendEur write path, $max refill, monthly cap gate, image_prompt alertType whitelist (completed 2026-04-11)

</details>

<details>
<summary>✅ v2.5 Interface Hardening (Phase 16) — SHIPPED 2026-04-11</summary>

Lock down LibreChat's kid-facing UI: disable MCP server creation (capability escalation risk), disable Agent Marketplace, prevent chat deletion by non-admin users, and give the 4 tone presets distinct icons. Small hardening pass + polish.

### Phase 16: LibreChat Interface Hardening
Lock down every UI affordance in LibreChat that would let a child escape the safety sandbox or break parent oversight. Four specific changes: (1) disable MCP server add UI — MCP servers are arbitrary capability grants and must not be user-addable; (2) disable Agent Marketplace browse/install; (3) prevent chat deletion by non-admin users so parent oversight via admin dashboard cannot be erased; (4) assign distinct icons to the 4 tone presets (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal) so kids can visually distinguish them. All four are LibreChat config changes on the same Gist-hosted `librechat.yaml` plus one LibreChat service redeploy.

**Goal:** LibreChat's kid-facing UI exposes zero capability-escalation paths (no MCP add, no marketplace), preserves admin oversight (kids cannot delete chat history), and visually distinguishes the 4 presets for better kid UX.
**Requirements:** [HARDEN-MCP-01, HARDEN-MARKETPLACE-01, HARDEN-DELETE-01, POLISH-ICONS-01]

Plans:
- [x] 16-01-PLAN.md — Audit live Gist config, disable MCP+marketplace+delete, assign preset icons, redeploy LibreChat, UAT as kid (UAT approved 2026-04-11; delete limitation accepted, HARDEN-DELETE-02 follow-up required)

</details>

<details>
<summary>✅ v2.6 Oversight Protection (Phase 17) — SHIPPED 2026-04-12</summary>

Close the critical parent-oversight gap from v2.5 audit: kids can hard-delete conversations from MongoDB via LibreChat's sidebar, erasing them from the admin dashboard too. Also fix the cosmetic icon dark-mode issue from Phase 16 UAT.

### Phase 17: Conversation Delete Protection + Icon Dark Mode Fix
Two items: (1) CRITICAL — LibreChat v0.8.4 has no config toggle to prevent USER-role conversation deletion. When a kid clicks delete in the sidebar, it hard-deletes from MongoDB's `conversations` + `messages` collections, removing the conversation from the admin dashboard. This defeats parent oversight. Research needed into LibreChat's delete API to find an interception point (MongoDB middleware/trigger, LibreChat API proxy, or pre-delete archival). (2) COSMETIC — Phase 16's lucide icon SVGs are black stroke on transparent background, which renders poorly on LibreChat's dark sidebar. Switch to white-stroke or light-colored variants.

**Goal:** Kids cannot permanently destroy conversation history that parents see in the admin dashboard. Preset icons render clearly on LibreChat's dark-themed sidebar.
**Requirements:** [HARDEN-DELETE-02, POLISH-ICONS-02]

Plans:
- [x] 17-01-PLAN.md — Research LibreChat delete API + implement conversation protection + fix icon colors + redeploy + UAT (UAT approved 2026-04-12; MongoDB restricted user blocks delete at driver level; Iconify icons visible)

</details>

<details>
<summary>✅ v2.7 Email Alerts (Phase 18) — SHIPPED 2026-04-13</summary>

Automated email alert system for both parents via Resend. Notification recipients decoupled from admin accounts, configurable Settings UI with per-recipient alert type toggles, 4 alert types (safety, weekly digest, daily summary, account activity), Railway cron for daily scheduling.

### Phase 18: Email Alert System
**Goal:** Both parents receive automated email alerts via Resend with a configurable Notifications settings page.
**Requirements:** [EMAIL-RECIPIENTS-01, EMAIL-MIGRATE-01, EMAIL-SETTINGS-01, EMAIL-DAILY-01, EMAIL-ACTIVITY-01]
**Depends on:** Phase 17

Plans:
- [x] 18-01-PLAN.md — Notification recipients data model + API, migrate existing senders (completed 2026-04-12)
- [x] 18-02-PLAN.md — Enhanced Notification Settings UI with recipient management (UAT approved 2026-04-12)
- [x] 18-03-PLAN.md — Daily summary emails + account activity alerts + cron update (completed 2026-04-12)

</details>

<details>
<summary>✅ v2.8 Budget Hardening (Phase 19) — SHIPPED 2026-04-18</summary>

Forensic investigation + remediation of kids' 20c/day budget exhausting after 2-3 questions. Root causes fixed across the full cost pipeline: DALL-E tool schema overhead removed from text presets, maxContextTokens cap added, startBalance loophole closed, SYSTEM_PROMPT_TOKENS corrected (400 → 3290), daily-reset cron pipeline restored, image-size guardrail deployed, observability added.

See [milestones/v2.8-ROADMAP.md](milestones/v2.8-ROADMAP.md) for full phase details.

- [x] **Phase 19: Budget Exhaustion Investigation & Remediation** — 4/4 plans (completed 2026-04-18)

</details>

<details open>
<summary>🚧 v2.9 Kid Image Search + Test Mode Preset Parity (Phases 20-22) — IN PROGRESS</summary>

A new kid-facing "Image Search" preset inside LibreChat (no external browser, no click-through, full parent oversight via existing MongoDB + email pipeline), plus Test Mode parity so parents can dry-run all 6 presets (4 text + Drawing Studio + Image Search) with full tool execution before changes hit the kids. Structured as **research+POC → production rollout → admin parity** because three real tech questions (tool mechanism, search provider, Test Mode architecture) only resolve through investigation and must be answered before committing to a production implementation.

- [ ] **Phase 20: Image Search — Research + POC** — Pick tool mechanism (LibreChat web_search vs MCP vs custom OpenAPI tool), pick provider (Brave/Serper/Google CSE), decide hotlink mitigation approach, decide Test Mode architecture; stand up end-to-end POC in staging preset against a real API key.
- [ ] **Phase 21: Image Search — Production rollout (kid-facing)** — Deploy preset to production Gist, domain blocklist, search-count cap + admin UI, safety pattern wiring, full UAT as Penelope.
- [ ] **Phase 22: Test Mode preset parity (admin-facing)** — Preset selector, tool execution for all 6 presets (using architecture decided in Phase 20), daily-summary email inclusion of image searches, side-by-side parity UAT.

### Phase 20: Image Search — Research + POC
**Goal:** Open architectural questions for kid image search are answered with working evidence; a staging preset demonstrates end-to-end image search for one kid account, unblocking Phases 21 and 22.
**Depends on:** Phase 19
**Requirements:** (research underpinning — no v1 requirements close here; decisions feed Phases 21/22)
**Success Criteria** (what must be TRUE):
  1. A documented decision exists for the image-search tool mechanism (LibreChat built-in web_search vs MCP server vs custom OpenAPI tool), with rationale.
  2. A documented decision exists for the search provider (Brave / Serper / Google CSE), with rationale covering SafeSearch strictness, pricing, and kid-query reliability.
  3. A documented decision exists for hotlink mitigation (server-side image proxy vs provider-cached CDN vs client-only fallback).
  4. A documented decision exists for Test Mode tool-execution architecture (proxy-through-LibreChat vs re-implement server-side).
  5. A working end-to-end POC: typing "volcano" as Sebastian in a staging Image Search preset returns an inline image grid rendered in LibreChat's chat UI — no click-through links, no commentary.
**Plans:** 6 plans

Plans:
- [x] 20-01-PLAN.md — Wave 0 blockers: provision Brave API key + deploy kidschat-brave-mcp Railway service
- [x] 20-02-PLAN.md — Fork production Gist to dev Gist with MCP declaration + Image Search preset (production untouched)
- [x] 20-03-PLAN.md — Seed MongoDB Image Search agent doc with brave_image_search tool + strict router system prompt
- [x] 20-04-PLAN.md — Swap CONFIG_PATH to dev Gist, redeploy LibreChat, resolve OQ1 MCP wire compat (fail-fast), parent browser smoke test
- [x] 20-05-PLAN.md — Parent UAT: 20-query safety test set as Sebastian, hotlink survivability sample, DOM click-through inspection
- [x] 20-06-PLAN.md — Lock 4 decisions in 20-DECISIONS.md, update STATE, revert CONFIG_PATH to production (preserve dev Gist/MCP service/agent doc for Phase 21)

### Phase 21: Image Search — Production rollout (kid-facing)
**Goal:** Penelope and Sebastian have a production "Image Search" preset with SafeSearch, domain blocklist, per-day search cap, and full parent oversight via existing MongoDB/email pipelines — zero click-through to source sites.
**Depends on:** Phase 20
**Requirements:** SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07, SEARCH-08, SAFETY-01, SAFETY-02, OVERSIGHT-01, OVERSIGHT-02
**Success Criteria** (what must be TRUE):
  1. Penelope sees "Image Search" as a sixth preset in the LibreChat preset selector and can select it.
  2. Typing an age-appropriate query (e.g., "lions", "rainbow") returns an inline grid of 8-12 images rendered as plain images (not clickable links), with no AI commentary; hotlink-blocked images render via the proxy fallback.
  3. An attempt to query a blocklist-matching domain or a SafeSearch-tripped term is filtered out before reaching the kid, and suspicious query patterns fire an existing-pipeline parent email alert.
  4. After N searches in a day (configurable per child via admin UI, same pattern as daily cost override), Penelope is blocked from additional searches until the next day.
  5. The admin conversation log shows the Image Search session with a visible preset badge distinguishing it from text-chat conversations; every query + returned URL set is persisted in MongoDB via LibreChat's normal conversation/message write path.
**Plans:** 5 plans
**UI hint**: yes

Plans:
- [x] 21-01-PLAN.md — MCP hardening: query blocklist + domain blocklist + hotlink proxy + quota client (Wave 1)
- [ ] 21-02-PLAN.md — Admin schema + /api/image-search/quota endpoint + daily-reset cron bolt-on (Wave 1)
- [ ] 21-03-PLAN.md — /settings UI override widget extended with Daily searches column (Wave 2)
- [ ] 21-04-PLAN.md — Safety-pattern extension + preset badge + OVERSIGHT-01 audit + ACL re-grant (Wave 2)
- [ ] 21-05-PLAN.md — Kid UAT as Penelope & Sebastian + phase close (Wave 3)

### Phase 22: Test Mode preset parity (admin-facing)
**Goal:** A parent opens admin Test Mode, picks any of the 6 presets (4 text + Drawing Studio + Image Search), and experiences exactly what a kid would — including actual DALL-E image generation and actual image-search results — so preset/tool changes can be verified before reaching the kids.
**Depends on:** Phase 21
**Requirements:** TESTMODE-01, TESTMODE-02, TESTMODE-03, OVERSIGHT-03
**Success Criteria** (what must be TRUE):
  1. The admin Test Mode page exposes a preset/agent selector with all 6 presets (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal, Drawing Studio, Image Search).
  2. Selecting Drawing Studio and submitting a prompt triggers real DALL-E image generation and renders the resulting image inline in Test Mode.
  3. Selecting Image Search and submitting a query returns the same inline image grid a kid would see for that query (same SafeSearch, same blocklist, same click-through policy).
  4. A side-by-side parity UAT across all 6 presets (parent Test Mode vs Penelope's actual LibreChat session) produces matching behavior within expected variance, documented in the phase's VERIFICATION.md.
  5. The daily-summary email for each kid includes an "Image searches today" count plus a sample of recent queries, matching the paraphrased-summary style from quick task 260417-p94.
**Plans:** 5 plans
**UI hint**: yes

</details>

## Backlog

### Phase 999.1: Sentry error monitoring + cron dead-man's-switch (BACKLOG)

**Goal:** [Captured for future planning] Add Sentry to kidschat-admin + a dead-man's-switch so silent cron failures (like the Apr 19 401 that stopped Penelope's daily summaries) page us before the user notices.

**Scope:**
- Install `@sentry/nextjs` in `kidschat-admin` only (not LibreChat — upstream + PII-heavy, needs separate privacy review). Covers `/api/cron/*`, `/api/notify/*`, admin UI route handlers. Scrub user IDs and any child content before send.
- Dead-man's-switch: Sentry Crons OR a `/api/health/crons` endpoint that checks MongoDB `cron_state.lastRunAt` for `daily_reset` and `daily_summary` — alert if >26h stale. (Plain Sentry errors would NOT have caught Apr 19 — the cron never reached admin.)
- Free tier 5k errors/month is sufficient.

**Motivation:** Apr 19 incident — `daily-reset-cron` (00:00 UTC) and `daily-notifications-cron` (08:00 UTC) both CRASHED with HTTP 401 and Railway silently paused them (`restartPolicyType: NEVER`). Penelope missed her daily summary. The only signal was Railway's generic "Deployment crashed" email — no visibility into *why* or *which endpoint*. Hotfix shipped retries; this phase adds observability.

**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | — | Complete | 2026-04-04 |
| 2. Configuration | v1.0 | — | Complete | 2026-04-04 |
| 3. Safety & Accounts | v1.0 | — | Complete | 2026-04-04 |
| 4. Foundation | v2.0 | 3/3 | Complete | 2026-04-04 |
| 5. Conversations & User Management | v2.0 | 3/3 | Complete | 2026-04-04 |
| 6. Analytics & Safety Alerts | v2.0 | 2/2 | Complete | 2026-04-04 |
| 7. Trust Home | v2.1 | 2/2 | Complete | 2026-04-04 |
| 8. Safety Transparency | v2.1 | 2/2 | Complete | 2026-04-04 |
| 9. Parent Test Mode | v2.1 | 2/2 | Complete | 2026-04-05 |
| 10. Cost Tracking | v2.2 | 2/2 | Complete | 2026-04-05 |
| 11. Admin Chatbot | v2.2 | 2/2 | Complete | 2026-04-05 |
| 12. Prompt Editor | v2.2 | 2/2 | Complete | 2026-04-05 |
| 13. Parent Email Notifications | v2.3 | 3/3 | Complete | 2026-04-05 |
| 14. Enable & Safeguard Image Generation | v2.4 | 1/1 | Complete | 2026-04-10 |
| 15. Safety Alert Extension & Rate Limiting | v2.4 | 5/6 | Complete (bonus superseded) | 2026-04-10 |
| 15.2. Synthetic Message Rendering | v2.4 | 1/1 | Superseded by 15.3 | 2026-04-11 |
| 15.3. Simplification — Remove Bonus Flow | v2.4 | 1/1 | Complete | 2026-04-11 |
| 15.4. Cost Cap & Alert Contract Fixes | v2.4 | 1/1 | Complete | 2026-04-11 |
| 16. LibreChat Interface Hardening | v2.5 | 1/1 | Complete | 2026-04-11 |
| 17. Conversation Delete Protection + Icon Fix | v2.6 | 1/1 | Complete | 2026-04-12 |
| 18. Email Alert System | v2.7 | 3/3 | Complete | 2026-04-13 |
| 19. Budget Exhaustion Investigation & Remediation | v2.8 | 4/4 | Complete | 2026-04-18 |
| 20. Image Search — Research + POC | v2.9 | 6/6 | Complete   | 2026-04-20 |
| 21. Image Search — Production rollout | v2.9 | 1/5 | In Progress|  |
| 22. Test Mode preset parity | v2.9 | 0/0 | Not started | — |
