# Roadmap: KidsChat

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-04-04)
- ✅ **v2.0 Admin Dashboard** — Phases 4-6 (shipped 2026-04-04)
- 🔄 **v2.1 Parent Trust** — Phases 7-9 (in progress)

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

### v2.1 Parent Trust (Phases 7-9)

- [x] **Phase 7: Trust Home** — Fix users page bug and redesign dashboard home as a parent trust center (completed 2026-04-04)
- [x] **Phase 8: Safety Transparency** — New Safety Rules page explaining content boundaries, system prompt, and tone presets (completed 2026-04-04)
- [ ] **Phase 9: Parent Test Mode** — Embedded chat sandbox with predefined safety scenario buttons

## Phase Details

### Phase 7: Trust Home
**Goal**: Parents see a reliable dashboard home that immediately communicates all safety systems are active and gives a digest of recent activity
**Depends on**: Nothing (continuing existing dashboard)
**Requirements**: FIX-01, TRUST-01, TRUST-02, TRUST-03, TRUST-04
**Success Criteria** (what must be TRUE):
  1. Users page correctly shows all 4 accounts (not 0)
  2. Dashboard home displays a safety status indicator showing "All systems active" with a last-checked timestamp
  3. Dashboard home shows a 24-hour digest: number of messages sent, safety events detected, and system health
  4. Dashboard home shows recent safety alerts with a link to the full alerts page
  5. Dashboard home has quick-link navigation to Safety Rules, Test Mode, Conversations, and Alerts
**Plans:** 2/2 plans complete
Plans:
- [ ] 07-01-PLAN.md — Fix users page bug + create trust dashboard data layer
- [ ] 07-02-PLAN.md — Redesign dashboard home as parent trust center UI

### Phase 8: Safety Transparency
**Goal**: Parents can read a clear, plain-language explanation of every content rule protecting the children, including the full system prompt
**Depends on**: Phase 7
**Requirements**: SAFE-01, SAFE-02, SAFE-03, SAFE-04
**Success Criteria** (what must be TRUE):
  1. Admin can navigate to a Safety Rules page from the dashboard
  2. Safety Rules page shows a parent-friendly summary of all content boundaries (no jargon)
  3. Safety Rules page has an expandable section that reveals the full system prompt text
  4. Safety Rules page explains what happens when each rule triggers (redirect behavior, jailbreak response)
  5. Safety Rules page lists all four tone presets with a plain-language description of what each one does
**Plans:** 2/2 plans complete
Plans:
- [ ] 08-01-PLAN.md — Create Safety Rules page with all content sections
- [ ] 08-02-PLAN.md — Wire up sidebar nav and activate dashboard quick link

### Phase 9: Parent Test Mode
**Goal**: Parents can personally verify that safety rules work by sending test messages through an embedded sandbox and watching the AI respond
**Depends on**: Phase 8
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Admin can open an embedded chat sandbox within the dashboard and send a free-form test message
  2. Sandbox displays predefined scenario buttons (jailbreak attempt, inappropriate topic, boundary test) that pre-fill a test message
  3. When a test message is blocked or redirected, the sandbox visually identifies which safety rule triggered
**Plans:** 1/2 plans executed
Plans:
- [ ] 09-01-PLAN.md — Extract shared system prompt + create /api/test-chat endpoint
- [ ] 09-02-PLAN.md — Chat sandbox UI with scenario buttons, safety indicators, and navigation

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | — | Complete | 2026-04-04 |
| 2. Configuration | v1.0 | — | Complete | 2026-04-04 |
| 3. Safety & Accounts | v1.0 | — | Complete | 2026-04-04 |
| 4. Foundation | v2.0 | 3/3 | Complete | 2026-04-04 |
| 5. Conversations & User Management | v2.0 | 3/3 | Complete | 2026-04-04 |
| 6. Analytics & Safety Alerts | v2.0 | 2/2 | Complete | 2026-04-04 |
| 7. Trust Home | 2/2 | Complete   | 2026-04-04 | - |
| 8. Safety Transparency | 2/2 | Complete   | 2026-04-04 | - |
| 9. Parent Test Mode | 1/2 | In Progress|  | - |
