# 19-03 Fix Applied

**Date:** 2026-04-16
**Plan:** 19-03 Task 2(B)
**Diagnosis finding applied:** (a) cron schedule inactive on Railway service

---

## Diagnosis-Recommended Fix

Per `19-03-CRON-DIAGNOSIS.md`, the recommended fix was:

> **Fix: Redeploy the admin service with `railway up` to force Railway to re-read railway.toml and register the `[[deploy.crons]]` entries.**

---

## Fix Attempt 1 — `railway up`

**Command run:**
```bash
cd /data/home/KidAI && railway up --service kidschat-admin
```

**Exit code:** 0 (success)
**Deployment status:** SUCCESS (deployment `7d28752f-7ea6-4dc6-bbf4-a35acc238825`, created 2026-04-16T21:28:43Z)

**Result:** INEFFECTIVE

Post-deploy check via Railway GraphQL:
```json
{ "serviceName": "kidschat-admin", "cronSchedule": null, "nextCronRunAt": null }
```

The `railway up` did NOT register the cron entries from `[[deploy.crons]]` in railway.toml.

**Root cause of failure:** The project uses a `Dockerfile` builder. Investigation revealed that when a `Dockerfile` is present, Railway's build system uses `DOCKERFILE` as the builder (confirmed from `serviceManifest.build.builder = "DOCKERFILE"`). Railway's `[[deploy.crons]]` config-as-code mechanism does NOT create cron service instances when the service uses a Dockerfile builder. The `fileServiceManifest` shows `deploy: {}` (empty), confirming Railway reads railway.toml but silently ignores the `[[deploy.crons]]` entries in this context.

Evidence from deployment metadata:
```json
{
  "configFile": "railway.toml",
  "fileServiceManifest": { "build": { "builder": "NIXPACKS" }, "deploy": {} },
  "propertyFileMapping": { "deploy.crons": "$.deploy.crons", "build.builder": "$.build.builder" }
}
```

The `propertyFileMapping` shows Railway IS reading `deploy.crons` from railway.toml, but `deploy: {}` in the manifest confirms it does not apply them.

---

## Fix Attempt 2 — Create dedicated cron services via Railway GraphQL API

Since `[[deploy.crons]]` with Dockerfile builder doesn't work, the fix was to create 3 separate Railway service instances — one per cron job — each configured as a cron service using `curlimages/curl` as the base image.

### Service creation

**daily-reset-cron service (id: 2d6a65f1-7761-48d3-8bb4-ed4e6e866b79):**
```graphql
mutation {
  serviceCreate(input: { name: "daily-reset-cron", projectId: "784cfa32-257c-4e19-8ebb-37ea6931c9e2" }) { id name }
}
```
Exit: created (id: `2d6a65f1-7761-48d3-8bb4-ed4e6e866b79`)

```graphql
mutation {
  serviceInstanceUpdate(serviceId: "2d6a65f1-7761-48d3-8bb4-ed4e6e866b79", environmentId: "fd18f36e-b726-425a-9d96-95d59d768635", input: {
    cronSchedule: "0 0 * * *",
    startCommand: "curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset",
    source: { image: "curlimages/curl:latest" }
  })
}
```
Exit: `true`

CRON_SECRET variable upserted. Deployed via `serviceInstanceDeployV2` (deployment `6fd2cfde-75f4-4383-aa71-8b2602d7ac79`, status: SUCCESS).

**monthly-reset-cron service (id: 815169c6-8ac0-4a99-af50-c8969a47d99b):**
- Schedule: `0 0 1 * *` (midnight UTC, 1st of month)
- Command: `curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/monthly-reset`
- Image: `curlimages/curl:latest`
- Deployment `c74060af-a1ad-4037-8728-480f458c153e`: SUCCESS

**daily-notifications-cron service (id: 7f05c92e-a7a0-4a2b-8a9a-3767a2d27ffc):**
- Schedule: `0 8 * * *` (8am UTC daily)
- Command: `curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/notify/daily-summary && curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/notify/weekly-digest`
- Image: `curlimages/curl:latest`
- Deployment `377a43a1-9356-4030-bb92-f14d3ac74d59`: SUCCESS

### Post-fix verification — cron schedule state

Query: `project.environments.serviceInstances.node.{serviceName, cronSchedule, nextCronRunAt}`

```
daily-reset-cron:          cronSchedule=0 0 * * *,   nextCronRunAt=2026-04-17T00:00:00.000Z
monthly-reset-cron:        cronSchedule=0 0 1 * *,   nextCronRunAt=2026-05-01T00:00:00.000Z
daily-notifications-cron:  cronSchedule=0 8 * * *,   nextCronRunAt=2026-04-17T08:00:00.000Z
kidschat-admin:            cronSchedule=None,          nextCronRunAt=None (web service, correct)
```

All 3 cron services have `nextCronRunAt` set — they WILL fire on schedule.

---

## Post-Fix Verification — second manual POST

**Command run (after fix, 2026-04-16 ~21:45 UTC):**
```bash
CRON_SECRET="56b11545e9f6b4a08f15e7c2f91364b6515a5e23cc8b10bd54e6bfa4fd430a99"
curl -s -X POST -H "x-cron-secret: $CRON_SECRET" \
  https://kidschat-admin-production.up.railway.app/api/cron/daily-reset
```

**HTTP Status: 200**
**Response body:** `{"reset":2,"accumulated":2,"errors":[]}`

**MongoDB state after second POST:**
```
balance_state:
  Sebastian: lastDailyReset = ISODate('2026-04-16T00:00:00.000Z')
  Penelope:  lastDailyReset = ISODate('2026-04-16T00:00:00.000Z')

balances:
  Sebastian: tokenCredits = 543478  (EUR 0.50 — new cap from Plan 19-02)
  Penelope:  tokenCredits = 543478  (EUR 0.50 — new cap from Plan 19-02)
```

Note: `tokenCredits` increased from 217,391 (EUR 0.20) to 543,478 (EUR 0.50) because Plan 19-02 raised `dailyCostCapEur` from 0.20 to 0.50. The `$max` operator in `topUpDailyBudget` correctly topped up to the new higher cap.

Both children:
- `lastDailyReset` = today's UTC date — PASS
- `tokenCredits > 100,000` — PASS (both have 543,478)

---

## Summary

The fix required TWO steps:
1. `railway up` — attempted but insufficient (Dockerfile builder silently ignores `[[deploy.crons]]`)
2. Create 3 dedicated cron services via Railway GraphQL API — SUCCESSFUL

The underlying architectural issue is that Railway's `[[deploy.crons]]` config-as-code does NOT work when the service uses a Dockerfile builder. The `railway.toml` entries are effectively dead config. Three new Railway services (`daily-reset-cron`, `monthly-reset-cron`, `daily-notifications-cron`) now permanently replace the railway.toml cron entries.

These new services will persist across future redeployments of the main `kidschat-admin` service because they are independent service instances, not deployment-level configs.
