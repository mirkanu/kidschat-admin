---
phase: 11-admin-chatbot
plan: 01
subsystem: api
tags: [anthropic, streaming, mongodb, sse, owasp, prompt-injection]

requires:
  - phase: 10-cost-tracking
    provides: MongoDB query patterns and auth patterns used in route handlers

provides:
  - GET /api/admin-chat/context — assembles AdminChatContext snapshot from MongoDB
  - POST /api/admin-chat — streaming Sonnet chat endpoint for admin dashboard
  - buildAdminSystemPrompt() — system prompt builder with UNTRUSTED framing for child logs

affects:
  - 11-admin-chatbot (Plan 02 frontend widget consumes these two routes)
  - 10-cost-tracking (sonnetMessages was hardcoded to 0 pending this phase)

tech-stack:
  added: []
  patterns:
    - "Streaming SSE via client.messages.stream().toReadableStream() returned as plain Response"
    - "OWASP LLM01:2025 indirect prompt injection mitigation via BEGIN/END UNTRUSTED markers"
    - "Auth guard pattern: check session existence (401) then role (403)"

key-files:
  created:
    - src/lib/admin-system-prompt.ts
    - src/app/api/admin-chat/context/route.ts
    - src/app/api/admin-chat/route.ts

key-decisions:
  - "recentAlertCount is 0 — safety alerts are client-side pattern-matches, not stored in MongoDB"
  - "Conversation logs truncated to 500 chars per message to manage context window size"
  - "ADMIN_CHAT_MAX_TOKENS exported as constant (1024) so frontend can reference it"
  - "Context assembled once per widget open (not per message) per v2.2 architecture decision"

patterns-established:
  - "UNTRUSTED content framing: wrap all child-generated text between BEGIN/END UNTRUSTED USER-GENERATED CONTENT markers"
  - "Streaming response pattern: return new Response(stream.toReadableStream()) — no NextResponse wrapper"

requirements-completed: [CHAT-02, CHAT-03, CHAT-04, CHAT-05]

duration: 4min
completed: 2026-04-05
---

# Phase 11 Plan 01: Admin Chatbot Backend Summary

**Streaming Sonnet chat API with OWASP LLM01:2025 prompt-injection hardening, context endpoint assembling MongoDB user/message data, and UNTRUSTED-framed child conversation logs**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-05T14:13:39Z
- **Completed:** 2026-04-05T14:17:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Admin system prompt builder with explicit UNTRUSTED marker framing around all child-generated content (OWASP LLM01:2025 indirect prompt injection mitigation)
- GET /api/admin-chat/context assembles context snapshot: users, 24h message count, last 50 conversation messages, and current children's system prompt text
- POST /api/admin-chat streams Claude Sonnet responses via Anthropic SDK `messages.stream()`, auth-gated to ADMIN role only

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin system prompt builder and context API route** - `55692b1` (feat)
2. **Task 2: Streaming admin chat API route** - `9edb2ab` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/lib/admin-system-prompt.ts` — AdminChatContext interface, ADMIN_CHAT_MAX_TOKENS constant, buildAdminSystemPrompt() with UNTRUSTED framing
- `src/app/api/admin-chat/context/route.ts` — GET endpoint, queries MongoDB for users/messages/conversations, ADMIN auth guard
- `src/app/api/admin-chat/route.ts` — POST streaming endpoint, Anthropic messages.stream(), 401/403 auth guards

## Decisions Made
- recentAlertCount returns 0: safety alert detection is client-side pattern matching in the existing app, not persisted to MongoDB. A future phase would need to add server-side alert persistence to populate this field.
- Conversation log messages truncated to 500 characters each to keep the system prompt from growing unbounded.
- Streaming via `new Response(stream.toReadableStream())` — plain Response, not NextResponse, which is required because NextResponse doesn't accept a ReadableStream body in this pattern.
- Model string `claude-sonnet-4-6-20250514` per v2.2 architecture research.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The `ANTHROPIC_API_KEY` environment variable was already present from prior phases.

## Next Phase Readiness
- Both routes are fully implemented and TypeScript-clean
- Plan 02 (frontend widget) can immediately consume GET /api/admin-chat/context and POST /api/admin-chat
- The widget should fetch context on widget open, then pass it in every chat request body
- No blockers

---
*Phase: 11-admin-chatbot*
*Completed: 2026-04-05*
