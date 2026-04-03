# KidsChat — Family AI Chat App

## What This Is

A private, self-hosted AI chat application for two children (ages 10–14), deployed on Railway using LibreChat. The app provides a safe, parent-controlled interface to Claude Haiku 4.5 with enforced content boundaries rooted in Reformed Christian family values. Each child gets their own account with separate chat history and switchable conversation tone presets.

## Core Value

Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] LibreChat deployed on Railway via one-click template, accessible at public URL
- [ ] Registration closed — only manually created accounts can log in
- [ ] Social login disabled
- [ ] Claude Haiku 4.5 is the only available model (no model picker visible)
- [ ] Safety system prompt enforced on all conversations
- [ ] Content boundaries: Reformed theology alignment, no profanity, age-appropriate content, no homework cheating (guide, don't give answers)
- [ ] Tone presets available: Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal
- [ ] One account per child created and tested
- [ ] System prompt resilient to basic jailbreak attempts
- [ ] librechat.yaml config hosted as GitHub Gist, referenced via CONFIG_PATH

### Out of Scope

- Custom domain — Railway-provided URL is sufficient for v1
- Usage monitoring/logging — trust-based for now
- Per-child different system prompts — same safety rules for both
- UI customization — LibreChat defaults are fine
- RAG, embeddings, or file upload — not needed
- Custom frontend — LibreChat provides this
- Mobile app — browser access is sufficient

## Context

- Parent already has a paid Railway account with existing projects (Reforma, Christian Debates, Josie)
- This will be a new Railway project, not added to an existing one
- Parent has existing Anthropic API key with credits
- LibreChat provides a ChatGPT-style UI with preset support, user management, and configurable model endpoints
- MongoDB and Meilisearch are provisioned automatically by Railway's LibreChat template
- Configuration via librechat.yaml allows locking models, setting system prompts, and defining presets

## Constraints

- **Platform**: Railway deployment using official LibreChat one-click template
- **Model**: Claude Haiku 4.5 only — cost-effective for children's usage
- **Auth**: No registration, no social login — admin-created accounts only
- **Content**: Must align with Reformed Christian family values
- **Config**: librechat.yaml hosted as GitHub Gist for easy editing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LibreChat over custom app | Proven UI, user management, preset support — no need to build from scratch | — Pending |
| Claude Haiku 4.5 | Cost-effective, fast, sufficient quality for children's conversations | — Pending |
| GitHub Gist for config | Easy to edit without redeploying, version history built-in | — Pending |
| Tone presets (not per-child prompts) | Kids choose their experience; safety rules are universal | — Pending |

---
*Last updated: 2026-04-03 after initialization*
