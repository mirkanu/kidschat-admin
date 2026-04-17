---
phase: quick-260417-kgn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/settings/settings-form.tsx
  - src/app/(dashboard)/settings/child-overrides-table.tsx
  - src/components/dashboard/usage-bars.tsx
  - src/lib/budget.ts
autonomous: true
requirements:
  - KGN-01
must_haves:
  truths:
    - "Settings form field label reads 'Daily allowance (€)' (not 'Daily cap (€)')"
    - "Per-child overrides column header reads 'Daily allowance (€)' (not 'Daily cap (€)')"
    - "Usage bar help text reads 'X% of daily allowance used' (not 'X% of daily cap used')"
    - "A short one-line help text under the Daily allowance field explains the refill-floor behavior"
    - "JSDoc comments in budget.ts that reference 'daily cap' in prose are updated to 'daily allowance' (no identifier renames)"
    - "Zero user-facing 'Daily cap' or 'Daily limit' strings remain in src/**/*.{ts,tsx}"
    - "TypeScript type-check passes with no new errors"
  artifacts:
    - path: "src/app/(dashboard)/settings/settings-form.tsx"
      provides: "Renamed field label + refill-floor help text"
      contains: "Daily allowance (€)"
    - path: "src/app/(dashboard)/settings/child-overrides-table.tsx"
      provides: "Renamed column header"
      contains: "Daily allowance (€)"
    - path: "src/components/dashboard/usage-bars.tsx"
      provides: "Renamed help text under daily progress bar"
      contains: "daily allowance used"
  key_links:
    - from: "settings-form.tsx NumberFieldRow label prop"
      to: "user-visible <Label> element"
      via: "prop passthrough"
      pattern: "Daily allowance"
    - from: "child-overrides-table.tsx header grid cell"
      to: "rendered DOM header row"
      via: "direct JSX string"
      pattern: "Daily allowance"
    - from: "usage-bars.tsx daily bar caption"
      to: "rendered <p> element"
      via: "template literal"
      pattern: "daily allowance used"
---

<objective>
Rename all user-facing "Daily cap" / "Daily limit" strings in the admin UI to
"Daily allowance" to match the $max-floor refill semantics established in
Phase 15.4. Add a short one-line help text beneath the Daily allowance field
explaining the refill-floor behavior. No logic changes, no identifier renames,
no API/MongoDB field changes.

Purpose: The current label "Daily cap" implies a hard ceiling, but Phase 15.4
changed the semantics — the daily cron uses $max to preserve parent top-ups
above the floor. So the value is actually a floor/allowance, not a cap. The
wrong label will confuse parents trying to understand what a top-up does.

Output: Three UI strings renamed, one explanatory line added, JSDoc prose
corrected in budget.ts. Admin service auto-deploys via Railway on git push.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md

## Rename rationale (from Phase 15.4 decision in STATE.md)

> $max operator chosen for daily refill: atomic, one-line, no schema change —
> preserves parent top-ups above dailyCap

The stored value `dailyCostCapEur` is the daily **refill floor**, not a ceiling.
- If a child ends the day at €0.02 remaining: next midnight UTC refills to €0.20.
- If a parent tops up to €0.50 mid-day: next midnight UTC `$max(0.50, 0.20) = 0.50` — top-up preserved.
- Unused balance below the floor does NOT roll over (refill brings it back up).
- Balance above the floor IS preserved (the $max short-circuits).

Therefore "allowance" (a replenished minimum) is semantically correct;
"cap" (a ceiling) is semantically wrong.

## Replacement phrase — picked

**"Daily allowance"** (natural English noun, parent-friendly, implies "given back each day")

## Sites to rename — pre-grepped and confirmed by planner

1. `src/app/(dashboard)/settings/settings-form.tsx:113` — `label="Daily cap (€)"`
2. `src/app/(dashboard)/settings/child-overrides-table.tsx:175` — column header `<div>Daily cap (€)</div>`
3. `src/components/dashboard/usage-bars.tsx:71` — `{dailyPercent}% of daily cap used`

No additional user-facing sites exist. Planner grepped `Daily.*[Cc]ap`,
`Daily.*[Ll]imit`, and `daily.{0,10}(cap|limit)` across `src/**/*.{ts,tsx}`;
only the three sites above matched on strings. (JSDoc + identifier matches
handled separately below.) Email templates only use "daily summary" (notification
category, out of scope).

## JSDoc prose in src/lib/budget.ts — IN SCOPE for this commit

Planner decision: update the JSDoc **prose** (not identifiers) in the same
commit since it's a semantic rename that leaves stale comments misleading.
Sites:
- line 14 (usage-bars.tsx JSDoc header — "Daily spend: €X / €dailyCap" — leave alone, `€dailyCap` is a doc-style variable reference not user-facing prose)
- line 245 (budget.ts) — `(atomic: preserves parent top-ups above the daily cap — no clobbering)`
- line 270 (budget.ts) — `// $max preserves parent top-ups that pushed tokenCredits above the daily cap.`

These get updated. Identifiers (`dailyCostCapEur`, `dailyCapEur`, etc.) stay
exactly as they are — OUT of scope per user constraints.

## Help text addition

Under the "Daily allowance (€)" field in settings-form.tsx, add a short
one-line description (using the existing muted-foreground pattern already in
the file at line 106-108) explaining the refill-floor behavior.

Proposed copy (concise — must fit one line at typical widths):

> "Refilled to this minimum each midnight UTC. Parent top-ups above it are preserved; unused balance does not roll over."

This is long-ish. Shorter variant (acceptable fallback if layout looks
cramped):

> "Refilled to this minimum each midnight UTC. Top-ups above it are preserved."

Executor: use the longer variant first; if the rendered layout looks visually
poor (checked during human-verify step), fall back to the shorter variant.

## Out of scope — confirmed

- Identifiers: `dailyCostCapEur`, `dailyCap`, `setDailyCap`, `dailyCapEur`,
  `remainingEur`, form field `name` attribute (must stay `dailyCostCapEur` —
  server action reads it).
- API endpoints, MongoDB field names, request/response shapes.
- Any logic in `src/lib/budget.ts` — prose-only JSDoc edits.
- Email templates — only "daily summary" usage, not a cap label.
- Monthly cap labels — still a real hard ceiling (enforced at cron time per
  Phase 15.4); semantically correct.
- The "Edit limits" link text in daily-spend-overview-card.tsx:94 — does not
  match "daily cap" / "daily limit" patterns, generic plural noun, leaving alone.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename user-facing 'Daily cap' strings to 'Daily allowance' and add refill-floor help text</name>
  <files>src/app/(dashboard)/settings/settings-form.tsx, src/app/(dashboard)/settings/child-overrides-table.tsx, src/components/dashboard/usage-bars.tsx, src/lib/budget.ts</files>
  <action>
Make exactly these four edits. Do NOT touch identifiers, prop names, form field `name` attributes, or any logic.

**Edit 1 — `src/app/(dashboard)/settings/settings-form.tsx` (line 113 area):**

Change the `NumberFieldRow` for `dailyCostCapEur`:
```tsx
<NumberFieldRow
  label="Daily cap (€)"
  name="dailyCostCapEur"
  defaultValue={globals.dailyCostCapEur}
  step="0.001"
/>
```
to:
```tsx
<NumberFieldRow
  label="Daily allowance (€)"
  name="dailyCostCapEur"
  defaultValue={globals.dailyCostCapEur}
  step="0.001"
/>
<p className="text-xs text-muted-foreground pl-[33.333%]">
  Refilled to this minimum each midnight UTC. Parent top-ups above it are
  preserved; unused balance does not roll over.
</p>
```

The `pl-[33.333%]` left padding aligns the help text visually with the input
column (which spans the 2 right columns of the 3-column grid in NumberFieldRow).
If your editor autoformats the className differently keep the semantic intent
(left-padded under the input, not under the label). If `pl-[33.333%]` does not
render correctly (arbitrary tailwind values can be finicky), fall back to
`pl-32` or wrap the help text in a `grid grid-cols-3` wrapper with
`col-start-2 col-span-2` on the `<p>`. Choose whichever produces correct
alignment — the existing "Applied to all children unless overridden per-child"
muted text above is NOT inside a grid and spans full width, which is also fine
if the grid approach looks off. Executor: pick the simplest approach that
renders the help text clearly under (or near) the Daily allowance field.
DO NOT add help text under the Monthly cap field — that one's semantics are
unchanged.

**Edit 2 — `src/app/(dashboard)/settings/child-overrides-table.tsx` (line 175):**

Change:
```tsx
<div>Daily cap (€)</div>
```
to:
```tsx
<div>Daily allowance (€)</div>
```
Leave the `Monthly cap (€)` header (next line) unchanged.

**Edit 3 — `src/components/dashboard/usage-bars.tsx` (line 71):**

Change:
```tsx
<p className="text-xs text-muted-foreground">
  {dailyPercent}% of daily cap used
</p>
```
to:
```tsx
<p className="text-xs text-muted-foreground">
  {dailyPercent}% of daily allowance used
</p>
```
Leave the `{monthlyPercent}% of monthly cap used` line (line 91) unchanged.

**Edit 4 — `src/lib/budget.ts` JSDoc prose (lines 243-247 block and line 270):**

At line 245, change:
```ts
 *   (atomic: preserves parent top-ups above the daily cap — no clobbering)
```
to:
```ts
 *   (atomic: preserves parent top-ups above the daily allowance — no clobbering)
```

At line 270, change:
```ts
  // $max preserves parent top-ups that pushed tokenCredits above the daily cap.
```
to:
```ts
  // $max preserves parent top-ups that pushed tokenCredits above the daily allowance.
```

Do NOT change any identifier (`dailyCostCapEur`, `dailyCapEur`, etc.). Do NOT
change logic. Do NOT rename any function. If you see `dailyCap` used as a
variable name in identifiers (e.g. `state.dailyCapEur`), LEAVE IT — out of scope.

**After edits — verify with grep:**

From the repo root, run:
```bash
grep -rnE 'Daily cap|Daily limit' src --include='*.tsx' --include='*.ts'
```
Expected: zero matches in user-facing strings. Any remaining matches must be
inside identifiers/variable names (e.g. a comment `// see dailyCap handling`) —
flag to the user if unclear.

Also run:
```bash
grep -rnE 'daily cap|daily limit' src --include='*.tsx' --include='*.ts'
```
Expected: zero matches in prose. `dailyCap` identifier matches are fine (those
are camelCase variable names, not prose).
  </action>
  <verify>
    <automated>
cd /data/home/KidAI && \
test "$(grep -rnE 'Daily cap|Daily limit' src --include='*.tsx' --include='*.ts' | wc -l)" = "0" && \
test "$(grep -rnE 'daily cap|daily limit' src --include='*.tsx' --include='*.ts' | wc -l)" = "0" && \
test "$(grep -c 'Daily allowance' src/app/\(dashboard\)/settings/settings-form.tsx)" = "1" && \
test "$(grep -c 'Daily allowance' src/app/\(dashboard\)/settings/child-overrides-table.tsx)" = "1" && \
test "$(grep -c 'daily allowance used' src/components/dashboard/usage-bars.tsx)" = "1" && \
test "$(grep -c 'above the daily allowance' src/lib/budget.ts)" = "2" && \
npx tsc --noEmit
    </automated>
  </verify>
  <done>
All four strings renamed; help text added under Daily allowance field;
budget.ts JSDoc prose updated; grep confirms zero remaining user-facing
"Daily cap" / "Daily limit" strings; tsc --noEmit passes.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Four string edits:
  - Settings form field label: "Daily cap (€)" → "Daily allowance (€)"
  - Settings form: new one-line help text under Daily allowance field
  - Per-child overrides column header: "Daily cap (€)" → "Daily allowance (€)"
  - Usage bar help text: "X% of daily cap used" → "X% of daily allowance used"
  - budget.ts JSDoc prose updated (no identifier changes)

Committed and pushed. Railway should auto-deploy the admin service
(kidschat-admin, service id 83b7b7d1-76bd-4e99-8466-d2a1bf44f8d2) within ~2
minutes of the push.
  </what-built>
  <how-to-verify>
1. Wait ~2 minutes for Railway auto-deploy after `git push`.
2. Visit https://kidschat-admin-production.up.railway.app/settings
3. On the "Global Defaults" tab, confirm:
   - Field label reads "Daily allowance (€)" (not "Daily cap")
   - A muted one-line help text appears near/under the field explaining the
     refill-floor behavior
   - "Monthly cap (€)" label UNCHANGED (that's correct — monthly IS a cap)
4. Click the "Per-Child Overrides" tab. Confirm column header reads
   "Daily allowance (€)" (not "Daily cap").
5. Visit https://kidschat-admin-production.up.railway.app/ (dashboard). Click
   into any child's page (/users/{userId}). Under the "Usage & Limits" card,
   confirm the daily bar's caption reads "X% of daily allowance used".
6. Confirm the monthly bar caption still reads "X% of monthly cap used"
   (unchanged — that's correct).
7. Visually: does the help text layout look acceptable (not cramped, not
   wildly misaligned)? If it looks bad, fall back to the shorter variant
   ("Refilled to this minimum each midnight UTC. Top-ups above it are
   preserved.") or adjust alignment.

If anything looks wrong, describe it. If it all looks correct, type "approved".
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues to fix</resume-signal>
</task>

</tasks>

<verification>
Post-edit grep must return zero user-facing "Daily cap" / "Daily limit"
strings in `src/**/*.{ts,tsx}`. `npx tsc --noEmit` must pass. Human verification
confirms Railway-deployed admin UI shows the new labels correctly.
</verification>

<success_criteria>
- Three user-facing strings renamed to "Daily allowance" consistently
- One-line help text explains refill-floor semantics under the Daily allowance field
- JSDoc prose in budget.ts updated (no identifier renames)
- Zero remaining user-facing "Daily cap" / "Daily limit" strings
- TypeScript compilation clean
- Committed with a message reflecting "rename for semantic accuracy, no logic change"
- Pushed to master; Railway auto-deploys admin service
- Parent/user confirms labels render correctly on production
</success_criteria>

<output>
After completion, create
`.planning/quick/260417-kgn-rename-daily-cap-limit-ui-labels-to-matc/260417-kgn-SUMMARY.md`
with the commit SHA, the final help-text copy used, and a note on whether the
shorter fallback variant was needed.
</output>
