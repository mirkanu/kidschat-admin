# KidsChat — Family AI Chat App

## What This Is

A private, self-hosted AI chat application for two children (Sebastian, 14; Penelope, 12), deployed on Railway using LibreChat. The app provides a safe, parent-controlled interface to Claude Haiku 4.5 with enforced content boundaries rooted in Reformed Christian family values. Each child has their own account with separate chat history and four switchable conversation tone presets. Two parent admins (Manuel and Emily-Kate) have full oversight via MongoDB conversation logs.

## Core Value

Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.

## Requirements

### Validated

- ✓ LibreChat deployed on Railway via Lite template, accessible at public URL — v1.0
- ✓ Registration closed — only manually created accounts can log in — v1.0
- ✓ Social login disabled — v1.0
- ✓ Claude Haiku 4.5 is the only available model (no model picker visible) — v1.0
- ✓ Safety system prompt enforced on all conversations — v1.0
- ✓ Content boundaries: Reformed theology alignment, no profanity, age-appropriate, anti-cheating — v1.0
- ✓ Tone presets: Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal — v1.0
- ✓ Two child accounts created and tested (Sebastian, Penelope) — v1.0
- ✓ System prompt resilient to basic jailbreak attempts — v1.0
- ✓ librechat.yaml hosted as GitHub Gist, referenced via CONFIG_PATH — v1.0
- ✓ Two admin accounts with conversation oversight capability — v1.0

### Active

- [ ] Admin web dashboard for conversation oversight and user management
- [ ] View all children's conversation logs with timestamps and search
- [ ] Create, edit, delete user accounts from the dashboard
- [ ] Usage statistics — messages per day, active hours, most-used presets
- [ ] Real-time alerts when safety prompt is triggered or jailbreak attempted

### Out of Scope

- Custom domain — Railway-provided URL is sufficient
- Per-child different system prompts — same safety rules for both
- RAG, embeddings — not needed for children's chat
- Mobile app — browser access is sufficient

## Current Milestone: v2.0 Admin Dashboard

**Goal:** Build a standalone Next.js admin dashboard on Railway that connects to the same MongoDB, giving parents a browser-based interface for conversation oversight, user management, usage stats, and safety alerts.

**Target features:**
- Conversation log viewer (all kids' chats, searchable, with timestamps)
- User management (create/edit/delete accounts, change passwords, assign roles)
- Usage statistics (messages per day, active hours, preset usage)
- Real-time safety alerts (jailbreak attempts, safety prompt triggers)

## Context

Shipped v1.0 on 2026-04-03. Configuration-only project — zero custom code.
- **URL:** https://librechat-production-bff2.up.railway.app
- **Config:** https://gist.github.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf
- **Stack:** LibreChat (ghcr.io/danny-avila/librechat-dev:latest), MongoDB, Meilisearch on Railway
- **Accounts:** 4 total (2 ADMIN parents, 2 USER children)
- **Oversight:** MongoDB direct queries for conversation logs (API doesn't expose cross-user conversations)
- **Known limitation:** LibreChat v0.8.4 has outdated config schema warnings (non-blocking)

## Constraints

- **Platform**: Railway deployment using official LibreChat Lite template
- **Model**: Claude Haiku 4.5 only — cost-effective for children's usage
- **Auth**: No registration, no social login — admin-created accounts only
- **Content**: Must align with Reformed Christian family values
- **Config**: librechat.yaml hosted as GitHub Gist for easy editing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LibreChat over custom app | Proven UI, user management, preset support — no need to build from scratch | ✓ Good |
| Claude Haiku 4.5 | Cost-effective, fast, sufficient quality for children's conversations | ✓ Good |
| GitHub Gist for config | Easy to edit without redeploying, version history built-in | ✓ Good — requires redeploy to pick up changes |
| Tone presets (not per-child prompts) | Kids choose their experience; safety rules are universal | ✓ Good |
| Railway CLI for all ops | Automate everything, no manual dashboard steps | ✓ Good — except SSH stdout is swallowed |
| MongoDB TCP proxy for admin | Direct DB access for account creation and conversation oversight | ✓ Good — required since LibreChat API lacks cross-user conversation access |
| Database name is "test" | Railway template default, not configurable without migration | ⚠️ Revisit — works but non-obvious |
| Safety prompt as identity | Frame rules as AI's values, not external constraints — better jailbreak resistance | ✓ Good |

---
*Last updated: 2026-04-04 after v2.0 milestone start*
