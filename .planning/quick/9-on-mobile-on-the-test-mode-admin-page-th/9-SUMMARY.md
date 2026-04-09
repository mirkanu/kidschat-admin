---
phase: quick-9
plan: 01
subsystem: admin-dashboard
tags: [mobile, chat-widget, ux, overlap-fix]
dependency_graph:
  requires: []
  provides: [no-overlap-on-test-mode-mobile]
  affects: [admin-chat-widget]
tech_stack:
  added: []
  patterns: [usePathname for pathname-aware rendering]
key_files:
  created: []
  modified:
    - src/components/dashboard/admin-chat-widget.tsx
decisions:
  - Hide AdminChatWidget on /test-mode for ALL viewports (not just mobile) — test-mode already is a chat interface so two chat UIs would be confusing
metrics:
  duration: "~2 minutes"
  completed: "2026-04-07"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 9: Hide AdminChatWidget on /test-mode Page Summary

**One-liner:** Pathname-aware AdminChatWidget that returns null on /test-mode, eliminating floating bubble overlap on the Send button on mobile.

## What Was Built

Added `usePathname` from `next/navigation` to `AdminChatWidget` and inserted an early return `null` when `pathname === "/test-mode"`. This hides the floating admin chat bubble on the test-mode page entirely, removing the overlap with the test-mode chat Send button that made it untappable on mobile.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Hide AdminChatWidget on /test-mode page on mobile | 7eeee8d | src/components/dashboard/admin-chat-widget.tsx |

## Verification

- Build: `✓ Compiled successfully` — no TypeScript errors
- On /test-mode: `AdminChatWidget` returns `null`, no floating bubble rendered
- On all other dashboard pages: widget renders normally

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- File exists: src/components/dashboard/admin-chat-widget.tsx — FOUND
- Commit 7eeee8d — FOUND (HEAD)
