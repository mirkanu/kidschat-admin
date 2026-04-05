# Requirements: KidsChat v2.2 Admin Intelligence

**Defined:** 2026-04-05
**Core Value:** Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.

## v2.2 Requirements

Requirements for admin intelligence milestone. Each maps to roadmap phases.

### Cost Tracking

- [ ] **COST-01**: Dashboard shows estimated daily and monthly API cost based on message counts, separated by model (Haiku for kids, Sonnet for admin)
- [ ] **COST-02**: Cost page includes link to Anthropic billing console with "estimate only" disclaimer
- [ ] **COST-03**: Cost page shows message count trends (last 30 days) alongside cost estimates

### AI Admin Chatbot

- [ ] **CHAT-01**: Floating chatbot widget appears bottom-right on all admin dashboard pages
- [ ] **CHAT-02**: Chatbot uses Claude Sonnet 4.6 with app context (safety rules, app structure, current settings)
- [ ] **CHAT-03**: Admin can ask the chatbot about current safety rules, tone presets, and how the app works
- [ ] **CHAT-04**: Admin can ask the chatbot to read and summarize recent conversation logs
- [ ] **CHAT-05**: Chatbot marks child-generated content as UNTRUSTED to prevent indirect prompt injection

### System Prompt Editor

- [ ] **EDIT-01**: Admin can edit the system prompt text in the dashboard with a live editor
- [ ] **EDIT-02**: AI reviews proposed changes against a required-sections checklist and flags gaps (non-blocking)
- [ ] **EDIT-03**: Admin can test the draft prompt in the existing sandbox before deploying
- [ ] **EDIT-04**: Admin can deploy the approved prompt to GitHub Gist with one click
- [ ] **EDIT-05**: Previous prompt versions are stored for rollback
- [ ] **EDIT-06**: Safety Rules page summaries auto-update when the prompt changes
- [ ] **EDIT-07**: Dashboard shows "Redeploy LibreChat required" notice after Gist deploy

## Future Requirements

### Enhanced Intelligence

- **CHAT-F01**: Chatbot can trigger LibreChat redeploy via Railway CLI
- **CHAT-F02**: Chatbot suggests safety rule improvements based on alert patterns
- **COST-F01**: Real token tracking via Anthropic Admin API (requires org account)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time token tracking via Anthropic API | Requires organization account; estimate-from-counts sufficient for family use |
| Auto-redeploy LibreChat after Gist update | Safety concern — parent should control when kids get new rules |
| Chatbot writing/modifying data | Read-only access prevents accidental data changes |
| ML-based safety detection | Text pattern matching sufficient for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COST-01 | TBD | Pending |
| COST-02 | TBD | Pending |
| COST-03 | TBD | Pending |
| CHAT-01 | TBD | Pending |
| CHAT-02 | TBD | Pending |
| CHAT-03 | TBD | Pending |
| CHAT-04 | TBD | Pending |
| CHAT-05 | TBD | Pending |
| EDIT-01 | TBD | Pending |
| EDIT-02 | TBD | Pending |
| EDIT-03 | TBD | Pending |
| EDIT-04 | TBD | Pending |
| EDIT-05 | TBD | Pending |
| EDIT-06 | TBD | Pending |
| EDIT-07 | TBD | Pending |

**Coverage:**
- v2.2 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15 ⚠️

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after initial definition*
