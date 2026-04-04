# Roadmap: KidsChat

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-04-04)
- 🚧 **v2.0 Admin Dashboard** - Phases 4-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) - SHIPPED 2026-04-04</summary>

LibreChat deployed on Railway with MongoDB + Meilisearch, two admin and two child accounts, safety system prompt with Reformed Christian values and four tone presets, jailbreak resistance validated.

- [x] **Phase 1** - Railway infrastructure, LibreChat deployed, MongoDB connected
- [x] **Phase 2** - LibreChat configured: registration closed, social login off, Claude Haiku 4.5 only
- [x] **Phase 3** - Safety system prompt, tone presets, family accounts, admin oversight verified

</details>

### 🚧 v2.0 Admin Dashboard (In Progress)

**Milestone Goal:** A standalone Next.js admin dashboard on Railway that connects to the same MongoDB, giving parents a browser-based interface for conversation oversight, user management, usage statistics, and safety alerts.

- [ ] **Phase 4: Foundation** - Next.js app deployed on Railway, MongoDB connected, admin-only auth gate
- [ ] **Phase 5: Conversations & User Management** - Parents can read all children's chats and manage accounts
- [ ] **Phase 6: Analytics & Safety Alerts** - Usage statistics charts and detected safety event log

## Phase Details

### Phase 4: Foundation
**Goal**: A deployed, secured Next.js admin dashboard that parents can reach at a Railway URL and log into with their admin credentials
**Depends on**: v1.0 (existing MongoDB instance with LibreChat data)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. The dashboard is reachable at a Railway-provided URL in a browser
  2. An unauthenticated visitor is redirected to a login page and cannot see any dashboard content
  3. An admin parent (Manuel or Emily-Kate) can log in with their existing LibreChat credentials and land on the dashboard home
  4. A non-admin account (child user) is refused access after login
  5. The dashboard reads live data from the same MongoDB instance LibreChat uses
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Next.js 15 scaffold: Tailwind, shadcn base, MongoDB client, User types
- [ ] 04-02-PLAN.md — NextAuth v5 auth: Credentials provider, admin role guard, login page with skeletons
- [ ] 04-03-PLAN.md — Dashboard shell: layout, sidebar, header, dark mode + Railway deployment

### Phase 5: Conversations & User Management
**Goal**: Parents can browse and search all children's conversation histories and fully manage all user accounts from the dashboard
**Depends on**: Phase 4
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, USER-01, USER-02, USER-03, USER-04
**Success Criteria** (what must be TRUE):
  1. Admin sees a list of all conversations from all children, sorted newest first, with child name and timestamp visible
  2. Admin can filter the conversation list to show only Sebastian's or only Penelope's conversations
  3. Admin can search conversations by keyword and see matching results
  4. Admin can click into any conversation and read the full message thread with timestamps, child messages and AI responses visually distinct
  5. Admin can view all accounts in a table showing name, email, role, and last active date, and can create, edit, or delete any account
**Plans**: TBD

### Phase 6: Analytics & Safety Alerts
**Goal**: Parents can see how the children are using the app over time and review a log of any detected safety events
**Depends on**: Phase 5
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, ALRT-01, ALRT-02, ALRT-03
**Success Criteria** (what must be TRUE):
  1. The dashboard shows a chart of messages sent per day, with a per-child breakdown toggle
  2. The dashboard shows which hours of day each child is most active
  3. The dashboard shows which tone presets are used most, broken down by child
  4. The dashboard shows a log of detected safety events (safety prompt redirections and jailbreak attempts) with timestamps and a link to the source conversation
**Plans**: TBD

## Progress

**Execution Order:** 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | — | Complete | 2026-04-04 |
| 2. Configuration | v1.0 | — | Complete | 2026-04-04 |
| 3. Safety & Accounts | v1.0 | — | Complete | 2026-04-04 |
| 4. Foundation | v2.0 | 0/3 | Not started | - |
| 5. Conversations & User Management | v2.0 | 0/TBD | Not started | - |
| 6. Analytics & Safety Alerts | v2.0 | 0/TBD | Not started | - |
