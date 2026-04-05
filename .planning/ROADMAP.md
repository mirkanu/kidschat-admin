# Roadmap: KidsChat

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-04-04)
- ✅ **v2.0 Admin Dashboard** — Phases 4-6 (shipped 2026-04-04)
- ✅ **v2.1 Parent Trust** — Phases 7-9 (shipped 2026-04-05)
- 🔄 **v2.2 Admin Intelligence** — Phases 10-12 (in progress)

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

### v2.2 Admin Intelligence (Phases 10-12)

- [x] **Phase 10: Cost Tracking** — Estimated API costs in analytics dashboard with per-model breakdown and Anthropic billing link (completed 2026-04-05)
- [ ] **Phase 11: Admin Chatbot** — Floating AI assistant widget on all dashboard pages with streaming responses and safe context injection
- [ ] **Phase 12: Prompt Editor** — Full system prompt edit-review-test-deploy workflow with Gist push, rollback, and Safety Rules sync

## Phase Details

### Phase 10: Cost Tracking
**Goal**: Parents can see estimated API costs directly in the dashboard without leaving the app
**Depends on**: Nothing — uses existing MongoDB message data and Recharts
**Requirements**: COST-01, COST-02, COST-03
**Success Criteria** (what must be TRUE):
  1. Analytics page shows an estimated daily and monthly cost card with separate line items for Haiku (children's chat) and Sonnet (admin tools)
  2. Cost card includes a clearly labeled "estimated only" disclaimer and a direct link to the Anthropic billing console
  3. A 30-day message count trend chart is visible alongside cost estimates
**Plans:** 2/2 plans complete
Plans:
- [ ] 10-01-PLAN.md — Cost estimation library and API route
- [ ] 10-02-PLAN.md — Cost display card and analytics page integration

### Phase 11: Admin Chatbot
**Goal**: Parents can ask an AI assistant questions about the app and get answers grounded in real app data
**Depends on**: Phase 10 (Sonnet usage must be tracked in cost estimates from the start)
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05
**Success Criteria** (what must be TRUE):
  1. A floating chat button is visible in the bottom-right corner on every admin dashboard page
  2. The chatbot answers questions about the current safety rules, tone presets, and how the app works using accurate, up-to-date context
  3. The chatbot can read and summarize recent conversation logs when asked
  4. All child-generated content read by the chatbot is explicitly marked UNTRUSTED — the chatbot cannot be manipulated by content children type into LibreChat
**Plans:** 1/2 plans executed
Plans:
- [ ] 11-01-PLAN.md — Backend: system prompt builder, context API, streaming chat route
- [ ] 11-02-PLAN.md — Frontend: floating chat widget with streaming UI, mounted in DashboardShell

### Phase 12: Prompt Editor
**Goal**: Parents can safely edit, review, test, and deploy the system prompt without touching GitHub directly
**Depends on**: Phase 11 (AI review step reuses the streaming API route pattern established in Phase 11)
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07
**Success Criteria** (what must be TRUE):
  1. Admin can open a prompt editor page, see the current system prompt pre-loaded, and make edits in a live text editor
  2. Before deploying, the admin receives a non-blocking AI review that checks whether required safety sections (jailbreak resistance, content rules, tone, redirect language) are present — and can deploy anyway if they choose
  3. Admin can test the draft prompt in the existing sandbox before committing to deploy
  4. Admin can deploy the edited prompt to GitHub Gist with one click, after confirming via a modal — the previous version is saved for one-click rollback
  5. After a successful Gist deploy, the Safety Rules page summaries reflect the new prompt content and a "Redeploy LibreChat Required" notice is shown
**Plans**: TBD

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
| 10. Cost Tracking | 2/2 | Complete    | 2026-04-05 | - |
| 11. Admin Chatbot | 1/2 | In Progress|  | - |
| 12. Prompt Editor | v2.2 | 0/? | Not started | - |
