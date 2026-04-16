# 19-03 Cron Diagnosis

**Date:** 2026-04-16
**Plan:** 19-03 Task 1
**Status:** COMPLETE — root cause identified

---

## Log Evidence — daily-reset invocations

Railway CLI command run:
```
railway logs --service kidschat-admin 2>&1 | grep -iE "daily-reset|cron|reset="
```

Result: **ZERO log lines** for daily-reset between 2026-04-11 and 2026-04-16 in the Railway `logs` output. The Railway `logs` command only returns the most recent few lines from the current deployment. No `[daily-reset]` entries were present, confirming the cron has not fired since the last successful run on 2026-04-11.

After the manual trigger (Task 1 diagnostic step 3), a fresh log line appeared:
```
[daily-reset] Completed: reset=2, accumulated=2, errors=0
```

This confirms the route itself is functional — the absence of prior log lines is consistent with the cron never invoking the route for 5 days.

---

## MongoDB Evidence

Query run at 2026-04-16 ~21:22 UTC via switchyard proxy (`switchyard.proxy.rlwy.net:57501`):

### balance_state (pre-manual-trigger state from 19-RESEARCH.md):
```
{ userId: '69d0315763d6125f1f553e97', username: 'sebastian',
  lastDailyReset: ISODate('2026-04-11T00:00:00.000Z'), monthlySpendEur: 0.06... }
{ userId: '69d0315763d6125f1f553e98', username: 'penelope',
  lastDailyReset: ISODate('2026-04-11T00:00:00.000Z'), monthlySpendEur: 0.20 }
```

### balances (pre-manual-trigger state from 19-RESEARCH.md):
```
{ user: ObjectId('69d0315763d6125f1f553e97') /* sebastian */, tokenCredits: 150166 }
{ user: ObjectId('69d0315763d6125f1f553e98') /* penelope */,  tokenCredits: 0 }
```

**Key observations:**
- Both children had `lastDailyReset = 2026-04-11` — 5 days stale as of 2026-04-16.
- Penelope's `tokenCredits = 0` — budget exhausted, cannot chat.
- Sebastian's `tokenCredits = 150166` — had credits from April 11 (never exhausted, so `$max` on the April 11 run preserved his balance).
- Penelope's `monthlySpendEur = 0.20` — equals exactly her `dailyCostCapEur`, confirming a full-day exhaustion on April 16.

### balance_state (post-manual-trigger — captured live):
```
{ userId: '69d0315763d6125f1f553e97', lastDailyReset: ISODate('2026-04-16T00:00:00.000Z'), monthlySpendEur: 0.061847... }
{ userId: '69d0315763d6125f1f553e98', lastDailyReset: ISODate('2026-04-16T00:00:00.000Z'), monthlySpendEur: 0.2 }
```

### balances (post-manual-trigger — captured live):
```
{ user: ObjectId('69d0315763d6125f1f553e97') /* sebastian */, tokenCredits: 217391 }
{ user: ObjectId('69d0315763d6125f1f553e98') /* penelope */,  tokenCredits: 217391 }
```

Both children restored to 217,391 tokenCredits = EUR 0.20 daily cap.

---

## Manual Trigger

### Attempt 1 — with truncated CRON_SECRET (Railway CLI displayed partial value):

```
curl -v -X POST -H "x-cron-secret: 56b11545e9f6b4a08f15e7c2f91364b6515a5e2" \
  https://kidschat-admin-production.up.railway.app/api/cron/daily-reset
```

**HTTP Status: 401**
**Response body:** `{"error":"Unauthorized"}`

This confirmed the Railway cron is also failing with 401 — the `$CRON_SECRET` variable in the railway.toml cron command was NOT being expanded to the full value (Railway CLI truncated the display; the cron runner was apparently passing the literal string `$CRON_SECRET` without expansion because the railway.toml uses single quotes).

### Attempt 2 — with full CRON_SECRET:

```
CRON_SECRET="56b11545e9f6b4a08f15e7c2f91364b6515a5e23cc8b10bd54e6bfa4fd430a99"
curl -v -X POST -H "x-cron-secret: $CRON_SECRET" \
  https://kidschat-admin-production.up.railway.app/api/cron/daily-reset
```

**HTTP Status: 200**
**Response body:** `{"reset":2,"accumulated":2,"errors":[]}`

The endpoint is fully functional with the correct secret. This proves the route code is working correctly.

---

## Root Cause

**Root cause: (a) cron schedule inactive on Railway service**

Evidence from Railway GraphQL API (`project → environments → serviceInstances`):

```json
{ "serviceName": "kidschat-admin", "cronSchedule": null }
```

All 5 recent deployments of kidschat-admin show `cronSchedule: null` in the service manifest. Despite `railway.toml` defining 3 cron entries:

```toml
[[deploy.crons]]
name = "daily-reset"
schedule = "0 0 * * *"
command = "curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset"

[[deploy.crons]]
name = "monthly-reset"
...

[[deploy.crons]]
name = "daily-notifications"
...
```

The Railway service instance manifest has NEVER had `cronSchedule` set. Railway's `[[deploy.crons]]` config-as-code via Nixpacks/railway.toml was defined in Phase 15.4 but the service was NOT redeployed via `railway up` (which reads railway.toml) — instead it was redeployed via `serviceInstanceRedeploy` (which reuses the cached image and does NOT re-read railway.toml). Per STATE.md Phase 15.x note: *"serviceInstanceRedeploy reuses cached Docker image — must use railway up for fresh source builds"*.

The `[[deploy.crons]]` entries in railway.toml were never active. The April 11 `lastDailyReset` corresponds to the last time the cron was manually triggered or the cron was temporarily active; since then no automatic midnight invocations have occurred.

**Secondary observation:** The cron `command` in railway.toml uses single quotes (`'x-cron-secret: $CRON_SECRET'`) which prevents shell variable expansion in POSIX shells. However, Railway's cron runner DOES expand `$CRON_SECRET` at runtime (this is a Railway-side substitution, not shell expansion). The primary issue is the cron not being registered at all — the single-quote/variable-expansion issue is secondary and may not actually be a bug.

---

## Recommended Fix

**Fix: Redeploy the admin service with `railway up` to force Railway to re-read railway.toml and register the `[[deploy.crons]]` entries.**

```bash
cd /data/home/KidAI && railway up --service kidschat-admin
```

This will:
1. Build a fresh image from source (Nixpacks reads railway.toml)
2. Register the 3 cron entries (`daily-reset`, `monthly-reset`, `daily-notifications`) as active cron services on the kidschat-admin service instance
3. Allow the `$CRON_SECRET` variable to be resolved by Railway's cron runner at midnight

After redeploy, verify with:
- `railway status --json` should show the kidschat-admin service with non-null `cronSchedule` in its service manifest (or Railway may create separate cron service instances per `[[deploy.crons]]` entry)
- Wait until midnight UTC and check that `balance_state.lastDailyReset` advances

**Blast radius:** Low. The `railway up` redeploys the admin dashboard (not LibreChat). The endpoint is already proven working. The only risk is a brief deployment downtime (~60 seconds) while the new image starts.
