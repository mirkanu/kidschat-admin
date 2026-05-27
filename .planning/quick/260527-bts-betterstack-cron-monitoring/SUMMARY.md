---
quick_id: 260527-bts
slug: betterstack-cron-monitoring
date: 2026-05-27
status: complete
commit: 597f635
---

# Summary

Wired BetterStack dead-man's switch for both critical daily crons.

## What was done

1. **Created BetterStack heartbeat monitors** via API:
   - `KidAI — daily-reset cron` (id 462557, 24h + 1h grace)
   - `KidAI — daily-summary cron` (id 462558, 24h + 1h grace)

2. **Wired daily-reset cron** (`/api/cron/daily-reset`) — pings heartbeat URL on success

3. **Wired daily-summary cron** (`/api/notify/daily-summary`) — pings heartbeat URL on success; also added missing `cron_state` write (was never tracked before)

4. **Added `/api/health/crons` endpoint** — queries MongoDB `cron_state` for both crons, returns `stale: true` + HTTP 503 if any cron hasn't run in >26h

5. **Created BetterStack uptime monitor** (id 4458644) on `/api/health/crons` — checks every 5 min, alerts if HTTP 503

6. **Added env vars** to `.env.production` and `docker-compose.yml`; redeployed container

## Verification

- `/api/health/crons` returns live JSON: `{"ok":false,...}` — correctly shows daily_reset as stale (hasn't run since May 21) and daily_summary as null (cron_state write just added)
- Both BETTERSTACK_HEARTBEAT_* vars confirmed in running container via `docker exec kidai-admin env`
- After next midnight UTC run, BetterStack heartbeats will go green

## How it prevents the April incident

The April crash (daily-reset + daily-summary both silently stopped for days) would now be caught:
- Heartbeats: BetterStack emails if cron doesn't ping within 25h
- Health endpoint: returns 503 after 26h, triggering the uptime monitor alert
