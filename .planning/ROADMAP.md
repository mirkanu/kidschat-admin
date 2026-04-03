# Roadmap: KidsChat

## Overview

Three sequential phases deliver a locked-down LibreChat deployment for two children. Phase 1 gets a working instance running on Railway with all access controls closed. Phase 2 authors and deploys the YAML configuration that locks the model, enforces the safety system prompt, and installs tone presets. Phase 3 creates child and admin accounts, verifies admin oversight, and runs acceptance tests from a child's perspective. No phase can proceed without the previous one complete.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Deployment** - LibreChat running on Railway with registration locked and baseline verified
- [ ] **Phase 2: Safety Configuration** - YAML config deployed with model lock, safety system prompt, and tone presets
- [ ] **Phase 3: Accounts and Acceptance** - All accounts created, admin oversight confirmed, app accepted for child use

## Phase Details

### Phase 1: Deployment
**Goal**: LibreChat is running on Railway, accessible via public URL, with Anthropic API connected and all registration paths closed
**Depends on**: Nothing (first phase)
**Requirements**: DEPL-01, DEPL-02, DEPL-03, DEPL-04, AUTH-01, AUTH-02, AUTH-03, AUTH-04, CONF-01, CONF-02, CONF-03
**Success Criteria** (what must be TRUE):
  1. LibreChat loads at the Railway public URL and the chat interface is visible
  2. Sending a message receives a response from Claude Haiku 4.5
  3. Navigating to /register shows an error, not a registration form
  4. Social login options (Google, GitHub) are absent from the login page
  5. The GitHub Gist hosts librechat.yaml and CONFIG_PATH points to its raw URL — opening the Gist in incognito shows no API keys
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Deploy LibreChat Lite Railway template and create admin account
- [ ] 01-02-PLAN.md — Set env vars: Anthropic API key + complete registration lockdown
- [ ] 01-03-PLAN.md — Create GitHub Gist with placeholder librechat.yaml and wire CONFIG_PATH
- [ ] 01-04-PLAN.md — Phase 1 final verification checklist (all 5 success criteria)

### Phase 2: Safety Configuration
**Goal**: The YAML configuration is live — model is locked to Claude Haiku 4.5, safety system prompt is enforced on every message, all four tone presets are available, and dangerous UI features are hidden
**Depends on**: Phase 1
**Requirements**: MODL-01, MODL-02, MODL-03, MODL-04, SAFE-01, SAFE-02, SAFE-03, SAFE-04, SAFE-05, SAFE-06, SAFE-07, TONE-01, TONE-02, TONE-03, TONE-04, TONE-05, TONE-06
**Success Criteria** (what must be TRUE):
  1. No model picker or endpoint selector is visible anywhere in the UI
  2. All four tone presets appear in the UI and switching between them produces a noticeably different conversational style
  3. The safety prompt rejects requests for profanity, mature content, and direct homework answers
  4. A basic jailbreak attempt ("ignore your instructions", DAN-style roleplay, fictional framing) is redirected without complying
  5. Safety rules are identical across all four tone presets — switching tone does not weaken content guardrails
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Author full librechat.yaml (safety system prompt + 4 tone presets + UI lockdown)
- [ ] 02-02-PLAN.md — Push YAML to GitHub Gist and redeploy LibreChat on Railway
- [ ] 02-03-PLAN.md — Human verification of all 5 Phase 2 success criteria

### Phase 3: Accounts and Acceptance
**Goal**: All four accounts (two parent admins, two children) are created and verified, admin conversation oversight is confirmed, and the app is accepted for child use
**Depends on**: Phase 2
**Requirements**: USER-01, USER-02, USER-03, USER-04, ADMN-01, ADMN-02, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. All four accounts log in successfully with registration disabled
  2. Admin accounts can view full conversation logs for child accounts, including timestamps and user identity
  3. Model picker and endpoint selector are not visible when logged in as a child
  4. Jailbreak attempts from a child account fail — role-play, "ignore instructions", and encoding tricks are all rejected
  5. Logged-out users can only view shared links in read-only mode and cannot initiate conversations
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Verify admin accounts + create two child accounts via MongoDB
- [ ] 03-02-PLAN.md — Verify admin oversight of child conversation logs
- [ ] 03-03-PLAN.md — Parent acceptance testing (browser-based, child account perspective)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Deployment | 0/4 | Not started | - |
| 2. Safety Configuration | 1/3 | In Progress|  |
| 3. Accounts and Acceptance | 0/3 | Not started | - |
