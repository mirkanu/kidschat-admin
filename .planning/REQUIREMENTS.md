# Requirements: KidsChat

**Defined:** 2026-04-03
**Core Value:** Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Deployment

- [ ] **DEPL-01**: LibreChat Lite template deployed on Railway with MongoDB and Meilisearch provisioned
- [ ] **DEPL-02**: LibreChat accessible at Railway-provided public URL
- [ ] **DEPL-03**: ANTHROPIC_API_KEY configured and Claude Haiku 4.5 responding to messages
- [ ] **DEPL-04**: Baseline deployment verified — can send a message and receive a response

### Access Control

- [ ] **AUTH-01**: Email registration disabled (`ALLOW_REGISTRATION=false`)
- [ ] **AUTH-02**: Social registration disabled (`ALLOW_SOCIAL_REGISTRATION=false`)
- [ ] **AUTH-03**: Social login disabled (`ALLOW_SOCIAL_LOGIN=false`)
- [ ] **AUTH-04**: Only manually created accounts can log in

### Model Locking

- [x] **MODL-01**: Claude Haiku 4.5 is the only available model (`ANTHROPIC_MODELS=claude-haiku-4-5`)
- [x] **MODL-02**: Anthropic is the only available endpoint (`ENDPOINTS=anthropic`)
- [x] **MODL-03**: Model selection hidden from UI (`interface.modelSelect: false`)
- [x] **MODL-04**: Model lock enforced server-side (`modelSpecs.enforce: true`)

### Safety System Prompt

- [x] **SAFE-01**: Safety system prompt enforced on all conversations via `promptPrefix`
- [x] **SAFE-02**: Content aligned with Reformed Christian values
- [x] **SAFE-03**: No profanity generated or reproduced, even if requested
- [x] **SAFE-04**: Age-appropriate content only — no violence, sexual content, drugs, or mature themes
- [x] **SAFE-05**: Anti-homework-cheating — guide and explain, never give direct answers
- [x] **SAFE-06**: System prompt addresses common jailbreak patterns by name
- [x] **SAFE-07**: System prompt is self-reinforcing — detects and redirects manipulation attempts

### Configuration

- [ ] **CONF-01**: `librechat.yaml` hosted as GitHub Gist
- [ ] **CONF-02**: `CONFIG_PATH` environment variable points to raw Gist URL (with filename)
- [ ] **CONF-03**: All secrets in Railway env vars only — zero secrets in Gist YAML

### Tone Presets

- [x] **TONE-01**: Friendly Tutor preset — warm, encouraging, explains at their level
- [x] **TONE-02**: Casual Buddy preset — relaxed, fun, uses humor
- [x] **TONE-03**: Balanced Helper preset — helpful and kind, straightforward answers
- [x] **TONE-04**: Standard Formal preset — similar to default Claude Chat experience
- [x] **TONE-05**: Safety rules identical across all tone presets
- [x] **TONE-06**: Kids can switch tone presets from the UI

### User Management

- [x] **USER-01**: Parent admin account created and verified (you)
- [x] **USER-02**: Parent admin account created and verified (Emily-Kate)
- [x] **USER-03**: One account per child created (2 accounts)
- [x] **USER-04**: All accounts can log in with registration disabled

### Admin Oversight

- [x] **ADMN-01**: Admins can review full conversation logs for all child accounts
- [x] **ADMN-02**: Conversation logs include timestamps, user identity, and full message history

### Acceptance Testing

- [x] **TEST-01**: Basic jailbreak attempts fail against system prompt (role-play, "ignore instructions", encoding tricks)
- [x] **TEST-02**: Model picker and endpoint selector are not visible
- [x] **TEST-03**: Tone switching works — each preset produces noticeably different conversational style
- [x] **TEST-04**: Web search respects safety guardrails
- [x] **TEST-05**: Logged-out users can only view shared links (read-only)

## v2 Requirements

### Enhanced Safety

- **SAFE-V2-01**: Per-child different system prompts (age-appropriate adjustments)

### Customization

- **CUST-V2-01**: Custom domain pointing to Railway deployment
- **CUST-V2-02**: UI branding customization (logo, colors)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom frontend | LibreChat provides the UI |
| RAG / embeddings | Not needed for children's chat |
| Mobile app | Browser access is sufficient |
| Per-request parental approval | LibreChat has no built-in approval workflow |
| Custom code / development | This is a configuration-only project |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPL-01 | Phase 1 | Pending |
| DEPL-02 | Phase 1 | Pending |
| DEPL-03 | Phase 1 | Pending |
| DEPL-04 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| CONF-01 | Phase 1 | Pending |
| CONF-02 | Phase 1 | Pending |
| CONF-03 | Phase 1 | Pending |
| MODL-01 | Phase 2 | Complete |
| MODL-02 | Phase 2 | Complete |
| MODL-03 | Phase 2 | Complete |
| MODL-04 | Phase 2 | Complete |
| SAFE-01 | Phase 2 | Complete |
| SAFE-02 | Phase 2 | Complete |
| SAFE-03 | Phase 2 | Complete |
| SAFE-04 | Phase 2 | Complete |
| SAFE-05 | Phase 2 | Complete |
| SAFE-06 | Phase 2 | Complete |
| SAFE-07 | Phase 2 | Complete |
| TONE-01 | Phase 2 | Complete |
| TONE-02 | Phase 2 | Complete |
| TONE-03 | Phase 2 | Complete |
| TONE-04 | Phase 2 | Complete |
| TONE-05 | Phase 2 | Complete |
| TONE-06 | Phase 2 | Complete |
| USER-01 | Phase 3 | Complete |
| USER-02 | Phase 3 | Complete |
| USER-03 | Phase 3 | Complete |
| USER-04 | Phase 3 | Complete |
| ADMN-01 | Phase 3 | Complete |
| ADMN-02 | Phase 3 | Complete |
| TEST-01 | Phase 3 | Complete |
| TEST-02 | Phase 3 | Complete |
| TEST-03 | Phase 3 | Complete |
| TEST-04 | Phase 3 | Complete |
| TEST-05 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation*
