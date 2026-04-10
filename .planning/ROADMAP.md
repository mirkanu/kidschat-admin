# Roadmap: KidsChat

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-04-04)
- ✅ **v2.0 Admin Dashboard** — Phases 4-6 (shipped 2026-04-04)
- ✅ **v2.1 Parent Trust** — Phases 7-9 (shipped 2026-04-05)
- ✅ **v2.2 Admin Intelligence** — Phases 10-12 (shipped 2026-04-05)
- ✅ **v2.3 Parent Notifications** — Phase 13 (shipped 2026-04-05)

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

<details open>
<summary>◆ v2.4 Image Generation (Phases 14-15) — IN PROGRESS</summary>

DALL-E 3 image generation for child users with safety guardrails, abuse detection, and rate limiting.

### Phase 14: Enable & Safeguard Image Generation
DALL-E 3 via LibreChat Agents endpoint, child-appropriate system prompt, safety filters verified

**Goal:** DALL-E 3 working in LibreChat with child-appropriate guardrails
**Plans:** 1/1 plans complete
**Requirements:** [IMG-01, IMG-02, IMG-03, IMG-04]

Plans:
- [ ] 14-01-PLAN.md — Set env vars, create Drawing agent, update librechat.yaml, deploy and verify

### Phase 15: Safety Alert Extension & Rate Limiting
Image-prompt safety patterns, parent email alerts, per-child daily image + message + monthly cost limits, bonus "Extra Usage" purchase flow via in-chat YES confirmation, admin settings page

**Goal:** Image prompt abuse detected + parents notified; runaway costs prevented via configurable per-child daily/monthly limits with admin UI; children can buy bonus "Extra Usage" packs.
**Plans:** 3/3 plans complete
**Requirements:** [IMG-SAFETY-01, IMG-SAFETY-02, IMG-SAFETY-03, IMG-SAFETY-04, IMG-LIMITS-01, IMG-LIMITS-02, IMG-LIMITS-03, IMG-LIMITS-04, IMG-ENFORCE-01, IMG-ENFORCE-02, IMG-ENFORCE-03, IMG-BONUS-01, IMG-BONUS-02, IMG-ADMIN-01]

Plans:
- [ ] 15-00-PLAN.md — Wave 0: Jest harness + live MongoDB field inspection + synthetic message probe (human checkpoint)
- [ ] 15-01-PLAN.md — Wave 1: Safety patterns + settings/cost-ledger/bonus-purchases libs + librechat.yaml balance.enabled deploy
- [ ] 15-02-PLAN.md — Wave 2: Enforcement + bonus flow + 5 Railway crons + admin settings UI + weekly digest extension

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
| 14. Enable & Safeguard Image Generation | 1/1 | Complete    | 2026-04-10 | — |
| 15. Safety Alert Extension & Rate Limiting | 3/3 | Complete    | 2026-04-10 | — |
