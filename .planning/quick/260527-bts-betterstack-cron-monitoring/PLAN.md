---
quick_id: 260527-bts
slug: betterstack-cron-monitoring
date: 2026-05-27
status: in-progress
description: Add BetterStack heartbeat dead-man's switch for KidAI crons
---

# BetterStack Cron Monitoring

## Goal

Wire BetterStack heartbeat pings into the two critical daily crons so silence = alert.
Also add `/api/health/crons` for internal visibility.

## BetterStack Monitors Created

| Cron | Monitor ID | Ping URL | Interval |
|------|-----------|----------|----------|
| daily-reset | 462557 | https://uptime.betterstack.com/api/v1/heartbeat/vfw99vjZFqa3eKjNdzSF82ot | 24h + 1h grace |
| daily-summary | 462558 | https://uptime.betterstack.com/api/v1/heartbeat/wFsmTpyiyq6py9ukVVweHRyA | 24h + 1h grace |

## Tasks

### Task 1: Add env vars to .env.production and docker-compose.yml

Add to `/home/services/.env.production`:
```
BETTERSTACK_HEARTBEAT_DAILY_RESET=https://uptime.betterstack.com/api/v1/heartbeat/vfw99vjZFqa3eKjNdzSF82ot
BETTERSTACK_HEARTBEAT_DAILY_SUMMARY=https://uptime.betterstack.com/api/v1/heartbeat/wFsmTpyiyq6py9ukVVweHRyA
```

Add to `kidai-admin` container in `/home/services/hetzner-vps/docker-compose.yml` environment section:
```
- BETTERSTACK_HEARTBEAT_DAILY_RESET=${BETTERSTACK_HEARTBEAT_DAILY_RESET}
- BETTERSTACK_HEARTBEAT_DAILY_SUMMARY=${BETTERSTACK_HEARTBEAT_DAILY_SUMMARY}
```

### Task 2: Wire daily-reset cron to ping BetterStack on success

In `src/app/api/cron/daily-reset/route.ts`, after the cron_state write, add:
```typescript
// Ping BetterStack heartbeat on successful completion
const heartbeatUrl = process.env.BETTERSTACK_HEARTBEAT_DAILY_RESET;
if (heartbeatUrl) {
  await fetch(heartbeatUrl).catch((err) =>
    console.warn("[daily-reset] BetterStack ping failed:", err)
  );
}
```

### Task 3: Wire daily-summary cron to ping BetterStack + write cron_state

In `src/app/api/notify/daily-summary/route.ts`:
1. Write to `cron_state` collection with `{ key: "daily_summary", lastRunAt: new Date() }` at the end of a successful run
2. Ping BetterStack heartbeat URL

### Task 4: Add /api/health/crons endpoint

Create `src/app/api/health/crons/route.ts`:
- Query `cron_state` for `daily_reset` and `daily_summary` keys
- Return JSON: `{ ok: boolean, crons: { [key]: { lastRunAt, ageHours, stale } } }`
- Mark stale if `lastRunAt` is > 26h ago (or never ran)
- No auth required (read-only, no sensitive data)

### Task 5: Commit + redeploy

```bash
git add -A
git commit -m "feat(monitoring): BetterStack heartbeat dead-man's switch for daily crons"
cd /home/services/hetzner-vps && docker compose up --build -d kidai-admin
```
