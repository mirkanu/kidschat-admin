---
slug: 260423-ete-daily-summary-always-send
date: 2026-04-23
status: planned
key_files:
  - src/lib/daily-summary.ts
  - src/app/api/notify/daily-summary/route.ts
---

<objective>
Always send the daily summary email, even when no child had activity.

Currently `getDailyChildStats` aggregates only kids who sent messages, so quiet days produce an empty list and the route skips sending. Fix: fetch all non-ADMIN users and merge zeros for kids absent from the aggregation. Remove the `stats.length === 0` skip guard from the route; only skip when there are no email recipients.
</objective>

<tasks>

<task id="1" type="auto">
  <name>Task 1: Merge zero-stat entries for silent kids in getDailyChildStats</name>
  <files>src/lib/daily-summary.ts</files>
  <action>
After the existing messages aggregation builds `kids` (only kids WITH messages), query the `users` collection for all non-ADMIN users:

```ts
const allKids = await db
  .collection("users")
  .find({ role: { $ne: "ADMIN" } })
  .project<{ name: string }>({ name: 1 })
  .toArray();
```

Build a Set of names already in `kids`, then push a zero-stat entry for each name that is missing:

```ts
const seen = new Set(kids.map((k) => k.name));
for (const user of allKids) {
  if (user.name && !seen.has(user.name)) {
    kids.push({
      name: user.name,
      totalMessages: 0,
      alertCount: 0,
      summary: "",
      alertSummary: null,
      conversationExcerpts: "",
      imageSearchCount: 0,
      imageSearchQueries: [],
    });
  }
}
```

Place this merge block AFTER `const kids = formatDailyStats(raw);` and BEFORE the `Promise.all` enrichment loop. No changes to the enrichment logic — zero-activity kids will naturally skip the Haiku call in the route (existing `totalMessages === 0 && imageSearchCount === 0` guard).

Also update the JSDoc on `getDailyChildStats` to say "Returns DailyChildStats for ALL non-ADMIN users" instead of "all non-ADMIN users with messages in the last 24 hours".
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>TypeScript compiles clean; zero-activity kids will appear in the returned array with totalMessages=0.</done>
</task>

<task id="2" type="auto">
  <name>Task 2: Remove stats.length === 0 skip guard from route, add quiet flag</name>
  <files>src/app/api/notify/daily-summary/route.ts</files>
  <action>
Change the skip condition at line 51 from:

```ts
if (toEmails.length === 0 || stats.length === 0) {
  return NextResponse.json({
    sent: 0,
    children: stats.length,
    date,
    skipped: true,
    reason: toEmails.length === 0 ? "no_eligible_recipients" : "no_child_stats",
  });
}
```

to:

```ts
if (toEmails.length === 0) {
  return NextResponse.json({
    sent: 0,
    children: stats.length,
    date,
    skipped: true,
    reason: "no_eligible_recipients",
  });
}
```

Then, after the skip guard and before the AI enrichment block, compute a quiet flag:

```ts
const allQuiet = stats.every(
  (k) => k.totalMessages === 0 && k.imageSearchCount === 0,
);
```

Include `quiet: allQuiet` in the final success `NextResponse.json(...)` call:

```ts
return NextResponse.json({
  sent: toEmails.length,
  children: stats.length,
  date,
  quiet: allQuiet,
});
```

No other changes. Do NOT touch the email template, enrichment loops, or audit doc logic.
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>TypeScript compiles clean; route only skips when toEmails is empty; quiet flag present in response JSON.</done>
</task>

<task id="3" type="auto">
  <name>Task 3: Commit and deploy to Railway</name>
  <files>src/lib/daily-summary.ts, src/app/api/notify/daily-summary/route.ts</files>
  <action>
Stage and commit both changed files:

```bash
git add src/lib/daily-summary.ts src/app/api/notify/daily-summary/route.ts
git commit -m "fix(daily-summary): always send email, include zero-activity kids

- getDailyChildStats now merges all non-ADMIN users into the result;
  kids with no messages in 24h appear with totalMessages=0
- Route skip guard now only fires when toEmails is empty (not when
  stats is empty); adds quiet:true to response on all-zero days
"
```

Then deploy to Railway (web service):

```bash
cd /data/home/KidAI && railway up --path-as-root .
```

Wait for deployment to finish, then smoke-test by hitting the endpoint manually:

```bash
curl -s -X POST https://kidai-production.up.railway.app/api/notify/daily-summary \
  -H "x-cron-secret: $CRON_SECRET" | jq .
```

Expected: `sent > 0`, `children >= 1` (even on a quiet day), and optionally `"quiet": true`.
  </action>
  <verify>
    <automated>curl -s -X POST https://kidai-production.up.railway.app/api/notify/daily-summary -H "x-cron-secret: $CRON_SECRET" | jq '{sent,children,quiet}'</automated>
  </verify>
  <done>Deploy succeeds; curl returns sent >= 1 and children equals the total number of non-ADMIN users.</done>
</task>

</tasks>

<success_criteria>
- Daily summary email fires on quiet days (no messages, no image searches).
- Every non-ADMIN kid appears in the email, even with "No activity yesterday."
- Both kids still appear in ONE email (unchanged).
- conversationExcerpts stripped from audit doc as before (T-p94-02 preserved).
- Route only skips when there are no recipient email addresses.
</success_criteria>
