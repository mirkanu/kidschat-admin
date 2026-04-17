---
phase: quick-260417-kgn
plan: 01
subsystem: admin-ui
tags: [ui, rename, labels, budget, semantic-correctness]
dependency_graph:
  requires: []
  provides:
    - "Semantically correct UI labels for daily refill-floor behavior"
  affects:
    - "Admin /settings Global Defaults tab"
    - "Admin /settings Per-Child Overrides tab"
    - "Admin /users/[userId] Usage & Limits card"
tech_stack:
  added: []
  patterns:
    - "3-col grid help text aligned with NumberFieldRow input column"
key_files:
  created: []
  modified:
    - src/app/(dashboard)/settings/settings-form.tsx
    - src/app/(dashboard)/settings/child-overrides-table.tsx
    - src/components/dashboard/usage-bars.tsx
    - src/lib/budget.ts
decisions:
  - "Longer help-text variant used (not shorter fallback) — fits one line at typical widths"
  - "Help text wrapped in own grid grid-cols-3 gap-4 with col-span-2 on <p> — aligns under the input column, sidesteps pl-[33.333%] arbitrary-Tailwind risk"
  - "Test-file TS errors (32 pre-existing) flagged as deferred — zero new type errors introduced"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-17"
  tasks: 1
  files_modified: 4
  lines_changed: 12
---

# Phase quick-260417-kgn Plan 01: Rename Daily Cap → Daily Allowance Summary

Rename user-facing "Daily cap" → "Daily allowance" to match the Phase 15.4 $max-floor refill semantics, with an inline one-line help text explaining the floor behavior. Zero identifier, API, or schema changes.

## Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Rename UI labels + JSDoc prose, add help text | `c6f11ef` | settings-form.tsx, child-overrides-table.tsx, usage-bars.tsx, budget.ts |

Pushed to `origin/master` at `c6f11ef`. Railway auto-deploy triggered for the kidschat-admin service (`83b7b7d1-76bd-4e99-8466-d2a1bf44f8d2`).

## Changes

### User-facing strings (3 renames)

1. **`src/app/(dashboard)/settings/settings-form.tsx:113`** — `NumberFieldRow label` prop:
   - Before: `label="Daily cap (€)"`
   - After: `label="Daily allowance (€)"`

2. **`src/app/(dashboard)/settings/child-overrides-table.tsx:175`** — column header div:
   - Before: `<div>Daily cap (€)</div>`
   - After: `<div>Daily allowance (€)</div>`

3. **`src/components/dashboard/usage-bars.tsx:71`** — daily bar caption:
   - Before: `{dailyPercent}% of daily cap used`
   - After: `{dailyPercent}% of daily allowance used`

Monthly cap labels intentionally unchanged (still a true ceiling per Phase 15.4).

### Help text addition (1)

Under the "Daily allowance (€)" field in `settings-form.tsx`:

```tsx
<div className="grid grid-cols-3 gap-4">
  <div />
  <p className="col-span-2 text-xs text-muted-foreground">
    Refilled to this minimum each midnight UTC. Parent top-ups
    above it are preserved; unused balance does not roll over.
  </p>
</div>
```

**Variant chosen:** longer version (from PLAN proposed copy). Shorter fallback was NOT needed — the grid layout allocates 2/3 of the row to the paragraph, which wraps cleanly across 2 short lines at narrow widths and 1 line at wide widths.

**Alignment approach:** own `grid grid-cols-3 gap-4` with empty left cell and `col-span-2` on the `<p>`. Mirrors the 3-col grid of `NumberFieldRow` above so the help text starts under the input column rather than the label column. Chose this over the plan's `pl-[33.333%]` arbitrary-Tailwind suggestion to avoid JIT compiler flakiness.

### JSDoc prose (2 edits in `src/lib/budget.ts`)

- Line 245: `preserves parent top-ups above the daily cap` → `preserves parent top-ups above the daily allowance`
- Line 270: `$max preserves parent top-ups that pushed tokenCredits above the daily cap.` → `$max preserves parent top-ups that pushed tokenCredits above the daily allowance.`

No identifier renames. `dailyCostCapEur`, `dailyCapEur`, `dailyCap`, etc. all unchanged per plan scope.

## Verification

### Grep verification (all zero as expected)

```
grep -rnE 'Daily cap|Daily limit' src --include='*.tsx' --include='*.ts'   → 0 matches
grep -rnE 'daily cap|daily limit' src --include='*.tsx' --include='*.ts'   → 0 matches
```

### Positive-assertion grep

```
grep -c 'Daily allowance' src/app/(dashboard)/settings/settings-form.tsx       → 1
grep -c 'Daily allowance' src/app/(dashboard)/settings/child-overrides-table.tsx → 1
grep -c 'daily allowance used' src/components/dashboard/usage-bars.tsx          → 1
grep -c 'above the daily allowance' src/lib/budget.ts                           → 2
```

All match plan's `<automated>` verification block exactly.

### TypeScript

`npx tsc --noEmit` — 32 errors, all in `tests/*.ts`. **Identical error count pre- and post-edit** (confirmed via `git stash` sanity check on base `2d565fb`). Zero new errors from this change.

## Deviations from Plan

### Auto-fixed / minor adjustments

**1. [Help-text alignment method]** Used dedicated `grid grid-cols-3 gap-4` wrapper with `col-span-2 <p>` instead of `pl-[33.333%]` on a bare `<p>`. Rationale: plan explicitly offered this as one of three alternatives ("wrap the help text in a grid grid-cols-3 wrapper with col-start-2 col-span-2 on the <p>"). Picked it as the most robust — no arbitrary-Tailwind JIT risk, mirrors the existing NumberFieldRow grid perfectly.

No other deviations. Plan-defined edits applied verbatim.

## Deferred Issues

**32 pre-existing TypeScript errors in `tests/*.ts`** — `tests/lib/budget.test.ts`, `tests/lib/notify-safety-alert-route.test.ts`, `tests/lib/top-up.test.ts`. These are `TS2322`/`TS2345` type-compat issues in test mocks, unrelated to this UI-text change. Pre-existed on base commit `2d565fb`. Out of scope per executor deviation scope boundary.

## Expected Visual Change (for user spot-check)

Production URL: https://kidschat-admin-production.up.railway.app

1. **Settings → Global Defaults tab:** First field label reads "Daily allowance (€)". Directly below it, a muted small-text line reads: *"Refilled to this minimum each midnight UTC. Parent top-ups above it are preserved; unused balance does not roll over."* Monthly field below still reads "Monthly cap (€)" (correct — monthly IS a cap).

2. **Settings → Per-Child Overrides tab:** Column headers read `Child | Daily allowance (€) | Monthly cap (€) | Actions`.

3. **User detail page `/users/{userId}` → Usage & Limits card:** Daily progress bar caption reads "X% of daily allowance used". Monthly bar caption still reads "X% of monthly cap used" (correct).

## Self-Check: PASSED

Files modified — confirmed present:
- FOUND: src/app/(dashboard)/settings/settings-form.tsx (contains "Daily allowance (€)")
- FOUND: src/app/(dashboard)/settings/child-overrides-table.tsx (contains "Daily allowance (€)")
- FOUND: src/components/dashboard/usage-bars.tsx (contains "daily allowance used")
- FOUND: src/lib/budget.ts (contains 2× "above the daily allowance")

Commit exists:
- FOUND: c6f11ef on origin/master (pushed cleanly)

Verification:
- FOUND: grep Daily cap / Daily limit → 0 matches ✓
- FOUND: grep daily cap / daily limit → 0 matches ✓
- FOUND: TS errors delta vs base → 0 new errors ✓
