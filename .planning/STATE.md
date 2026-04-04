---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Admin Dashboard
status: planning
stopped_at: Completed 06-02-PLAN.md
last_updated: "2026-04-04T17:48:26.870Z"
last_activity: "2026-04-04 — Completed quick task 2: Fix admin conversation page server error"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 8
  completed_plans: 8
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-04)

**Core value:** Children can safely explore and learn through AI conversation, with content guardrails that a parent controls and trusts.
**Current focus:** Phase 4 — Foundation (Next.js app, Railway deploy, admin auth)

## Current Position

Phase: 4 of 6 (Foundation)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-04-04 — Completed quick task 2: Fix admin conversation page server error

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (from v1.0):**
- Total plans completed: 10
- Timeline: 1 day
- Average: ~10 plans/day

**v2.0 (current):**
- Plans completed: 0
- Phases complete: 0/3

## Accumulated Context

### Decisions

- MongoDB database name is "test" (Railway template default)
- MongoDB TCP proxy at switchyard.proxy.rlwy.net:57501 for external access
- LibreChat API doesn't expose cross-user conversations — MongoDB queries required
- Railway CLI authenticated, GitHub CLI authenticated as mirkanu
- LibreChat URL: https://librechat-production-bff2.up.railway.app
- Dashboard is a separate Next.js Railway service connecting to the same MongoDB
- Admin auth gates the entire dashboard — non-admin and unauthenticated users are refused
- [Phase 04-foundation]: Used Tailwind CSS v3 (not v4) for shadcn/ui compatibility — v4 PostCSS API incompatible with tailwind.config.ts pattern
- [Phase 04-foundation]: Used TypeScript 5 (not v6 beta) — TS6 stricter CSS import rules break standard Next.js layout.tsx
- [Phase 04-foundation]: next-auth installed as beta (^5.0.0-beta.30) — v5 stable does not exist
- [Phase 04-foundation]: throw new Error('ACCESS_DENIED') in NextAuth authorize() to distinguish non-admin login from wrong password
- [Phase 04-foundation]: NextAuth v5 auth() export used directly as middleware — no manual redirect logic needed
- [Phase 04-foundation]: Split NextAuth config: auth.config.ts (edge-safe) + auth.ts (Node.js/MongoDB) to prevent MongoDB in Edge Runtime
- [Phase 04-foundation]: getMongoClient() lazy function replaces module-level clientPromise — avoids Docker build-time env var throw
- [Phase 04-foundation]: KidsChat Admin deployed to Railway: https://kidschat-admin-production.up.railway.app
- [Phase 05-conversations-and-user-management]: MongoDB $lookup uses $toString on users._id to match conversations.user stored as plain string
- [Phase 05-conversations-and-user-management]: NavSidebar converted to client component with usePathname for active-link highlighting
- [Phase 05-conversations-and-user-management]: ConversationsList filters client-side from initialConversations (no re-fetch) for instant UX
- [Phase 05-conversations-and-user-management]: Email is readonly in edit dialog — email changes not supported to avoid LibreChat user sync issues
- [Phase 05-conversations-and-user-management]: UserSummary interface exported from API route and imported by UI components for single source of truth
- [Phase 05-02]: MessageThread receives all data as props from server component — no client-side fetching needed
- [Phase 05-02]: createdAt serialization in API handles both Date and string MongoDB values for robustness
- [Phase 06-analytics-and-safety-alerts]: Recharts chosen for chart rendering — lightweight, composable, Tailwind-compatible
- [Phase 06-analytics-and-safety-alerts]: Analytics API aggregates from messages collection via lookup chain: messages -> conversations -> users using $toString on ObjectId
- [Phase 06-analytics-and-safety-alerts]: Dashboard home messages-30d count added via getStats() — no separate API call needed
- [Phase 06-analytics-and-safety-alerts]: Alerts page uses direct MongoDB query in server component rather than fetching /api/alerts — avoids HTTP auth complexity in server-to-server calls
- [Phase 06-analytics-and-safety-alerts]: DAN jailbreak pattern uses case-sensitive word boundary regex (\bDAN\b) to avoid false positives from words containing 'dan'

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | UI broken on mobile, menu stuck and consuming 80% width | 2026-04-04 | 2f4db60 | [1-ui-broken-on-mobile](./quick/1-ui-broken-on-mobile-menu-stuck-and-consu/) |
| 2 | Admin conversation pages crash with SyntaxError (HTML parsed as JSON) | 2026-04-04 | 7ebf0a0 | [2-fix-admin-conversation-page-server-error](./quick/2-fix-admin-conversation-page-server-error/) |

### Pending Todos

None yet.

### Blockers/Concerns

- Safety alert detection (ALRT-01, ALRT-02) requires a strategy for identifying safety events in conversation data — no dedicated flag exists in LibreChat's MongoDB schema. Approach TBD during Phase 6 planning.

## Session Continuity

Last session: 2026-04-04T17:37:38.711Z
Stopped at: Completed 06-02-PLAN.md
Resume file: None
