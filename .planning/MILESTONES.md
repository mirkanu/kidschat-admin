# Milestones

## v2.1 Parent Trust (Shipped: 2026-04-05)

**Phases completed:** 3 phases, 6 plans
**Timeline:** 2026-04-04 → 2026-04-05
**Lines of code:** 5,879 TypeScript/TSX (+1,479 from v2.0)

**Key accomplishments:**
- Trust-focused dashboard home: safety status indicator, 24h activity digest, recent alerts preview, quick-link navigation
- Users page bug fixed (self-referencing fetch → direct MongoDB query)
- Safety Rules transparency page: parent-friendly content boundary summary, expandable full system prompt, tone preset descriptions
- Parent Test Mode: embedded chat sandbox calling Claude Haiku 4.5 with safety prompt, predefined scenario buttons, real-time safety detection badges
- Improved safety pattern detection: 26 redirect patterns with descriptive labels (up from 10)

**Delivered:** A trust center for parents — Emily-Kate can see all safety systems are active, read every content rule in plain language, and personally test the safety boundaries through an embedded chat sandbox.

---

## v2.0 Admin Dashboard (Shipped: 2026-04-04)

**Phases completed:** 3 phases, 8 plans
**Timeline:** 2026-04-03 → 2026-04-04 (2 days)
**Git range:** fcbff81..a6c8f2b (50+ commits)
**Lines of code:** 4,400 TypeScript/TSX

**Key accomplishments:**
- Next.js 15 admin dashboard deployed to Railway with NextAuth v5 admin-only auth gate
- Conversation monitoring: searchable list with per-child filtering and full chat-bubble message threads
- User management: full CRUD for accounts with role management, password hashing, and self-deletion protection
- Usage analytics: Recharts charts for messages/day, active hours, and tone preset usage with per-child breakdown toggle
- Safety alert detection: pattern-matching library (10 redirect + 15 jailbreak patterns) with timestamped event log and conversation links

**Delivered:** A standalone admin dashboard giving parents browser-based oversight of all children's AI conversations, user account management, usage analytics, and automated safety alert detection.

---

## v1.0 KidsChat MVP (Shipped: 2026-04-04)

**Phases completed:** 3 phases, 10 plans
**Timeline:** 2026-04-03 (single day, ~12 hours)
**Git range:** fff0453..6d1c9c4 (26 commits)

**Key accomplishments:**
- LibreChat Lite deployed on Railway with MongoDB + Meilisearch, two admin accounts created
- Anthropic API connected, all registration and social login paths closed
- GitHub Gist config wired via CONFIG_PATH with modelSpecs enforcement
- Production safety system prompt with Reformed Christian values, jailbreak resistance, and 4 tone presets
- Four family accounts operational (2 ADMIN parents, 2 USER children via MongoDB insert)
- Admin conversation oversight verified via MongoDB direct queries

**Delivered:** A private, locked-down AI chat for two children with parent-controlled safety guardrails, four conversational tone presets, and full conversation oversight.

---

