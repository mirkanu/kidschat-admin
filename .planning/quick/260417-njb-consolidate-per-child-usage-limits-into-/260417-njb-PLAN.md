---
phase: 260417-njb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/settings/page.tsx
  - src/app/(dashboard)/users/[userId]/page.tsx
  - src/app/(dashboard)/users/[userId]/loading.tsx
  - src/app/(dashboard)/users/[userId]/actions.ts
autonomous: true
requirements:
  - NJB-01
  - NJB-02
must_haves:
  truths:
    - "Parent navigating to /settings sees a stacked Usage & Limits card per non-ADMIN child above the tabs"
    - "Each /settings child card renders UsageBars (Today + This month bars) and a right-aligned Top up €0.10 button"
    - "Parent navigating to /users/{userId} no longer sees a Usage & Limits section or the 'visit Settings page' link"
    - "Clicking Top up €0.10 on /settings succeeds and the UsageBars refresh to reflect the new balance within one page lifecycle"
    - "Page shell on /settings renders immediately; each child card streams in through its own Suspense boundary (perceived performance preserved)"
    - "Type-check and build still pass (no new TypeScript errors)"
  artifacts:
    - path: "src/app/(dashboard)/settings/page.tsx"
      provides: "Per-child usage section + tabs below"
      contains: "Current usage"
    - path: "src/app/(dashboard)/users/[userId]/page.tsx"
      provides: "User detail page without UsageBars/TopUpButton/settings-link blocks"
      must_not_contain: "UsageBars"
    - path: "src/app/(dashboard)/users/[userId]/loading.tsx"
      provides: "User detail skeleton without the Usage & Limits skeleton block"
      must_not_contain: "Usage & Limits"
    - path: "src/app/(dashboard)/users/[userId]/actions.ts"
      provides: "topUpChildBalance that revalidates /settings in addition to /users/{userId}"
      contains: "revalidatePath(\"/settings\")"
  key_links:
    - from: "src/app/(dashboard)/settings/page.tsx"
      to: "src/components/dashboard/usage-bars.tsx"
      via: "<UsageBars userId childName />"
      pattern: "UsageBars"
    - from: "src/app/(dashboard)/settings/page.tsx"
      to: "src/app/(dashboard)/users/[userId]/top-up-button.tsx"
      via: "<TopUpButton userId childName />"
      pattern: "TopUpButton"
    - from: "src/app/(dashboard)/users/[userId]/top-up-button.tsx"
      to: "src/app/(dashboard)/users/[userId]/actions.ts"
      via: "topUpChildBalance server action"
      pattern: "topUpChildBalance"
---

<objective>
Move per-child Usage & Limits (UsageBars + TopUpButton) from `/users/{userId}` to `/settings`,
rendered as one vertically stacked card per non-ADMIN child ABOVE the existing Global Defaults /
Per-Child Overrides tabs. Remove the Usage & Limits block and the now-obsolete "visit Settings
page" link from `/users/{userId}`.

Purpose: Consolidate all budget/usage controls into a single page so the parent sees live balance
and top-up affordance in the same place they set limits. Eliminates the extra navigation hop
through `/users/{userId}` just to check spend or top up.

Output:
- `/settings` renders "Current usage" section with N child cards (N = non-admin user count)
- `/users/{userId}` becomes lean: breadcrumb + heading + Account Details only
- `topUpChildBalance` revalidates `/settings` so the moved UsageBars refresh after a top-up
- Perceived performance preserved via per-child Suspense boundaries
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

<!-- Source file to move FROM (lines 127-148 are being deleted) -->
@src/app/(dashboard)/users/[userId]/page.tsx

<!-- Destination file to move INTO (new section rendered above existing Suspense) -->
@src/app/(dashboard)/settings/page.tsx

<!-- Skeleton on the source page that must be trimmed -->
@src/app/(dashboard)/users/[userId]/loading.tsx

<!-- Server action that must be updated to also revalidate /settings -->
@src/app/(dashboard)/users/[userId]/actions.ts

<!-- Reusable components — DO NOT modify internals, just call them -->
@src/components/dashboard/usage-bars.tsx
@src/app/(dashboard)/users/[userId]/top-up-button.tsx

<!-- Existing tabs form — DO NOT modify -->
@src/app/(dashboard)/settings/settings-form.tsx

<interfaces>
<!-- Key contracts the executor needs. Do NOT explore the codebase to rediscover these. -->

From src/components/dashboard/usage-bars.tsx:
```typescript
export async function UsageBars(props: { userId: string; childName?: string }): Promise<JSX.Element>;
export function UsageBarsSkeleton(): JSX.Element;
// Renders a <Card> internally with "Usage & Limits" header and 2 bars (Today, This month).
```

From src/app/(dashboard)/users/[userId]/top-up-button.tsx:
```typescript
export function TopUpButton(props: { userId: string; childName: string }): JSX.Element;
// Client component. Calls topUpChildBalance(userId, 0.10) via server action on click.
```

From src/app/(dashboard)/users/[userId]/actions.ts:
```typescript
export async function topUpChildBalance(
  userId: string,
  amountEur: number
): Promise<{ ok: boolean; newBalanceEur?: number; error?: string }>;
// Currently revalidates only `/users/${userId}` — MUST also revalidate `/settings` after this plan.
```

From src/app/(dashboard)/settings/page.tsx (existing, reuse):
```typescript
// getSettingsData() already fetches childUsers (non-admin users sorted by name) internally
// at lines 25-30, but only exposes `overrides: ChildOverrideRow[]` (which includes userId + childName).
// We can reuse `overrides` directly — each row has { userId, childName, override } — perfect for
// feeding UsageBars + TopUpButton. No new fetcher needed.
```

From /data/home/CLAUDE.md (perceived performance rules — MANDATORY):
- Wrap data-fetching sections in `<Suspense fallback={<Skeleton />}>` boundaries
- Page shell renders immediately; data streams in
- Use shimmer/skeleton placeholders that match the shape of the incoming content
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move Usage & Limits from /users/{userId} to /settings + revalidate /settings on top-up</name>
  <files>
    src/app/(dashboard)/settings/page.tsx,
    src/app/(dashboard)/users/[userId]/page.tsx,
    src/app/(dashboard)/users/[userId]/loading.tsx,
    src/app/(dashboard)/users/[userId]/actions.ts
  </files>
  <action>
## Edit A — `src/app/(dashboard)/users/[userId]/actions.ts`

In `topUpChildBalance`, after the existing `revalidatePath(\`/users/${userId}\`)` line (line 39), add:

```typescript
revalidatePath("/settings");
```

WHY: UsageBars is a server component that reads balances at render time. When it moves to `/settings`, the top-up server action must invalidate the `/settings` cache so the bars reflect the new balance on the next render. Keep the existing `/users/${userId}` revalidation in place — it's harmless (the page no longer displays UsageBars but other sections may rely on fresh data later, and there's no cost to over-invalidating a single path).

## Edit B — `src/app/(dashboard)/settings/page.tsx`

1. Add imports at the top (after existing imports, before `// ---` divider):
   ```typescript
   import { UsageBars, UsageBarsSkeleton } from "@/components/dashboard/usage-bars";
   import { TopUpButton } from "../users/[userId]/top-up-button";
   ```

2. Add a new server component below `SettingsFormSkeleton()` and above `export default async function SettingsPage()`:

   ```typescript
   // ---------------------------------------------------------------------------
   // Per-child Usage section (above the tabs)
   // ---------------------------------------------------------------------------

   async function ChildUsageSection() {
     const { overrides } = await getSettingsData();
     // `overrides` is already the full list of non-admin children (userId + childName),
     // sorted by name — reuse it directly to avoid a second MongoDB roundtrip.

     if (overrides.length === 0) {
       return (
         <p className="text-sm text-muted-foreground">
           No child accounts yet.
         </p>
       );
     }

     return (
       <div className="space-y-4">
         {overrides.map((child) => (
           <div key={child.userId} className="space-y-3">
             <h3 className="text-base font-medium">{child.childName}</h3>
             <Suspense fallback={<UsageBarsSkeleton />}>
               <UsageBars userId={child.userId} childName={child.childName} />
             </Suspense>
             <div className="flex justify-end">
               <TopUpButton userId={child.userId} childName={child.childName} />
             </div>
           </div>
         ))}
       </div>
     );
   }

   function ChildUsageSectionSkeleton() {
     return (
       <div className="space-y-4">
         {Array.from({ length: 2 }).map((_, i) => (
           <div key={i} className="space-y-3">
             <Skeleton className="h-5 w-32" />
             <UsageBarsSkeleton />
             <div className="flex justify-end">
               <Skeleton className="h-9 w-32" />
             </div>
           </div>
         ))}
       </div>
     );
   }
   ```

   NOTE: `getSettingsData()` will be called twice on this page (once by `ChildUsageSection`, once by `SettingsContent`). This is acceptable — Next.js 15's request-scoped MongoDB connection reuses the same client instance, and the extra query cost is small. Do NOT refactor into a shared data fetcher for this task (out of scope).

3. Modify the `SettingsPage` JSX body to render the new section ABOVE the existing Suspense:

   ```tsx
   export default async function SettingsPage() {
     const session = await auth();
     if (!session) redirect("/login");

     return (
       <div className="space-y-8">
         <div>
           <h1 className="text-2xl font-semibold">Usage Limits</h1>
           <p className="text-sm text-muted-foreground mt-1">
             Configure daily and monthly cost caps and per-child overrides.
           </p>
         </div>

         {/* NEW: Current usage section */}
         <section className="space-y-4">
           <div>
             <h2 className="text-lg font-semibold">Current usage</h2>
             <p className="text-sm text-muted-foreground mt-0.5">
               Live balance and daily/monthly spend per child.
             </p>
           </div>
           <Suspense fallback={<ChildUsageSectionSkeleton />}>
             <ChildUsageSection />
           </Suspense>
         </section>

         {/* EXISTING: Tabs (Global Defaults / Per-Child Overrides) */}
         <Suspense fallback={<SettingsFormSkeleton />}>
           <SettingsContent />
         </Suspense>
       </div>
     );
   }
   ```

   Note the wrapping div changed from `space-y-6` to `space-y-8` to give the new section + tabs block extra breathing room. Keep the existing `<h1>` + subtitle block untouched.

## Edit C — `src/app/(dashboard)/users/[userId]/page.tsx`

1. Delete lines 127–148 inclusive (the Usage & Limits block starting with `{/* Usage & Limits — 2 bars... */}` through the closing `)}` of the settings-link block). This leaves the page ending with the Account Details Card and its closing `</div>`.

2. Remove now-unused imports at the top of the file:
   - Remove line 1 `Suspense` import entirely if not used elsewhere in the file (after deletion it won't be)
   - Remove line 10 `UsageBars, UsageBarsSkeleton` import
   - Remove line 11 `TopUpButton` import

   Before committing, grep the file for `Suspense`, `UsageBars`, `TopUpButton` to confirm zero remaining references. If `Link` is still used (it is — breadcrumb line 80), keep its import.

3. The resulting file's JSX should end with the Account Details Card, followed by `</div>` (the outer `space-y-6` container). No trailing Usage & Limits block, no trailing settings-link block.

## Edit D — `src/app/(dashboard)/users/[userId]/loading.tsx`

Delete the "Usage & Limits — 2-bar skeleton" block (lines 31–44 inclusive — the outer `<div className="rounded-lg border p-6 space-y-5">` through its closing `</div>`). The loading skeleton then ends with the Account details card skeleton at line 29.

## Ordering guardrail

Make all four edits atomically in a single commit so CI never sees a broken intermediate state (e.g. `/settings` importing `TopUpButton` but `/users/{userId}` still rendering the same import — fine either way, but don't leave orphaned imports).
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx tsc --noEmit 2>&1 | tail -40 && grep -c "UsageBars" src/app/\(dashboard\)/users/\[userId\]/page.tsx && grep -c "UsageBars" src/app/\(dashboard\)/settings/page.tsx && grep -c "revalidatePath(\"/settings\")" src/app/\(dashboard\)/users/\[userId\]/actions.ts</automated>
  </verify>
  <done>
- `npx tsc --noEmit` produces no NEW errors (compare to pre-edit baseline)
- `grep -c "UsageBars" src/app/(dashboard)/users/[userId]/page.tsx` returns `0`
- `grep -c "UsageBars" src/app/(dashboard)/settings/page.tsx` returns `>= 2` (import + JSX usage + skeleton reference)
- `grep -c "revalidatePath(\"/settings\")" src/app/(dashboard)/users/[userId]/actions.ts` returns `1`
- `grep "Usage & Limits" src/app/(dashboard)/users/[userId]/loading.tsx` returns no matches
- `grep "visit the Settings page" src/app/(dashboard)/users/[userId]/page.tsx` returns no matches
- Git diff shows ONLY the four intended files modified (no drift into unrelated files)
  </done>
</task>

<task type="auto">
  <name>Task 2: Deploy to Railway + verify live /settings renders per-child usage</name>
  <files>(no file writes — deploy + verification)</files>
  <action>
## Deployment protocol (per 2026-04-17 memory note — run from main repo, NOT worktree)

1. Confirm we're in the main repo (not a worktree):
   ```bash
   cd /data/home/KidAI
   git rev-parse --show-toplevel
   # Expected: /data/home/KidAI (NOT a worktree path)
   git rev-parse --is-inside-work-tree  # true
   git worktree list  # confirm /data/home/KidAI is the main
   ```

2. Stage + commit the Task 1 changes (scoped `260417-njb` prefix per project convention):
   ```bash
   cd /data/home/KidAI
   git add src/app/\(dashboard\)/settings/page.tsx \
           src/app/\(dashboard\)/users/\[userId\]/page.tsx \
           src/app/\(dashboard\)/users/\[userId\]/loading.tsx \
           src/app/\(dashboard\)/users/\[userId\]/actions.ts
   git commit -m "feat(260417-njb): move per-child usage + top-up from /users/{userId} to /settings"
   ```

3. Deploy via Railway CLI:
   ```bash
   cd /data/home/KidAI
   railway up --service kidschat-admin --detach
   ```
   Capture the deployment ID from the CLI output.

4. Poll Railway GraphQL until status is `SUCCESS` (or fail-fast on `FAILED`/`CRASHED`):
   - Service ID: `83b7b7d1-76bd-4e99-8466-d2a1bf44f8d2`
   - Environment ID: `fd18f36e-b726-425a-9d96-95d59d768635`
   - Use the `deployments` query filtered by `serviceId` + `environmentId`, match on the deployment ID from step 3
   - Poll interval: 15s, max 10 minutes. If SUCCESS: proceed. If FAILED: fetch `deploymentLogs` tail and abort.

5. Live verification (pick whichever is easier — visual is authoritative):
   - **Primary (grep the deployed JS bundle):**
     ```bash
     curl -s https://kidschat-admin-production.up.railway.app/settings | \
       grep -oE "(Current usage|Live balance and daily/monthly)" | head -5
     ```
     Note: Admin-only page — raw HTML may redirect to `/login`. In that case, grep one of the compiled JS bundles referenced in the /login HTML for the literal string `Current usage` or fall back to visual verification.
   - **Authoritative (visual):** Open https://kidschat-admin-production.up.railway.app/settings in a browser with an admin session cookie. Confirm:
     - "Current usage" heading visible above the tabs
     - One card per non-admin child (currently 2), each with Today + This month bars
     - Top up €0.10 button visible on each card
     - Tabs (Global Defaults / Per-Child Overrides) still render below
     - Navigate to `/users/{any-kid-id}` — confirm Usage & Limits section and "visit the Settings page" link are BOTH gone

6. Smoke-test top-up from the new location:
   - On `/settings`, click Top up €0.10 for one child
   - Confirm toast: "Topped up €0.10 for {name}"
   - Confirm the Today bar updates on the same page (this validates the `revalidatePath("/settings")` wiring)

## Failure playbook

- **Build fails on Railway:** fetch last 100 lines of deployment logs, fix locally, `railway up` again
- **SSR error on /settings:** likely the twice-called `getSettingsData()` triggering — check server logs for double-fetch warnings (should be benign, but if it throws, refactor to single call and pass `overrides` down via shared data)
- **Top-up doesn't refresh UsageBars:** verify `revalidatePath("/settings")` was added to actions.ts; if missing, hotfix + redeploy
  </action>
  <verify>
    <automated>railway status --service kidschat-admin 2>&1 | grep -iE "deploy|status" | head -5 && curl -s -o /dev/null -w "%{http_code}" https://kidschat-admin-production.up.railway.app/settings</automated>
  </verify>
  <done>
- Latest deployment for `kidschat-admin` service is in `SUCCESS` state
- `curl` against `/settings` returns 2xx or 3xx (redirect to /login is fine for unauthenticated)
- Visual confirmation (from parent/user or from admin-session fetch): `/settings` shows "Current usage" + per-child cards above tabs; `/users/{userId}` no longer shows Usage & Limits or the settings-link
- Top-up button click on `/settings` updates the Today bar after server-action completes (end-to-end smoke test)
  </done>
</task>

</tasks>

<verification>
## Phase-level checks

1. **Type-check:** `npx tsc --noEmit` — no NEW errors vs baseline
2. **Build:** `npm run build` passes locally (optional if Railway build passes)
3. **Code absence:** Zero `UsageBars`/`TopUpButton` references in `src/app/(dashboard)/users/[userId]/` tree
4. **Code presence:** `UsageBars`, `TopUpButton`, and `Current usage` all appear in `src/app/(dashboard)/settings/page.tsx`
5. **Revalidation wiring:** `actions.ts` revalidates both `/users/${userId}` and `/settings`
6. **Visual:**
   - `/settings` top section shows N cards (N = non-admin user count, currently 2), stacked vertically, each with UsageBars + right-aligned TopUpButton, ABOVE the Global Defaults / Per-Child Overrides tabs
   - `/users/{userId}` shows breadcrumb, heading, Account Details only — no Usage & Limits, no settings-link
7. **Functional:** Top-up on `/settings` succeeds, toast fires, Today bar re-renders with updated spend
8. **Perceived performance:** `/settings` shell renders immediately; child cards stream in via Suspense boundary (no blank page while balances are fetched)
</verification>

<success_criteria>
- User can visit `/settings` and see live per-child usage + top-up controls above the tabs
- User can top up a child's balance directly from `/settings` without navigating to `/users/{userId}`
- `/users/{userId}` is leaner (no more redundant usage section or cross-page link)
- Railway production deployment is live and in SUCCESS state
- No regressions in type-check, build, or existing tab functionality
</success_criteria>

<output>
After completion, create `.planning/quick/260417-njb-consolidate-per-child-usage-limits-into-/260417-njb-SUMMARY.md` with:
- Commit SHA of the Task 1 edit
- Railway deployment ID + final status
- Screenshot evidence (optional — or a `curl | grep` confirming "Current usage" string presence in deployed HTML/JS)
- Any deviations from the plan (e.g. if `getSettingsData()` was refactored to a single call)
- Note any follow-ups (e.g. if the `monthlySpendEur` dead-field bug from 15.3 becomes more visible now that the bars are on the main settings page)
</output>
