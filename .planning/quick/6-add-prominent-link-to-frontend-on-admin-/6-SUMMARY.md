---
phase: quick-6
plan: 01
subsystem: admin-ui
tags: [test-mode, navigation, ux]
dependency_graph:
  requires: []
  provides: [frontend-link-on-test-mode]
  affects: [src/app/(dashboard)/test-mode/test-mode-client.tsx]
tech_stack:
  added: []
  patterns: [env-var-with-hardcoded-fallback, lucide-icon-in-anchor]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/test-mode/test-mode-client.tsx
decisions:
  - Used module-level const for frontendUrl (outside component) — stable reference, no re-computation on render
  - Used plain `a` tag styled as a button rather than the Button component — avoids asChild/Slot complexity for external links
metrics:
  duration_minutes: 5
  completed_date: "2026-04-06"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 6 Summary

**One-liner:** Primary-colored "Open Kid Chat" anchor with ExternalLink icon inserted between heading and scenario buttons on Test Mode page, using `NEXT_PUBLIC_LIBRECHAT_URL` with hardcoded fallback.

## What Was Done

Added a visually prominent link to the kid-facing LibreChat frontend on the admin Test Mode page. The link sits between the page heading and the scenario button grid, making it easy for admins to jump to the live frontend after testing safety rules in the sandbox.

## Changes

### Task 1: Add prominent frontend link to Test Mode page

**Commit:** `6bebd65`

**Changes made to `src/app/(dashboard)/test-mode/test-mode-client.tsx`:**
- Added `ExternalLink` to the existing lucide-react import block
- Defined `frontendUrl` as a module-level const using `NEXT_PUBLIC_LIBRECHAT_URL` with hardcoded fallback to `https://librechat-production-bff2.up.railway.app`
- Inserted `<a>` element with `target="_blank" rel="noopener noreferrer"` between the heading `<div>` and the scenario buttons grid
- Styled with `bg-primary text-primary-foreground` Tailwind classes for visual prominence

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/app/(dashboard)/test-mode/test-mode-client.tsx` — FOUND
- Commit `6bebd65` — FOUND
