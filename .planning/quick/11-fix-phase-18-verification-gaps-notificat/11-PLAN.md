---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/notifications/page.tsx
  - src/auth.ts
  - src/app/api/notification-recipients/route.ts
autonomous: true
requirements: [PHASE-18-GAPS]
must_haves:
  truths:
    - "daily_summary and account_activity emails show correct colored badges in notification history"
    - "Summary section at top of notifications page shows counts for all 4 email types"
    - "Successful admin login triggers account activity notification (if recipients opted in)"
    - "Adding or removing a notification recipient triggers account activity notification"
  artifacts:
    - path: "src/app/(dashboard)/notifications/page.tsx"
      provides: "Badge rendering for all 4 email types"
      contains: "daily_summary"
    - path: "src/auth.ts"
      provides: "Login event fires notifyAccountActivity"
      contains: "notifyAccountActivity"
    - path: "src/app/api/notification-recipients/route.ts"
      provides: "Recipient mutations fire notifyAccountActivity"
      contains: "notifyAccountActivity"
  key_links:
    - from: "src/auth.ts"
      to: "src/lib/account-activity.ts"
      via: "events.signIn callback"
      pattern: "notifyAccountActivity"
    - from: "src/app/api/notification-recipients/route.ts"
      to: "src/lib/account-activity.ts"
      via: "POST and DELETE handlers"
      pattern: "notifyAccountActivity"
---

<objective>
Fix two Phase 18 verification gaps: (1) notification history page does not render badges for
daily_summary or account_activity email types, and (2) notifyAccountActivity is exported but
never called automatically from login or recipient mutation flows.

Purpose: Close verification gaps so all email types display correctly and account activity
alerts fire as designed.
Output: Updated notifications page, auth.ts with signIn event, recipients route with activity calls.
</objective>

<context>
@src/app/(dashboard)/notifications/page.tsx
@src/lib/account-activity.ts
@src/auth.ts
@src/app/api/notification-recipients/route.ts
</context>

<interfaces>
<!-- From src/lib/account-activity.ts -->
```typescript
export type AccountActivityType =
  | "login"
  | "settings_change"
  | "recipient_added"
  | "recipient_removed";

export interface NotifyAccountActivityInput {
  activityType: AccountActivityType;
  description: string;
  performedBy: string;
  ipAddress?: string;
}

export async function notifyAccountActivity(
  input: NotifyAccountActivityInput
): Promise<NotifyAccountActivityResult>;
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add daily_summary and account_activity badges to notification history page</name>
  <files>src/app/(dashboard)/notifications/page.tsx</files>
  <action>
In src/app/(dashboard)/notifications/page.tsx:

1. Update the EmailNotification type union (line 17) from:
   `"safety_alert" | "weekly_digest"`
   to:
   `"safety_alert" | "weekly_digest" | "daily_summary" | "account_activity"`

2. Update the type cast in getNotifications() (line 41) to match the expanded union.

3. Add two new count variables after the existing ones (after line 80):
   - `dailySummaryCount` filtering for `n.type === "daily_summary"`
   - `accountActivityCount` filtering for `n.type === "account_activity"`

4. Add two new summary badges in the flex container (after the weekly digests badge, around line 117):
   - Daily summaries: green badge (`bg-green-100 text-green-800 border-green-200`) showing `dailySummaryCount`
   - Account activity: amber badge (`bg-amber-100 text-amber-800 border-amber-200`) showing `accountActivityCount`

5. Replace the badge rendering ternary in the table body (lines 154-168) with a helper or
   multi-branch conditional. Map each type to its badge:
   - `safety_alert` -> red badge, text "Safety Alert" (existing)
   - `weekly_digest` -> blue badge, text "Weekly Digest" (existing)
   - `daily_summary` -> green badge (`bg-green-100 text-green-800 border-green-200`), text "Daily Summary"
   - `account_activity` -> amber badge (`bg-amber-100 text-amber-800 border-amber-200`), text "Account Activity"

6. Update the Child/Subject column logic (lines 174-178) to handle the new types:
   - `daily_summary`: show `n.meta.date` as "Summary for {date}" if available, else dash
   - `account_activity`: show `n.meta.activityType` label if available, else dash
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx tsc --noEmit src/app/\(dashboard\)/notifications/page.tsx 2>&1 | head -20</automated>
  </verify>
  <done>All 4 email types render distinct colored badges. Summary section shows counts for all 4 types. No TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 2: Wire notifyAccountActivity into auth signIn event and recipient mutations</name>
  <files>src/auth.ts, src/app/api/notification-recipients/route.ts</files>
  <action>
**In src/auth.ts:**

Add an `events` property to the NextAuth config object (alongside the spread `...authConfig`
and `providers`). Add a `signIn` event handler:

```typescript
events: {
  async signIn({ user }) {
    // Fire-and-forget — do not block login on notification delivery
    import("@/lib/account-activity")
      .then(({ notifyAccountActivity }) =>
        notifyAccountActivity({
          activityType: "login",
          description: `Admin login: ${user.email}`,
          performedBy: user.email ?? "unknown",
        })
      )
      .catch((err) => console.error("[auth] account activity notify failed:", err));
  },
},
```

Use dynamic import() so the module loads lazily. Use .catch() so notification failure
never blocks or breaks login. This runs server-side after successful credential auth.

**In src/app/api/notification-recipients/route.ts:**

Add fire-and-forget notifyAccountActivity calls to POST and DELETE handlers, AFTER the
successful database operation but BEFORE the response:

In POST handler (after `addRecipient` succeeds, before returning the response):
```typescript
import("@/lib/account-activity")
  .then(({ notifyAccountActivity }) =>
    notifyAccountActivity({
      activityType: "recipient_added",
      description: `Added notification recipient: ${email}`,
      performedBy: session.user?.email ?? "unknown",
    })
  )
  .catch((err) => console.error("[recipients] activity notify failed:", err));
```

In DELETE handler (after `removeRecipient` succeeds, before returning the response):
```typescript
import("@/lib/account-activity")
  .then(({ notifyAccountActivity }) =>
    notifyAccountActivity({
      activityType: "recipient_removed",
      description: `Removed notification recipient (id: ${id})`,
      performedBy: session.user?.email ?? "unknown",
    })
  )
  .catch((err) => console.error("[recipients] activity notify failed:", err));
```

All calls are fire-and-forget with .catch() — they must NOT affect the primary response
or error handling of their host endpoints.
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx tsc --noEmit src/auth.ts src/app/api/notification-recipients/route.ts 2>&1 | head -20</automated>
  </verify>
  <done>Login events fire notifyAccountActivity("login"). Recipient POST fires "recipient_added". Recipient DELETE fires "recipient_removed". All fire-and-forget, no impact on primary flows. No TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 3: Build verification and deploy</name>
  <files></files>
  <action>
1. Run full project build: `npm run build` — must complete with no errors.
2. Deploy to Railway: `railway up --detach` from project root.
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>Build succeeds. Deployed to Railway. Notification history page renders all 4 email types with correct badges. Account activity notifications fire on login and recipient changes.</done>
</task>

</tasks>

<verification>
- TypeScript compiles with no errors
- `npm run build` succeeds
- Notification history page type union includes all 4 email types
- Badge colors: red (safety_alert), blue (weekly_digest), green (daily_summary), amber (account_activity)
- Summary section shows 4 badge counts
- auth.ts contains events.signIn calling notifyAccountActivity
- notification-recipients route.ts POST and DELETE call notifyAccountActivity
- All notifyAccountActivity calls are fire-and-forget with .catch()
</verification>

<success_criteria>
All 4 email notification types display with correct colored badges in the admin notification
history page. Account activity notifications automatically fire on admin login and recipient
add/remove actions without blocking those primary flows.
</success_criteria>

<output>
After completion, create `.planning/quick/11-fix-phase-18-verification-gaps-notificat/11-SUMMARY.md`
</output>
