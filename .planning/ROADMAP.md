# Roadmap: KidsChat

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-04-04)
- ✅ **v2.0 Admin Dashboard** — Phases 4-6 (shipped 2026-04-04)
- ✅ **v2.1 Parent Trust** — Phases 7-9 (shipped 2026-04-05)
- ✅ **v2.2 Admin Intelligence** — Phases 10-12 (shipped 2026-04-05)
- **v2.3 Parent Notifications** — Phase 13

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

### v2.3 Parent Notifications

Real-time safety alert emails and weekly activity summary emails to parents, powered by Resend with Railway cron scheduling.

- [ ] **Phase 13: Parent Email Notifications** — Real-time safety alert emails when concerning content detected, weekly activity summary emails with per-child usage stats and topics
  - **Goal:** Parents receive immediate email alerts for safety events and a weekly digest of each child's chat activity, so they stay informed without needing to check the dashboard
  - **Requirements:** [NOTIFY-01, NOTIFY-02, NOTIFY-03, NOTIFY-04, NOTIFY-05]
  - **Plans:** 3 plans

Plans:
- [ ] 13-01-PLAN.md — Resend + React Email setup, safety alert email pipeline with dedup
- [ ] 13-02-PLAN.md — Weekly digest aggregation, API endpoint, Railway cron script
- [ ] 13-03-PLAN.md — Notification history page, preference toggles, sidebar nav

### Phase 13: Parent Email Notifications

**Goal:** Parents receive immediate email alerts for safety events and a weekly digest of each child's chat activity, so they stay informed without needing to check the dashboard.

**Scope:**
- Resend email service integration with React Email templates
- Real-time safety alert emails triggered when concerning content is detected in conversations
- Weekly activity summary emails per child (message counts, topics, usage patterns)
- Railway cron service to trigger weekly digest generation
- Email preferences/settings for parents (opt-in/out, frequency)
- Admin UI for viewing sent notification history

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
| 13. Parent Email Notifications | 2/3 | In Progress|  | — |
