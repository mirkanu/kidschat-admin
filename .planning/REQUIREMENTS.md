# Requirements: KidsChat v2.0 Admin Dashboard

**Defined:** 2026-04-04
**Core Value:** Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.

## v2.0 Requirements

Requirements for admin dashboard. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: Next.js app deployed as a separate Railway service in the KidsChat project
- [x] **INFRA-02**: Dashboard connects to the same MongoDB instance as LibreChat
- [x] **INFRA-03**: Dashboard accessible at its own Railway-provided URL
- [x] **INFRA-04**: Dashboard requires login — only ADMIN-role users can access

### Conversation Logs

- [x] **CONV-01**: Admin can view a list of all children's conversations (newest first)
- [x] **CONV-02**: Admin can search conversations by keyword
- [ ] **CONV-03**: Admin can view full message history for any conversation with timestamps
- [x] **CONV-04**: Admin can filter conversations by child (Sebastian / Penelope)
- [ ] **CONV-05**: Child messages and AI responses are visually distinguished

### User Management

- [x] **USER-01**: Admin can view a list of all accounts with name, email, role, and last active date
- [x] **USER-02**: Admin can create new user accounts (with name, email, password, role)
- [x] **USER-03**: Admin can edit account details (name, password, role)
- [x] **USER-04**: Admin can delete user accounts

### Usage Statistics

- [ ] **STAT-01**: Dashboard shows messages per day as a chart
- [ ] **STAT-02**: Dashboard shows active hours (when kids chat most)
- [ ] **STAT-03**: Dashboard shows most-used tone presets
- [ ] **STAT-04**: All stats have per-child breakdown

### Safety Alerts

- [ ] **ALRT-01**: Dashboard detects and logs when the safety prompt redirects a conversation
- [ ] **ALRT-02**: Dashboard detects and logs jailbreak attempts
- [ ] **ALRT-03**: Admin can view alert history log with timestamps and conversation links

## Future Requirements

### Real-time Alerts

- **ALRT-F01**: Real-time in-dashboard notifications when safety events occur
- **ALRT-F02**: Email/push notifications for critical safety events

### Enhanced Features

- **ENH-F01**: Export conversation logs as PDF/CSV
- **ENH-F02**: Per-child different system prompts
- **ENH-F03**: Custom domain for dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time push notifications | Deferred to future — alert log sufficient for v2.0 |
| Modifying LibreChat config from dashboard | Config lives in GitHub Gist, separate workflow |
| Chat interface in dashboard | LibreChat already provides this |
| Mobile-optimized dashboard | Desktop browser sufficient for parent use |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 4 | Complete |
| INFRA-02 | Phase 4 | Complete |
| INFRA-03 | Phase 4 | Complete |
| INFRA-04 | Phase 4 | Complete |
| CONV-01 | Phase 5 | Complete |
| CONV-02 | Phase 5 | Complete |
| CONV-03 | Phase 5 | Pending |
| CONV-04 | Phase 5 | Complete |
| CONV-05 | Phase 5 | Pending |
| USER-01 | Phase 5 | Complete |
| USER-02 | Phase 5 | Complete |
| USER-03 | Phase 5 | Complete |
| USER-04 | Phase 5 | Complete |
| STAT-01 | Phase 6 | Pending |
| STAT-02 | Phase 6 | Pending |
| STAT-03 | Phase 6 | Pending |
| STAT-04 | Phase 6 | Pending |
| ALRT-01 | Phase 6 | Pending |
| ALRT-02 | Phase 6 | Pending |
| ALRT-03 | Phase 6 | Pending |

**Coverage:**
- v2.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 — traceability complete after roadmap creation*
