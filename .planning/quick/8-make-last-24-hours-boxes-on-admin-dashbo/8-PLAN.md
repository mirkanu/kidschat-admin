---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/page-client.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Messages Sent box navigates to /conversations on click"
    - "Safety Events box navigates to /alerts on click"
    - "Active Children box navigates to /users on click"
    - "Each box shows hover feedback (cursor, scale/bg change)"
  artifacts:
    - path: "src/app/(dashboard)/page-client.tsx"
      provides: "Clickable Last 24 Hours stat boxes"
      contains: "Link href"
  key_links:
    - from: "ActivityDigestCard stat boxes"
      to: "/conversations, /alerts, /users"
      via: "next/link Link component"
      pattern: "Link href=.*/(conversations|alerts|users)"
---

<objective>
Wrap the three "Last 24 Hours" stat boxes on the admin dashboard in next/link Link components so they navigate to their relevant pages, with hover feedback styling.

Purpose: Admin can quickly drill into details by clicking any stat box.
Output: Updated page-client.tsx with clickable, hover-styled stat boxes.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/(dashboard)/page-client.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wrap Last 24 Hours stat boxes in Link components with hover styling</name>
  <files>src/app/(dashboard)/page-client.tsx</files>
  <action>
In the ActivityDigestCard component (around lines 120-139), replace each of the three plain `div` stat boxes with `Link` components:

1. **Messages Sent** box (line ~121): Replace the outer `<div>` with `<Link href="/conversations">`. Keep all existing classes and add hover classes: `transition-colors hover:bg-accent hover:border-accent-foreground/20 active:scale-[0.98]`.

2. **Safety Events** box (line ~126): Replace the outer `<div>` with `<Link href="/alerts">`. Same hover classes as above.

3. **Active Children** box (line ~135): Replace the outer `<div>` with `<Link href="/users">`. Same hover classes as above.

`Link` is already imported from `next/link` on line 3. No new imports needed.

Each Link keeps the existing classes: `flex flex-col items-center gap-1 rounded-lg border p-3` and adds `transition-colors hover:bg-accent hover:border-accent-foreground/20 active:scale-[0.98]`.
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx next build 2>&1 | tail -5</automated>
  </verify>
  <done>All three stat boxes are wrapped in Link components pointing to /conversations, /alerts, and /users respectively. Each shows hover background change and active press feedback.</done>
</task>

</tasks>

<verification>
- Build succeeds with no errors
- Grep confirms three Link hrefs in ActivityDigestCard area: /conversations, /alerts, /users
</verification>

<success_criteria>
- Three stat boxes in "Last 24 Hours" are clickable links to their respective pages
- Hover state shows background accent color change
- Active/press state shows slight scale reduction
- No visual change to default (non-hover) appearance
</success_criteria>

<output>
After completion, create `.planning/quick/8-make-last-24-hours-boxes-on-admin-dashbo/8-SUMMARY.md`
</output>
