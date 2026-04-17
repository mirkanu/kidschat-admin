---
phase: quick-260417-afs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - railway.toml
autonomous: false
requirements:
  - QUICK-CRON-AUTH-FIX
must_haves:
  truths:
    - "Railway cron services authenticate successfully (not 401) against /api/cron/* and /api/notify/* endpoints"
    - "Today's missed daily budget top-up is recovered for non-admin children"
    - "daily-notifications cron succeeds at 08:00 UTC today (first post-fix run) — parent digest + weekly summary emails send"
    - "railway.toml cron command uses sh -c wrapper so $CRON_SECRET expands at runtime"
  artifacts:
    - path: "railway.toml"
      provides: "Three cron services with shell-wrapped startCommands"
      contains: "sh -c"
  key_links:
    - from: "railway.toml deploy.crons[].command"
      to: "process.env.CRON_SECRET inside Railway container"
      via: "sh -c shell expansion"
      pattern: "sh -c \".*\\$CRON_SECRET.*\""
    - from: "curl x-cron-secret header"
      to: "src/app/api/cron/daily-reset/route.ts (and notify/* peers)"
      via: "HTTP POST with valid secret"
      pattern: "x-cron-secret:.*\\$CRON_SECRET"
---

<objective>
Fix broken Railway cron authentication. All three cron services (daily-reset, monthly-reset, daily-notifications) currently send the literal string `$CRON_SECRET` as the header value instead of the expanded env var, because Railway's `curlimages/curl:latest` image has curl as its entrypoint — there's no shell to perform variable expansion. Route handler correctly rejects with 401. daily-reset already crashed at 2026-04-17T00:00:52Z; daily-notifications will fail at 08:00 UTC (~90 min) unless fixed.

Purpose: Restore automated daily budget top-ups for children and automated parent email notifications. Without this fix, children silently lose their daily budget each midnight and parents stop receiving daily summaries / weekly digests.

Output: Patched railway.toml + manual curl to recover today's missed top-up + verified post-redeploy success via Railway GraphQL.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@railway.toml
@src/app/api/cron/daily-reset/route.ts

<diagnosis>
# Forensic evidence already gathered — do NOT re-investigate

Broken command in all 3 railway.toml cron entries:
```
curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset
```

Why broken: Railway's `curlimages/curl:latest` has curl as entrypoint. Railway passes startCommand directly as argv to curl. Single-quoted `$CRON_SECRET` never expands — header value is sent literally.

Reproduction proof:
- `curl -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset` → HTTP 401
- `curl -H 'x-cron-secret: <real-secret>' https://...` → HTTP 200 {"reset":2,"accumulated":2,"errors":[]}

Fix pattern: Wrap each `command = "curl ..."` in `sh -c "..."`. The outer sh provides expansion; inner single quotes are safe because sh processes them AFTER $CRON_SECRET is expanded by the outer double-quoted sh -c argument.

Canonical form:
```
command = "sh -c \"curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset\""
```

For the daily-notifications entry (which chains two curl calls with &&), the entire compound command goes inside the single sh -c.

Production impact:
- daily-reset: CRASHED last night (2026-04-17T00:00:52Z) — 2 non-admin children have stale budgets from yesterday, no top-up applied
- daily-notifications: next run 08:00 UTC today — parent daily summary + weekly digest emails will not send
- monthly-reset: next run 2026-05-01 — budget monthly rollover will fail

Railway deployment:
- `git push` triggers auto-redeploy of all 3 cron services (shared railway.toml)
- Services: daily-reset=2d6a65f1-7761-48d3-8bb4-ed4e6e866b79, daily-notifications=7f05c92e-a7a0-4a2b-8a9a-3767a2d27ffc, monthly-reset=815169c6-8ac0-4a99-af50-c8969a47d99b
- Env: fd18f36e-b726-425a-9d96-95d59d768635
- GraphQL API: https://backboard.railway.com/graphql/v2 with token from ~/.config/railway/config.json

Real CRON_SECRET for manual recovery call: `56b11545e9f6b4a08f15e7c2f91364b6515a5e23cc8b10bd54e6bfa4fd430a99`
</diagnosis>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Manually recover today's missed daily-reset (PRE-deploy)</name>
  <files>(no files — HTTP call only)</files>
  <action>
  Before touching railway.toml, recover today's missed budget top-up so the 2 non-admin children have a working budget for today while Railway redeploys.

  Run (using the real CRON_SECRET from the diagnosis block):
  ```bash
  curl -fsS -X POST \
    -H 'x-cron-secret: 56b11545e9f6b4a08f15e7c2f91364b6515a5e23cc8b10bd54e6bfa4fd430a99' \
    https://kidschat-admin-production.up.railway.app/api/cron/daily-reset
  ```

  Capture the response. Expected: HTTP 200 with JSON body like `{"reset":2,"accumulated":N,"errors":[]}`.

  If errors array is non-empty, log the userIds but DO NOT abort — proceed to Task 2. If HTTP != 200, STOP and report; do not proceed until the endpoint is healthy.

  This task is done pre-deploy (not post-deploy) so children's budgets are topped up immediately, before Railway's ~2-3 minute redeploy cycle completes.
  </action>
  <verify>
    <automated>curl -fsS -X POST -H 'x-cron-secret: 56b11545e9f6b4a08f15e7c2f91364b6515a5e23cc8b10bd54e6bfa4fd430a99' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset | grep -q '"reset":[0-9]'</automated>
  </verify>
  <done>HTTP 200 received from /api/cron/daily-reset with reset count ≥ 1. Response JSON captured in the task log for SUMMARY.</done>
</task>

<task type="auto">
  <name>Task 2: Fix railway.toml — wrap all three cron commands in sh -c</name>
  <files>railway.toml</files>
  <action>
  Edit railway.toml. Replace the three `command = "curl ..."` lines with sh-wrapped equivalents. Do NOT change schedule, name, or any other field. Do NOT touch the [build] section.

  Exact target state for the three crons:

  ```toml
  [[deploy.crons]]
  name = "daily-reset"
  schedule = "0 0 * * *"
  command = "sh -c \"curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset\""

  [[deploy.crons]]
  name = "monthly-reset"
  schedule = "0 0 1 * *"
  command = "sh -c \"curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/monthly-reset\""

  [[deploy.crons]]
  name = "daily-notifications"
  schedule = "0 8 * * *"
  command = "sh -c \"curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/notify/daily-summary && curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/notify/weekly-digest\""
  ```

  Key escaping rules:
  - Outer TOML string uses double quotes, so inner `"` must be `\"`
  - `sh -c "..."` uses double quotes around the full shell command → `$CRON_SECRET` expands
  - Header value uses single quotes inside the sh command → once sh has expanded $CRON_SECRET, the resulting string is passed as-is to curl

  Commit with message:
  ```
  fix(quick-260417-afs): wrap cron startCommands in sh -c for $CRON_SECRET expansion

  Railway's curlimages/curl image has curl as entrypoint — no shell to expand
  env vars in the startCommand. Result: header sent as literal '$CRON_SECRET',
  all three cron services returned 401 from /api/cron/* and /api/notify/*.

  Fix: outer sh -c wrapper provides shell expansion; inner single-quoted header
  value is processed AFTER $CRON_SECRET expansion.

  Affected services:
  - daily-reset (crashed 2026-04-17T00:00:52Z — today's budget recovered via manual curl)
  - monthly-reset (next run 2026-05-01)
  - daily-notifications (next run 08:00 UTC today — restored by this fix)
  ```

  Then push to origin to trigger Railway auto-redeploy of all 3 cron services.
  </action>
  <verify>
    <automated>grep -c 'sh -c' /data/home/KidAI/railway.toml | grep -q '^3$' && ! grep -E "^command = \"curl" /data/home/KidAI/railway.toml</automated>
  </verify>
  <done>railway.toml contains exactly 3 occurrences of `sh -c`, zero bare `command = "curl` lines. Commit exists in git log on master. `git push` completed successfully.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify Railway redeploy + next cron run succeeds</name>
  <what-built>
  Patched railway.toml pushed. Railway should auto-redeploy all 3 cron services (daily-reset, monthly-reset, daily-notifications) within ~2-3 minutes. The next scheduled run is daily-notifications at 08:00 UTC today.

  Claude has already:
  1. Queried Railway GraphQL to confirm the new deployments reached SUCCESS status for all 3 services
  2. Captured the deployment IDs and startedAt timestamps
  3. If current time is past 08:00 UTC, queried the latest daily-notifications cron execution to confirm it returned SUCCESS (not the prior CRASHED state)
  4. If current time is before 08:00 UTC, triggered a one-off test run by invoking `/api/notify/daily-summary` with the redeployed cron service (via Railway's serviceInstanceRedeploy + waitForJob pattern) OR noted in the task log that verification is deferred until 08:00 UTC
  </what-built>
  <how-to-verify>
  1. Check Claude's captured output for deployment status — all 3 cron services should show `status: SUCCESS` on their most recent deployment after the push timestamp.

  2. Check inbox at ~08:00 UTC today (or whenever the next daily-notifications fires):
     - Expect: daily summary email received
     - Expect: NO Railway "Deployment Crashed" notification for daily-notifications

  3. Tomorrow morning (2026-04-18 shortly after 00:00 UTC), check:
     - Children's budgets topped up automatically (not manually triggered)
     - Admin dashboard shows fresh daily budget state
     - cron_state collection has `daily_reset.lastRunAt` ≈ 2026-04-18T00:00:00Z (automatic, not the manual Task 1 recovery timestamp)

  4. If daily-notifications run at 08:00 UTC CRASHED, report the Railway deployment logs — most likely cause would be a TOML escaping error.
  </how-to-verify>
  <resume-signal>Type "approved" once redeploy SUCCESS is confirmed via GraphQL (and ideally first post-fix cron run succeeds). Or describe any failures.</resume-signal>
</task>

</tasks>

<verification>
End-to-end verification chain:
1. Pre-deploy: manual curl recovers today's missed budget (Task 1 verify)
2. Config fix lands and propagates: 3x `sh -c` in railway.toml, git push completed (Task 2 verify)
3. Railway redeploys all 3 cron services to SUCCESS (Task 3, via GraphQL)
4. Next scheduled run (daily-notifications @ 08:00 UTC) succeeds — restored from broken state (Task 3, user confirms email received)
5. Tomorrow's automatic daily-reset @ 00:00 UTC succeeds — confirmed via cron_state.daily_reset.lastRunAt
</verification>

<success_criteria>
- `railway.toml` at master contains three `command = "sh -c \"...\""` entries, zero bare curl commands
- Railway GraphQL confirms all 3 cron services' latest deployments (post-push) are SUCCESS
- daily-reset manual recovery returned HTTP 200 with `reset >= 1`
- User confirms either:
  (a) daily-notifications 08:00 UTC run SUCCESS + email received, OR
  (b) Claude successfully triggered a post-deploy manual test against a /api/notify/* endpoint
- No "Deployment Crashed" events observed on the three cron services after push
</success_criteria>

<output>
After completion, create `.planning/quick/260417-afs-fix-broken-railway-cron-authentication-w/260417-afs-SUMMARY.md` documenting:
- Task 1 response body (reset / accumulated / errors counts)
- Commit SHA of the railway.toml fix
- Railway deployment IDs + SUCCESS timestamps for all 3 cron services
- First post-fix scheduled cron run outcome (daily-notifications 08:00 UTC) — SUCCESS or failure notes
- Any user-visible effects (parent emails received, kids' budgets restored)
</output>
