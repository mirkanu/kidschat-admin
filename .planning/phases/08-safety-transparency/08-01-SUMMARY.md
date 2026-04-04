---
phase: 08-safety-transparency
plan: 01
subsystem: ui
tags: [next.js, shadcn, accordion, safety, transparency, server-component]

# Dependency graph
requires:
  - phase: 07-trust-home
    provides: Dashboard page patterns (p-6 space-y-6, Card components, loading skeletons)
provides:
  - /safety-rules page with four content sections covering SAFE-01 through SAFE-04
  - Accordion component (shadcn) for expandable system prompt disclosure
  - Skeleton loading state matching page layout

affects: [09-parent-test-mode]

# Tech tracking
tech-stack:
  added: [shadcn/accordion]
  patterns: [Hardcoded server component for static transparency content, accordion for collapsible disclosure, dl/dt/dd for definition lists]

key-files:
  created:
    - src/app/(dashboard)/safety-rules/page.tsx
    - src/app/(dashboard)/safety-rules/loading.tsx
    - src/components/ui/accordion.tsx
  modified: []

key-decisions:
  - "Safety Rules page uses hardcoded content (no DB fetch) — all content is static policy text"
  - "Accordion used for system prompt to avoid overwhelming the page on first load"
  - "dl/dt/dd semantic markup used for Content Boundaries to provide accessibility structure"
  - "Border-left accent colors distinguish safety redirect (yellow) from jailbreak response (red)"

patterns-established:
  - "Transparency pages: static server component with no data fetching, all content hardcoded as constants"
  - "Multi-section policy pages: one Card per section, icon in CardHeader, consistent p-6 space-y-6 wrapper"

requirements-completed: [SAFE-01, SAFE-02, SAFE-03, SAFE-04]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 8 Plan 01: Safety Transparency Summary

**Full-transparency /safety-rules page with accordion-revealed system prompt, content boundary dl list, rule-trigger explanations, and 2x2 tone preset grid — no data fetching, all content hardcoded**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T21:44:17Z
- **Completed:** 2026-04-04T21:48:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Installed shadcn Accordion component (required for SAFE-02 system prompt disclosure)
- Created /safety-rules server component page with all four SAFE requirement sections
- Content Boundaries section (SAFE-01) uses semantic dl/dt/dd markup for accessibility
- Full system prompt section (SAFE-02) uses Accordion so parents can expand/collapse the verbatim instructions
- Rule trigger explanations (SAFE-03) with color-coded left-border accents (yellow=redirect, red=jailbreak)
- Tone presets (SAFE-04) in responsive 2x2 grid with individual mini-cards
- Skeleton loading state (loading.tsx) matches page shape with 4 card skeletons

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn Accordion component** - `4d4150e` (chore)
2. **Task 2: Create Safety Rules page with all content sections** - `327aa90` (feat)

## Files Created/Modified
- `src/components/ui/accordion.tsx` - shadcn Accordion component (Accordion, AccordionItem, AccordionTrigger, AccordionContent)
- `src/app/(dashboard)/safety-rules/page.tsx` - Safety Rules server component with all four sections
- `src/app/(dashboard)/safety-rules/loading.tsx` - Skeleton loading state matching page layout

## Decisions Made
- Safety Rules page uses hardcoded content (no DB fetch) — all content is static policy text that doesn't change based on data
- System prompt disclosure via Accordion avoids overwhelming the page on first load while still making it fully accessible
- dl/dt/dd semantic HTML used for Content Boundaries list (better than ul for labeled definitions)
- Border-left accent colors visually distinguish safety redirect (yellow) from jailbreak response (red)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four SAFE requirements are addressed on a single fully-transparent page
- Accordion component is now available for use in other pages if needed
- Phase 09 (Parent Test Mode) can proceed — no blockers from this plan

---
*Phase: 08-safety-transparency*
*Completed: 2026-04-04*
