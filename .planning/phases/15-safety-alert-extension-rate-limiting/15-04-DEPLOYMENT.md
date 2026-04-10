# 15-04 Deployment Record

**Date:** 2026-04-10
**Plan:** 15-04 — Backend rewrite (budget.ts + polling listener + migration + crons)

---

## Deploy Commit

- `7d170c3` feat(15-04): implement budget.ts with 26 unit tests (TDD)
- `811fbb9` feat(15-04): delete legacy files + migration script + rewrite crons/settings
- `aaaac6e` feat(15-04): add change-stream-listener + instrumentation.ts polling loop
- `1596c27` chore(15-04): add railway.toml with 2 reset cron services
- `e90dc81` fix(15-04): fix instrumentation.ts webpack externals
- `de61764` feat(15-04): add temporary migration API endpoint

**Final deploy:** `railway up` — build time ~140s
**Deploy URL:** https://kidschat-admin-production.up.railway.app

---

## railway.toml Contents

```toml
[build]
builder = "NIXPACKS"

[[deploy.crons]]
name = "daily-reset"
schedule = "0 0 * * *"
command = "curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset"

[[deploy.crons]]
name = "monthly-reset"
schedule = "0 0 1 * *"
command = "curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/monthly-reset"
```

NOTE: Railway's [[deploy.crons]] config-as-code feature requires Railway to process the `railway.toml` file during `railway up`. As of 2026-04-10, Railway may or may not automatically create cron services from `railway.toml` — this feature was in preview. If the crons are NOT automatically created after deploy, they must be added manually via the dashboard (see "Legacy Cron Deletion" section below for the process, same steps apply for adding new crons).

---

## Migration Run

**Method:** POST /api/admin/migrate (one-shot endpoint, auth via CRON_SECRET)
**Command:** `curl -X POST https://kidschat-admin-production.up.railway.app/api/admin/migrate -H "x-admin-secret: $CRON_SECRET"`

**Output:**
```json
{
  "success": true,
  "log": [
    "Step 1: Rewriting settings docs...",
    "Found 0 settings docs",
    "global_defaults: inserted with HARDCODED_DEFAULTS",
    "Step 2: Seeding balance_state for non-admin users...",
    "Found 2 non-admin users",
    "Seeded balance_state for userId=69d0315763d6125f1f553e97",
    "Seeded balance_state for userId=69d0315763d6125f1f553e98",
    "balance_state: 2 seeded",
    "Step 3: Dropping cost_ledger...",
    "cost_ledger: DROPPED",
    "Step 4: Dropping locked_acl_entries...",
    "locked_acl_entries: DROPPED",
    "Migration complete."
  ]
}
```

**Result:** SUCCESS — settings doc created, 2 balance_state docs seeded, collections dropped.

**Idempotent:** Re-running returns "already migrated" for each doc. Safe to re-run.

---

## Legacy Cron Deletion (MANUAL STEP REQUIRED)

**Context:** Per 15-02-SUMMARY.md findings, Railway does NOT support cron service deletion via CLI or GraphQL. This is a documented dead end.

The following 3 legacy cron services must be deleted manually in the Railway dashboard:

1. **cost-ledger-sweep** — Was: `0/5 * * * *` (every 5 min)
2. **limit-enforcement** — Was: `* * * * *` (every minute)
3. **bonus-detection** — Was: `* * * * *` (every minute)

**Steps:**
1. Go to: https://railway.com/project/784cfa32-257c-4e19-8ebb-37ea6931c9e2
2. Click on each legacy cron service
3. Settings → Danger Zone → Delete Service
4. Confirm deletion

These services will fail if they fire because their route.ts files have been deleted. They won't cause errors to end users (they're server-side cron workers) but should be cleaned up to avoid confusion.

**The new reset crons are defined in railway.toml** and should be registered automatically on `railway up`. If not, add them manually via:
- Service: kidschat-admin
- Type: Cron
- daily-reset: `0 0 * * *` → `curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/daily-reset`
- monthly-reset: `0 0 1 * *` → `curl -fsS -X POST -H 'x-cron-secret: $CRON_SECRET' https://kidschat-admin-production.up.railway.app/api/cron/monthly-reset`

---

## Smoke Test Results

```
POST /api/cron/daily-reset (with correct secret)
→ {"reset":2,"errors":[]}  ✓

POST /api/cron/monthly-reset (with correct secret)
→ {"reset":2,"errors":[]}  ✓

POST /api/cron/daily-reset (wrong secret)
→ {"error":"Unauthorized"}  ✓ (401)
```

---

## Sample MongoDB Docs Post-Migration

**balance_state (per non-admin child):**
```json
{
  "userId": "69d0315763d6125f1f553e97",
  "lastDailyReset": "2026-04-10T00:00:00.000Z",
  "lastMonthlyReset": "2026-04-01T00:00:00.000Z",
  "monthlySpendEur": 0,
  "warnedAt70PctOn": null,
  "activeOfferMessageId": null,
  "activeOfferExpiresAt": null,
  "activeOfferConversationId": null
}
```

**settings (global_defaults):**
```json
{
  "_id": "global_defaults",
  "key": "global_defaults",
  "dailyCostCapEur": 0.1,
  "monthlyCostCapEur": 2.0,
  "bonusPackEur": 0.2,
  "weeklyBonusCapEur": 0.5,
  "bonusMessageTemplate": "You've reached your limit. Type YES to unlock extra usage."
}
```

---

## Instrumentation Hook Verification

Railway logs confirm `register()` fired correctly:
```
[instrumentation] register() fired — polling listener started
[change-stream-listener] Starting polling loop (60s interval)...
 ✓ Ready in 355ms
```

---

## TODO: Post-Migration Cleanup

1. Delete `src/app/api/admin/migrate/route.ts` (temporary migration endpoint)
2. Remove `api/admin/migrate` from middleware bypass in `src/middleware.ts`
3. Verify legacy cron services deleted in Railway dashboard (manual step above)
4. Consider deleting `scripts/migrate-15-04.ts` after confirmed complete
