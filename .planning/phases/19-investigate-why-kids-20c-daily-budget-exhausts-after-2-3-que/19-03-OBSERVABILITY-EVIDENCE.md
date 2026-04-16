# 19-03 Observability Evidence

**Date:** 2026-04-16
**Plan:** 19-03 Task 3
**File modified:** `src/app/api/cron/daily-reset/route.ts`

---

## Code Change

Added after the completion log line, before `return NextResponse.json(...)`:

```typescript
// Phase 19 observability — record last successful run so silent cron failures are detectable.
try {
  await db.collection("cron_state").updateOne(
    { key: "daily_reset" },
    {
      $set: {
        key: "daily_reset",
        lastRunAt: new Date(),
        lastRunStats: { reset, accumulated, errors: errors.length },
      },
    },
    { upsert: true }
  );
} catch (err) {
  // Non-fatal — don't fail the cron if observability write fails.
  console.error("[daily-reset] Failed to write cron_state:", err);
}
```

Design decisions:
- Reuses existing `cron_state` collection (per STATE.md Phase 15.x precedent)
- Uses `key: "daily_reset"` as the document identifier (consistent with existing pattern)
- Wrapped in try/catch — observability write failure does NOT fail the cron response
- `upsert: true` — creates the document on first run, updates on subsequent runs

---

## TypeScript Verification

```
npx tsc --noEmit -p . 2>&1 | grep "^src/"
```

**Output:** (empty — zero errors in src/)

Pre-existing TypeScript errors in `tests/` files are out of scope (not caused by this change).

---

## Deployment

Service: `kidschat-admin`
Deployment method: `railway up --service kidschat-admin` (from `/data/home/KidAI`)
Deployment ID: `9c5a618d-a5b4-4047-9f37-f3d7ec12dc05`
Status: SUCCESS
Created at: 2026-04-16T21:45:35Z

Confirmed in deployed bundle: `route.js` contains minified observability code:
```js
try{await d.collection("cron_state").updateOne({key:"daily_reset"},{$set:{key:"daily_reset",lastRunAt:new Date,lastRunStats:{reset:f,accumulated:g,errors:h.length}}},{upsert:!0})}catch(a){console.error("[daily-reset] Failed to write cron_state:",a)}
```

---

## Post-Deploy Verification

Manual POST to `/api/cron/daily-reset` at 2026-04-16 ~21:58 UTC (after new deployment was serving):

```bash
curl -s -X POST -H "x-cron-secret: $CRON_SECRET" \
  https://kidschat-admin-production.up.railway.app/api/cron/daily-reset
```

**Response:** `{"reset":2,"accumulated":2,"errors":[]}`

### MongoDB verification — cron_state.findOne({key: "daily_reset"}):

```javascript
db.getSiblingDB("test").cron_state.findOne({key: "daily_reset"})
```

**Result:**
```json
{
  "_id": "69e15a564880f84eaf8936ed",
  "key": "daily_reset",
  "lastRunAt": "2026-04-16T21:58:46.143Z",
  "lastRunStats": {
    "reset": 2,
    "accumulated": 2,
    "errors": 0
  }
}
```

**Verification:**
- `lastRunAt = "2026-04-16T21:58:46.143Z"` — today's date, after the redeploy time — PASS
- `lastRunStats.reset = 2` — both children processed — PASS
- `lastRunStats.accumulated = 2` — both children had spend accumulated — PASS
- `lastRunStats.errors = 0` — no errors — PASS

---

## How to Use for Monitoring

An admin can detect silent cron failures by checking:

```javascript
db.getSiblingDB("test").cron_state.findOne({key: "daily_reset"})
```

If `lastRunAt` is more than 25 hours old, the cron failed to run at midnight UTC. The `daily-reset-cron` Railway service (created in Task 2) also has `nextCronRunAt = 2026-04-17T00:00:00.000Z`, providing a secondary confirmation source.

Future enhancement (follow-up): add a `/api/admin/cron-health` endpoint or dashboard widget that surfaces `cron_state.daily_reset.lastRunAt` so parents can see it without MongoDB shell access.
