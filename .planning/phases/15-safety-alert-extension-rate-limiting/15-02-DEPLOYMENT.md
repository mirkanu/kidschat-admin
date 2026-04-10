# Phase 15 Plan 02 — Deployment Record

## Deployment

- **Deploy date:** 2026-04-10
- **Deployed via:** `railway up` (no GitHub auto-deploy configured — manual trigger required)
- **Deploy commit SHA:** d7cde823580efb0989375c36c55c2fb4189a7aef
- **Railway deployment ID:** d0e78fcc-6ab1-4882-b431-615c46b0dc0f
- **Railway deployment status:** SUCCESS (12:16:34 UTC)
- **Admin dashboard URL:** https://kidschat-admin-production.up.railway.app

## Environment Variables

| Variable | Status | Notes |
|----------|--------|-------|
| `CRON_SECRET` | SET | 64-char hex string — see Railway service vars (do not print value) |
| `USD_TO_EUR_RATE` | NOT SET | Uses hardcoded default of 0.92 |

## Cron Endpoints (Deployed)

All 5 endpoints respond with 200 + JSON payload on valid secret, 401 on missing/wrong secret.

| Endpoint | Method | Verified 200 | Verified 401 |
|----------|--------|--------------|--------------|
| /api/cron/cost-ledger-sweep | POST | YES — `{"processed":0,"inserted":0}` | YES |
| /api/cron/limit-enforcement | POST | YES — `{"enforced":[]}` | YES |
| /api/cron/bonus-detection | POST | YES — `{"confirmed":0,"expired":0}` | YES |
| /api/cron/daily-reset | POST | YES — `{"unlocked":0}` | YES |
| /api/cron/monthly-reset | POST | YES — `{"restored":0}` | YES |

## Cron Schedules to Configure in Railway Dashboard

Railway does not support cron schedule configuration via CLI or GraphQL API (no `scheduledTrigger` mutation available). These must be configured manually via the Railway dashboard for the `kidschat-admin` service.

**Note:** Railway crons are configured as "Cron" services (separate from the main service), posting to the admin dashboard URL with the x-cron-secret header.

| Service Name | Schedule | Target Endpoint | Method | Headers |
|-------------|----------|----------------|--------|---------|
| cost-ledger-sweep | `*/2 * * * *` | `https://kidschat-admin-production.up.railway.app/api/cron/cost-ledger-sweep` | POST | `x-cron-secret: $CRON_SECRET` |
| limit-enforcement | `1-59/2 * * * *` | `https://kidschat-admin-production.up.railway.app/api/cron/limit-enforcement` | POST | `x-cron-secret: $CRON_SECRET` |
| bonus-detection | `* * * * *` | `https://kidschat-admin-production.up.railway.app/api/cron/bonus-detection` | POST | `x-cron-secret: $CRON_SECRET` |
| daily-reset | `0 0 * * *` | `https://kidschat-admin-production.up.railway.app/api/cron/daily-reset` | POST | `x-cron-secret: $CRON_SECRET` |
| monthly-reset | `0 0 1 * *` | `https://kidschat-admin-production.up.railway.app/api/cron/monthly-reset` | POST | `x-cron-secret: $CRON_SECRET` |

**CRON_SECRET:** Available in Railway service variables for the `kidschat-admin` service. Full 64-char hex value — use `railway variables --json | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d['CRON_SECRET'])"` to retrieve.

## Notes

- The Railway CLI `railway up` command was temporarily failing with "error decoding response body" during deployment — retried successfully after a few minutes.
- `serviceInstanceRedeploy` and `serviceInstanceDeploy` GraphQL mutations only redeploy cached images — `railway up` is required for fresh builds from source.
- Railway's table display of env vars truncates long values — always use `railway variables --json` to get the full secret.
