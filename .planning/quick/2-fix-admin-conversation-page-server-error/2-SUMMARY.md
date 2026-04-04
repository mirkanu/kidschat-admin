---
phase: quick-2
plan: "01"
subsystem: admin-dashboard
tags: [bug-fix, mongodb, server-components, auth]
dependency_graph:
  requires: []
  provides: [working-conversation-pages]
  affects: [conversations-list-page, conversation-detail-page]
tech_stack:
  added: []
  patterns: [direct-mongodb-query-in-server-component]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/conversations/page.tsx
    - src/app/(dashboard)/conversations/[conversationId]/page.tsx
decisions:
  - Server components query MongoDB directly — never fetch their own API routes
metrics:
  duration: "~5 minutes"
  completed: "2026-04-04"
---

# Quick Task 2: Fix Admin Conversation Page Server Error — Summary

**One-liner:** Replaced self-referencing `fetch(/api/conversations)` calls in server components with direct MongoDB queries via `getMongoClient()`, eliminating 401/HTML-parse crash.

## What Was Done

### Root Cause

Both admin conversation pages (`/conversations` and `/conversations/[id]`) were server components that fetched their own API routes at startup. The API routes require an authenticated session (via `auth()`), but when a server component calls `fetch()` without explicitly forwarding cookies, NextAuth returns 401 with an HTML error page. The server component then called `res.json()` on that HTML, throwing a `SyntaxError`.

### Fix

**Task 1 — Conversations list page** (`src/app/(dashboard)/conversations/page.tsx`):
- Removed `fetch(baseUrl/api/conversations)` and `process.env.NEXTAUTH_URL`
- Replaced `getConversations()` with a direct `getMongoClient()` call running the same `$lookup` aggregation pipeline as the API route
- Initial load shows all conversations (unfiltered); client-side search/filter continues through the API route via `ConversationsList`

**Task 2 — Conversation detail page** (`src/app/(dashboard)/conversations/[conversationId]/page.tsx`):
- Removed `fetch(baseUrl/api/conversations/${conversationId})` and `process.env.NEXTAUTH_URL`
- Replaced with direct `db.collection("conversations").findOne()` + `db.collection("messages").find()` queries
- Same serialization logic as API route: `messageId`, `text`, `isCreatedByUser`, `sender`, `createdAt` (ISO string)
- Not-found JSX path unchanged

## Verification

- `tsc --noEmit`: no errors in project source files
- `npm run build`: succeeded, all routes built cleanly
- API routes still exist unchanged (client-side ConversationsList still uses them for search/filter)
- No `fetch.*api/conversations` remaining in server components

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash    | Description                                                              |
|---------|--------------------------------------------------------------------------|
| 7ebf0a0 | fix(quick-2): replace self-referencing fetch with direct MongoDB queries |

## Self-Check: PASSED

- `/data/home/KidAI/src/app/(dashboard)/conversations/page.tsx` — FOUND
- `/data/home/KidAI/src/app/(dashboard)/conversations/[conversationId]/page.tsx` — FOUND
- Commit 7ebf0a0 — FOUND
