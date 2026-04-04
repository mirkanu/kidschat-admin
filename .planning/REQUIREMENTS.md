# Requirements: KidsChat v2.1 Parent Trust

**Defined:** 2026-04-04
**Core Value:** Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.

## v2.1 Requirements

Requirements for parent trust milestone. Each maps to roadmap phases.

### Trust Dashboard

- [x] **TRUST-01**: Dashboard home shows safety system status with "All systems active" indicator and last-checked timestamp
- [x] **TRUST-02**: Dashboard home shows 24-hour activity digest (messages sent, safety events detected, system health)
- [x] **TRUST-03**: Dashboard home displays recent safety alerts summary with link to full alerts page
- [x] **TRUST-04**: Dashboard home provides quick links to safety rules, test mode, conversations, and alerts

### Safety Transparency

- [x] **SAFE-01**: Admin can view a Safety Rules page with parent-friendly summary of all content boundaries
- [x] **SAFE-02**: Safety Rules page has expandable section showing the full system prompt text
- [x] **SAFE-03**: Safety Rules page explains what happens when each rule triggers (redirect behavior, jailbreak response)
- [x] **SAFE-04**: Safety Rules page lists all four tone presets with descriptions of what each one does

### Parent Test Mode

- [ ] **TEST-01**: Admin can open an embedded chat sandbox and send test messages to see safety rules in action
- [ ] **TEST-02**: Chat sandbox shows predefined scenario buttons (jailbreak attempt, inappropriate topic, boundary test)
- [ ] **TEST-03**: Chat sandbox visually indicates which safety rule triggered when a test message is blocked/redirected

### Bug Fixes

- [x] **FIX-01**: Users page correctly displays all users (fix: shows 0 when 4 exist)

## Future Requirements

### Enhanced Trust

- **TRUST-F01**: Weekly email digest sent to parents with activity summary and safety events
- **TRUST-F02**: Safety rules version history showing when rules were last updated

### Enhanced Testing

- **TEST-F01**: Automated daily safety probe that sends test messages and reports results
- **TEST-F02**: Side-by-side comparison showing child's view vs admin's view

## Out of Scope

| Feature | Reason |
|---------|--------|
| ML-based safety detection | Text pattern matching sufficient for v2.1; revisit if false positive rate is high |
| Real-time push notifications | Alert log + digest sufficient for parent trust |
| Per-child safety customization | Universal rules are simpler and safer |
| Mobile-optimized dashboard | Desktop browser sufficient for parent use |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRUST-01 | Phase 7 | Complete |
| TRUST-02 | Phase 7 | Complete |
| TRUST-03 | Phase 7 | Complete |
| TRUST-04 | Phase 7 | Complete |
| SAFE-01 | Phase 8 | Complete |
| SAFE-02 | Phase 8 | Complete |
| SAFE-03 | Phase 8 | Complete |
| SAFE-04 | Phase 8 | Complete |
| TEST-01 | Phase 9 | Pending |
| TEST-02 | Phase 9 | Pending |
| TEST-03 | Phase 9 | Pending |
| FIX-01 | Phase 7 | Complete |

**Coverage:**
- v2.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation*
