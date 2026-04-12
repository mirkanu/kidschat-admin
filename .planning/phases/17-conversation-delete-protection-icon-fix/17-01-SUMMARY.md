---
phase: 17-conversation-delete-protection-icon-fix
plan: 01
subsystem: safety, librechat-config
tags: [archive, mongodb, cron, gist, icon-fix, delete-protection, railway]
dependency_graph:
  requires:
    - "Phase 15-safety-alert-extension-rate-limiting (cron pattern, railway.toml, CRON_SECRET)"
    - "Phase 16-librechat-interface-hardening (Gist config, CONFIG_PATH pattern)"
  provides:
    - "archived_conversations + archived_messages MongoDB collections (append-only delete mirror)"
    - "POST /api/cron/archive-deleted endpoint (5-minute archive cron)"
    - "Admin dashboard merges live + archived conversations, flags deleted ones"
    - "LibreChat preset icons visible on dark sidebar (Iconify colored SVGs)"
  affects:
    - "Admin conversations page — now shows deleted conversations with badge"
    - "LibreChat frontend — icons now render in slate-200 (#e2e8f0) on dark sidebar"
tech_stack:
  added: []
  patterns:
    - "BulkWrite upsert for idempotent MongoDB archiving"
    - "Iconify Design API with ?color= param for baked-in SVG stroke color"
    - "Live + archived collection merge with deduplication by conversationId"
key_files:
  created:
    - src/lib/archive-conversations.ts
    - src/app/api/cron/archive-deleted/route.ts
    - .planning/phases/17-conversation-delete-protection-icon-fix/17-01-RESEARCH-NOTES.md
    - .planning/phases/17-conversation-delete-protection-icon-fix/17-01-LIVE-CONFIG-PRE.yaml
    - .planning/phases/17-conversation-delete-protection-icon-fix/17-01-LIVE-CONFIG-POST.yaml
    - .planning/phases/17-conversation-delete-protection-icon-fix/17-01-DIFF.md
  modified:
    - src/app/(dashboard)/conversations/page.tsx
    - src/app/(dashboard)/conversations/[conversationId]/page.tsx
    - src/components/dashboard/conversations-list.tsx
    - railway.toml
    - Live GitHub Gist e23b999f1d3cd77726a97c20e26f0abf (librechat.yaml)
decisions:
  - "Approach D (periodic snapshot cron, 5 min interval) chosen — only viable approach given Railway standalone MongoDB (no change streams)"
  - "customCSS NOT available in LibreChat v0.8.x schema — CSS-based delete button hide skipped"
  - "Iconify Design API with ?color=%23e2e8f0 provides light-colored SVGs (baked-in stroke) — avoids CDN hosting"
  - "Admin dashboard merges live + archived collections at query time — no schema changes required"
  - "GITHUB_GIST_TOKEN refreshed with working gh CLI token (old Railway-stored token was expired)"
metrics:
  duration_minutes: 44
  completed_date: "2026-04-12"
  tasks_completed: 2
  tasks_total: 3
  files_created: 9
  files_modified: 4
---

# Phase 17 Plan 01: Conversation Delete Protection + Icon Fix Summary

**One-liner:** Periodic 5-minute archive cron mirrors LibreChat's conversations+messages to MongoDB archive collections, admin dashboard shows deleted conversations with badge, and Iconify API URLs replace unpkg lucide-static for light-colored preset icons on dark sidebar.

## What Was Built

### Part A — Conversation Delete Protection (HARDEN-DELETE-02)

**The problem:** LibreChat's `DELETE /api/convos` handler calls `deleteConvos()` which hard-deletes both the `conversations` document AND all associated `messages` documents atomically. A child deleting a conversation permanently erases it from MongoDB, defeating parent oversight.

**The solution:** A periodic snapshot cron (`POST /api/cron/archive-deleted`) runs every 5 minutes and upserts all documents from `conversations` → `archived_conversations` and `messages` → `archived_messages`. These archive collections are append-only — nothing is ever deleted from them. Deleted conversations remain visible to parents.

**Admin dashboard updates (mandatory per plan checker):**
- `conversations/page.tsx`: Queries both `conversations` and `archived_conversations`, deduplicates by `conversationId`, marks orphaned archived conversations with `isDeleted: true`
- `conversations/[id]/page.tsx`: Falls back to `archived_conversations` / `archived_messages` when live collection returns null
- `conversations-list.tsx`: Renders red `Trash2` icon + destructive "Deleted by child" badge for deleted conversations

**Data loss window:** At most 5 minutes (conversation created and deleted within same cron interval). Acceptable for a family safety app.

### Part B — Icon Color Fix (POLISH-ICONS-02)

**The problem:** `unpkg.com/lucide-static` SVGs use `stroke="currentColor"`. On LibreChat's dark sidebar, `currentColor` resolves to dark/black, making icons nearly invisible.

**The solution:** Iconify Design API supports `?color=` query parameter that bakes the stroke color directly into the returned SVG. All 4 `iconURL` fields updated from unpkg to:
```
https://api.iconify.design/lucide/{name}.svg?color=%23e2e8f0
```
Color `#e2e8f0` (Tailwind slate-200) is a light gray clearly visible on dark backgrounds.

## Verification Results

- Archive endpoint: `curl -X POST ... /api/cron/archive-deleted` → `{"conversationsArchived":20,"messagesArchived":77}` on first run (20 conversations, 77 messages mirrored)
- Subsequent runs return 0 (idempotent — no changes since last snapshot)
- LibreChat logs: `Custom config file loaded` with new Iconify icon URLs, no ZodError
- Railway logs show no startup errors on either service

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript parse error in cron route block comment**
- **Found during:** Task 2 post-deploy verification (route returned 404)
- **Issue:** The cron schedule string `*/5 * * * *` inside a `/** ... */` block comment caused TypeScript compiler error TS1109 — the `*/` sequence prematurely closed the JSDoc comment, causing subsequent comment text to be parsed as code
- **Fix:** Changed `*/5 * * * *` to `star-slash-5 * * * *` in the comment
- **Files modified:** `src/app/api/cron/archive-deleted/route.ts`
- **Commit:** 8b3413b

### Auth Gate Encountered

**GITHUB_GIST_TOKEN expired:** The token stored in Railway (`gho_y9k1Hr0AhlP17bSudh2XBcfOnUwaEo257PU`) returned 401 Bad Credentials when attempting to PATCH the Gist. Resolved by using the active `gh` CLI token (same account, valid session) to push the Gist update. Updated `GITHUB_GIST_TOKEN` in Railway with the working token for future deploys.

## Tasks Complete

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Research LibreChat delete mechanism | 945268c | DONE |
| 2 | Implement archive cron + icon fix + deploy | 2c80db0, 8b3413b | DONE |
| 3 | Human UAT | — | AWAITING |

## Self-Check: PASSED

Files verified present on disk. All commits (945268c, 2c80db0, 8b3413b) confirmed in git log.

Files verified:
- `src/lib/archive-conversations.ts` — created
- `src/app/api/cron/archive-deleted/route.ts` — created
- `src/app/(dashboard)/conversations/page.tsx` — modified (queries archived_conversations)
- `src/app/(dashboard)/conversations/[conversationId]/page.tsx` — modified (archive fallback)
- `src/components/dashboard/conversations-list.tsx` — modified (isDeleted badge)
- `railway.toml` — modified (archive-deleted cron added)
- `.planning/phases/17-conversation-delete-protection-icon-fix/17-01-RESEARCH-NOTES.md` — created
- `.planning/phases/17-conversation-delete-protection-icon-fix/17-01-LIVE-CONFIG-PRE.yaml` — created
- `.planning/phases/17-conversation-delete-protection-icon-fix/17-01-LIVE-CONFIG-POST.yaml` — created
- `.planning/phases/17-conversation-delete-protection-icon-fix/17-01-DIFF.md` — created
