# KidsChat — Family AI Chat App

## What This Is

A private, self-hosted AI chat application for two children (Sebastian, 14; Penelope, 12), deployed on Railway using LibreChat. The app provides a safe, parent-controlled interface to Claude Haiku 4.5 with enforced content boundaries rooted in Reformed Christian family values. Each child has their own account with separate chat history and four switchable conversation tone presets. Parents have full oversight through a dedicated admin dashboard with conversation logs, usage analytics, and safety alerts.

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
- ✓ Admin web dashboard deployed on Railway with auth gate — v2.0
- ✓ Conversation log viewer with search, child filtering, and full message threads — v2.0
- ✓ User management CRUD (create, edit, delete accounts) from dashboard — v2.0
- ✓ Usage statistics: messages/day, active hours, tone preset usage with per-child breakdown — v2.0
- ✓ Safety alert detection: redirection and jailbreak pattern matching with event log — v2.0

### Active

- [ ] Trust-focused dashboard home with safety status, recent alerts, and activity digest
- [ ] Safety rules page with parent-friendly summary and expandable full system prompt
- [ ] Parent test mode: embedded chat sandbox + predefined safety scenario buttons
- [ ] Safety system status indicator with last-checked timestamp
- [ ] Activity digest: 24h summary of messages, safety events, and system health
- [ ] Fix users page bug (shows 0 users when 4 exist)

### Out of Scope

- Custom domain — Railway-provided URL is sufficient
- Per-child different system prompts — same safety rules for both
- RAG, embeddings — not needed for children's chat
- Mobile app — browser access is sufficient
- Real-time push notifications — alert log sufficient for now
- Modifying LibreChat config from dashboard — config lives in GitHub Gist

## Current Milestone: v2.1 Parent Trust

**Goal:** Make the admin dashboard a trust center where Emily-Kate can see at a glance that all safety systems are working, understand what rules protect the children, and test the safety boundaries herself.

**Target features:**
- Dashboard home redesigned as trust summary (safety status, alerts, activity digest)
- Safety rules page with friendly explanation + full system prompt
- Parent test mode with chat sandbox and predefined safety scenario buttons
- Safety system status indicator
- Fix users page bug

## Context

Shipped v2.0 on 2026-04-04. Two milestones complete.
- **LibreChat URL:** https://librechat-production-bff2.up.railway.app
- **Admin Dashboard URL:** https://kidschat-admin-production.up.railway.app
- **Config:** https://gist.github.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf
- **Stack:** LibreChat + Next.js 15 admin dashboard, MongoDB, Meilisearch on Railway
- **Admin dashboard stack:** Next.js 15, NextAuth v5, Tailwind CSS v3, shadcn/ui, Recharts, MongoDB direct queries
- **Accounts:** 4 total (2 ADMIN parents, 2 USER children)
- **Codebase:** ~4,400 LOC TypeScript/TSX
- **Known limitation:** LibreChat v0.8.4 has outdated config schema warnings (non-blocking)
- **Known limitation:** Safety detection uses text pattern matching (no ML) — may have false positives/negatives

## Constraints

- **Platform**: Railway deployment
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
| Railway CLI for all ops | Automate everything, no manual dashboard steps | ✓ Good |
| MongoDB TCP proxy for admin | Direct DB access for account creation and conversation oversight | ✓ Good |
| Database name is "test" | Railway template default, not configurable without migration | ⚠️ Revisit — works but non-obvious |
| Safety prompt as identity | Frame rules as AI's values, not external constraints — better jailbreak resistance | ✓ Good |
| Separate Next.js dashboard | Decoupled from LibreChat — independent deploy, own auth, direct MongoDB | ✓ Good — clean separation of concerns |
| Server components query MongoDB directly | Avoids self-referencing fetch auth issues in production | ✓ Good — learned from production bug |
| Recharts for analytics | Lightweight, composable, Tailwind-compatible charting | ✓ Good |
| Text pattern matching for safety | No ML dependency, detects common patterns, fast | ⚠️ Revisit — may need ML for better accuracy |

---
*Last updated: 2026-04-04 after v2.1 milestone start*
