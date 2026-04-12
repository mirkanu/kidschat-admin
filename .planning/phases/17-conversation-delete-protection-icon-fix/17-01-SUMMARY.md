---
phase: 17-conversation-delete-protection-icon-fix
plan: 01
subsystem: database
tags: [mongodb, security, permissions, role-based-access, librechat, railway, icon-fix]

# Dependency graph
requires:
  - phase: 16-librechat-interface-hardening
    provides: LibreChat config Gist + HARDEN-DELETE-01 finding (no config toggle for delete)
  - phase: 15-safety-alert-extension-rate-limiting
    provides: cron pattern, railway.toml, CRON_SECRET
provides:
  - MongoDB role librechat_no_delete_convos blocking remove on conversations + messages
  - MongoDB user librechat_safe used by LibreChat — delete structurally impossible at DB level
  - LibreChat preset icons visible on dark sidebar (Iconify colored SVGs with ?color=%23e2e8f0)
affects: [admin-dashboard, librechat, mongodb]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MongoDB permission restriction: enumerate all collections explicitly (roles are additive, no deny rules) — protected collections omit remove action"
    - "Iconify Design API with ?color=%23e2e8f0 param for baked-in SVG stroke color — no Gist hosting required for colored icons"

key-files:
  created: []
  modified:
    - railway.toml (removed archive-deleted cron)
    - src/app/(dashboard)/conversations/page.tsx (reverted to single conversations collection)
    - src/app/(dashboard)/conversations/[conversationId]/page.tsx (reverted, removed archive fallback)
    - src/components/dashboard/conversations-list.tsx (reverted, removed isDeleted badge)

key-decisions:
  - "MongoDB permission-based delete blocking chosen over periodic archive cron — immediate enforcement, no data loss window, structurally impossible to circumvent from LibreChat code"
  - "MongoDB roles are strictly additive (no deny rules) — must enumerate every collection explicitly rather than wildcard + restriction"
  - "librechat_safe user role: find/insert/update on conversations+messages; full readWrite on all 35 other LibreChat collections; role name librechat_no_delete_convos"
  - "Restricted user connection uses internal Railway hostname (mongodb.railway.internal) — private network, no external exposure"
  - "archived_conversations and archived_messages dropped — cleanup from abandoned archive cron approach"
  - "Public MongoDB proxy (switchyard.proxy.rlwy.net:57501) used for external mongosh admin tasks — discovered via Railway GraphQL API v2"
  - "customCSS NOT in LibreChat v0.8.x schema — CSS delete button hide skipped to avoid ZodError; dead delete button is acceptable since MongoDB blocks the actual operation"

patterns-established:
  - "MongoDB restriction: getCollectionNames() to enumerate all, build privilege array per-collection, protected ones exclude remove"
  - "Railway GraphQL API v2 used to discover public TCP proxy for Railway-internal services not accessible via railway run"

requirements-completed: [HARDEN-DELETE-02, POLISH-ICONS-02]

# Metrics
duration: 90min
completed: 2026-04-12
tasks_completed: 2
tasks_total: 3
files_modified: 4
---

# Phase 17 Plan 01: Conversation Delete Protection + Icon Fix Summary

**MongoDB restricted user `librechat_safe` with role `librechat_no_delete_convos` (46 privilege entries across 37 collections) blocks LibreChat from hard-deleting conversations — parent oversight enforced at the database driver level, structurally impossible to circumvent**

## Performance

- **Duration:** ~90 min total (Tasks 1+2 original: 44 min; pivot execution: 28 min; incident recovery + UAT: ~18 min)
- **Started:** 2026-04-12T13:40:00Z (original Task 1)
- **Completed:** 2026-04-12 (UAT approved)
- **Tasks:** 2 code tasks + MongoDB admin operations + UAT
- **Files modified:** 4

## Accomplishments

- Researched LibreChat v0.8.4 delete mechanism: `DELETE /api/convos` hard-deletes both `conversations` and `messages` atomically, no soft-delete path, no config toggle, no `customCSS` available
- Parent rejected 5-minute archive cron approach ("5 minute delay not good enough") — pivoted to MongoDB permission-based blocking
- Created MongoDB role `librechat_no_delete_convos` with 46 privilege entries: `conversations` + `messages` get find/insert/update only (no remove); all 35 other LibreChat collections get full readWrite
- Created restricted user `librechat_safe` and updated LibreChat's `MONGO_URI` — verified "Connected to MongoDB" in deploy logs with no auth errors
- Verified restriction via 5 mongosh tests: read conversations (PASS), listCollections (PASS), deleteOne on conversations (BLOCKED, code 13), deleteOne on messages (BLOCKED, code 13), deleteOne on sessions (ALLOWED)
- Fixed preset icons: swapped unpkg lucide-static URLs (black stroke, invisible on dark sidebar) to Iconify API URLs with `?color=%23e2e8f0` (slate-200, clearly visible)
- Investigated CSS delete button hiding — confirmed NOT possible (no `customCSS` in LibreChat v0.8.x schema); dead button is acceptable since MongoDB blocks the actual operation
- Dropped `archived_conversations` + `archived_messages` collections — cleanup from abandoned archive cron approach
- Reverted admin dashboard to clean state — no archive queries, no "Deleted by child" badges
- UAT approved: delete protection confirmed, icons confirmed visible, no regressions on chat or image generation

## Task Commits

1. **Task 1: Research LibreChat delete mechanism** - `945268c` (research/docs)
2. **Task 2: Implement archive cron + icon fix + deploy** - `2c80db0`, `8b3413b` (feat — LATER REVERTED)
3. **Pivot Step 1: Remove archive cron + revert admin dashboard** - `c155ae7` (refactor)
4. **Pivot Step 2: Create restricted MongoDB user** - `8c60427` (feat, empty code commit — DB-only operation)

## Files Created/Modified

- `railway.toml` — removed archive-deleted cron entry
- `src/app/(dashboard)/conversations/page.tsx` — reverted to single `conversations` collection query
- `src/app/(dashboard)/conversations/[conversationId]/page.tsx` — removed archive fallback, clean implementation
- `src/components/dashboard/conversations-list.tsx` — removed isDeleted badge + Trash2 icon

Note: The primary deliverable (MongoDB role + user) was implemented via mongosh directly with no git-tracked code changes. The Railway LibreChat service's `MONGO_URI` env var was updated to use `librechat_safe` credentials.

## Decisions Made

- **MongoDB permission-based blocking is superior** — enforced at the driver level regardless of what LibreChat's UI or API does. Zero data loss window. No cron timing dependency.
- **MongoDB roles are additive only** — cannot grant readWrite on a wildcard collection and then restrict specific collections. Wildcard privileges add on top of specific ones, they never override. Solution: enumerate every collection explicitly.
- **Restricted user on internal Railway network** — `librechat_safe` uses `mongodb.railway.internal:27017`, consistent with how LibreChat previously connected.
- **Railway GraphQL API for external admin access** — `railway run` cannot resolve `mongodb.railway.internal` DNS from local machine. Used GraphQL API to discover `switchyard.proxy.rlwy.net:57501` public TCP proxy.
- **Password URL-encoding required** — special chars in MongoDB password (`#`, `$`, `!`) must be percent-encoded in the URI string.
- **CSS delete button hide not viable** — `customCSS` is absent from LibreChat v0.8.x config schema; adding it would cause ZodError on startup. The delete button remains visible but clicking it produces a MongoDB authorization error (code 13) — the conversation is never removed.

## Deviations from Plan

### User-Requested Pivot

**Parent rejected archive cron approach** at UAT checkpoint (Task 3): "this 5 minute delay is not good enough. Can we not disable delete or remove its function?"

**Pivot:** MongoDB permission-based delete blocking. Reverted all archive cron code and implemented restricted MongoDB user instead. Outcome is superior — structural enforcement at driver level beats periodic backup.

### Auto-resolved: MongoDB wildcard restriction limitation

- **Found during:** Pivot Step 2 design
- **Issue:** MongoDB roles are additive — granting `readWrite` on collection `""` (wildcard) and restricting specific collections doesn't work because specific privileges add to wildcard, not override
- **Fix:** Enumerated all 37 LibreChat collections explicitly via `getCollectionNames()`. Protected collections get `[find, insert, update]`, all others get full actions including `remove`. Total: 46 privilege entries.
- **Verification:** 5 mongosh tests — delete blocked on conversations/messages (code 13), allowed on sessions

---

**Total deviations:** 1 user-requested pivot (archive cron → MongoDB permissions), 1 auto-resolved architectural constraint (wildcard → explicit enumeration)
**Impact:** Outcome is superior to original plan — structural enforcement beats periodic backup.

## Incidents During Execution

**Incident 1: Accidental admin code deployed to LibreChat service**
- During archive cron phase (later reverted), ran `railway up` on the wrong Railway service, deploying the Next.js admin dashboard code to the LibreChat Docker container.
- LibreChat became unresponsive. Fixed by redeploying from `Dockerfile.librechat` via `railway up --service librechat`.

**Incident 2: listCollections auth errors due to incomplete initial role**
- First role creation attempt only granted per-collection data-access privileges but omitted the `listCollections` system action on the database.
- LibreChat's Mongoose ODM calls `listCollections` on startup to discover the schema. Startup failed with auth errors.
- Fix: dropped the initial role, recreated it with explicit `listCollections` + `find` on the database resource, plus the full 46 per-collection privilege entries.

## Known Limitation

The delete button remains visible in LibreChat's sidebar UI (Option F / CSS hiding not available in v0.8.x). When Sebastian clicks it, LibreChat sends `DELETE /api/convos` to MongoDB via the `librechat_safe` user — MongoDB returns error code 13 (not authorized). LibreChat shows an error in its UI. The conversation is NOT removed. This is acceptable: the UI is confusing for a moment but parent oversight is preserved structurally.

## UAT Results

All 3 tests passed (approved 2026-04-12):
1. **Delete protection** — Conversation stays after delete attempt, visible in admin dashboard
2. **Icons** — Light gray, clearly visible on dark LibreChat sidebar
3. **No regressions** — Chat and image generation work normally

## Next Phase Readiness

- HARDEN-DELETE-02 fully satisfied: children cannot delete conversations from MongoDB — blocked at driver level regardless of what LibreChat's code does
- POLISH-ICONS-02 satisfied: Iconify API light-colored icons (`?color=%23e2e8f0`) render correctly on dark sidebar
- LibreChat and admin dashboard deployed and healthy
- v2.6 Oversight Protection milestone complete

## Self-Check: PASSED

Commits verified: `945268c` (research), `2c80db0`/`8b3413b` (archive cron, reverted), `c155ae7` (revert), `8c60427` (restricted user)
MongoDB restriction verified: `librechat_safe` cannot execute `remove` on conversations/messages (code 13)
LibreChat connected successfully with restricted credentials (deploy logs confirm "Connected to MongoDB")
UAT: all 3 tests approved by parent

---
*Phase: 17-conversation-delete-protection-icon-fix*
*Completed: 2026-04-12*
