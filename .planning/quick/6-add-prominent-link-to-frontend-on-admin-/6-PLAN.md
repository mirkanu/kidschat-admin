---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/test-mode/test-mode-client.tsx
autonomous: true
requirements: [QUICK-6]
must_haves:
  truths:
    - "Admin sees a prominent link to the kid-facing frontend near the top of the Test Mode page"
    - "Clicking the link opens the frontend in a new tab"
  artifacts:
    - path: "src/app/(dashboard)/test-mode/test-mode-client.tsx"
      provides: "Prominent frontend link with ExternalLink icon"
      contains: "NEXT_PUBLIC_LIBRECHAT_URL"
  key_links:
    - from: "test-mode-client.tsx"
      to: "LibreChat frontend URL"
      via: "env var with hardcoded fallback"
      pattern: "NEXT_PUBLIC_LIBRECHAT_URL"
---

<objective>
Add a prominent, visually distinct link/button to the kid-facing frontend (LibreChat) near the top of the admin Test Mode page.

Purpose: Let the admin quickly jump to the actual kid-facing chat to test it live after verifying safety rules in the sandbox.
Output: Updated test-mode-client.tsx with a styled link button.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/(dashboard)/test-mode/test-mode-client.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add prominent frontend link to Test Mode page</name>
  <files>src/app/(dashboard)/test-mode/test-mode-client.tsx</files>
  <action>
    1. Add `ExternalLink` to the existing lucide-react import.

    2. Define the frontend URL at the top of the component:
       ```
       const frontendUrl = process.env.NEXT_PUBLIC_LIBRECHAT_URL || "https://librechat-production-bff2.up.railway.app";
       ```

    3. Insert a styled link element between the page heading div and the scenario buttons grid. Use an anchor tag styled as a prominent button-like banner:
       - Use `a` tag with `href={frontendUrl}`, `target="_blank"`, `rel="noopener noreferrer"`
       - Styling: `flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:bg-primary/90 transition-colors w-fit`
       - Content: ExternalLink icon (h-4 w-4) + "Open Kid Chat (Live Frontend)"
       - This gives it a solid primary-colored background that stands out from the outline scenario buttons

    Keep the change minimal — only add the import, the URL const, and the link element.
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx next lint --file src/app/\(dashboard\)/test-mode/test-mode-client.tsx 2>&1 | tail -5</automated>
  </verify>
  <done>Test Mode page displays a prominent primary-colored link to the frontend that opens in a new tab, using NEXT_PUBLIC_LIBRECHAT_URL with hardcoded fallback.</done>
</task>

</tasks>

<verification>
- Lint passes on the modified file
- The link renders visually between the heading and scenario buttons
- Clicking opens the frontend URL in a new tab
</verification>

<success_criteria>
Admin Test Mode page has a clearly visible, primary-colored link to the kid-facing frontend that opens in a new tab.
</success_criteria>

<output>
After completion, create `.planning/quick/6-add-prominent-link-to-frontend-on-admin-/6-SUMMARY.md`
</output>
