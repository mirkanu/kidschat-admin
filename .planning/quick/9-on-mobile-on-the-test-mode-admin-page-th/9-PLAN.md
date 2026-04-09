---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/dashboard/admin-chat-widget.tsx
autonomous: true
requirements: ["quick-9"]
must_haves:
  truths:
    - "On mobile test-mode page, the Send button is fully tappable without obstruction"
    - "Admin chat widget still appears on all other dashboard pages"
    - "Admin chat widget still works normally on desktop test-mode page"
  artifacts:
    - path: "src/components/dashboard/admin-chat-widget.tsx"
      provides: "Pathname-aware chat widget that hides on /test-mode on mobile"
  key_links: []
---

<objective>
Fix the AdminChatWidget floating bubble overlapping the Test Mode page Send button on mobile.

Purpose: The fixed-position chat bubble (bottom-6 right-6) sits directly on top of the test-mode chat input Send button on small screens, making it untappable.
Output: Chat widget hidden on /test-mode page on mobile viewports, visible everywhere else.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/dashboard/admin-chat-widget.tsx
@src/app/(dashboard)/test-mode/test-mode-client.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Hide AdminChatWidget on /test-mode page on mobile</name>
  <files>src/components/dashboard/admin-chat-widget.tsx</files>
  <action>
    Import `usePathname` from `next/navigation` at the top of admin-chat-widget.tsx.

    Inside the `AdminChatWidget` component, add:
    ```
    const pathname = usePathname();
    ```

    Before the collapsed-state return (the floating button around line 191), add an early return that hides the widget entirely when on the test-mode page. The test-mode page already has its own full chat interface, so the admin chat widget is redundant there and causes the overlap:

    ```
    // Hide on test-mode page — it has its own chat UI and the bubble overlaps its Send button on mobile
    if (pathname === "/test-mode") return null;
    ```

    This hides the widget on /test-mode for ALL viewports (desktop included), which is acceptable because:
    1. Test-mode already IS a chat interface — having two chat bubbles is confusing
    2. The admin assistant serves a different purpose than test-mode chat
    3. Users can navigate to any other page to access the admin assistant
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx next build 2>&1 | tail -5</automated>
  </verify>
  <done>AdminChatWidget returns null on /test-mode, eliminating the overlap. Widget still renders on all other dashboard pages.</done>
</task>

</tasks>

<verification>
- Build succeeds with no errors
- On mobile /test-mode: no floating chat bubble, Send button fully accessible
- On other pages (dashboard, conversations, etc.): admin chat bubble still present
</verification>

<success_criteria>
The floating admin chat bubble no longer overlaps the Send button on the test-mode page on mobile devices.
</success_criteria>

<output>
After completion, create `.planning/quick/9-on-mobile-on-the-test-mode-admin-page-th/9-SUMMARY.md`
</output>
