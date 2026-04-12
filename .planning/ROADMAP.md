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
| 17. Conversation Delete Protection + Icon Fix | 1/1 | Complete   | 2026-04-12 | 2026-04-12 |

### Phase 18: Email Alert System — transactional email service for automated parent notifications

**Goal:** Both parents receive automated email alerts (safety alerts, daily summaries, weekly digests, account activity) via Resend, with notification recipients decoupled from admin accounts and a configurable Notifications settings page in the admin dashboard.
**Requirements:** [EMAIL-RECIPIENTS-01, EMAIL-MIGRATE-01, EMAIL-SETTINGS-01, EMAIL-DAILY-01, EMAIL-ACTIVITY-01]
**Depends on:** Phase 17
**Plans:** 3 plans

Plans:
- [ ] 18-01-PLAN.md — Notification recipients data model + API, migrate existing senders
- [ ] 18-02-PLAN.md — Enhanced Notification Settings UI with recipient management
- [ ] 18-03-PLAN.md — Daily summary emails + account activity alerts + cron update
