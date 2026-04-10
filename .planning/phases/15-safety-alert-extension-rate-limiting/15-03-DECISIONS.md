

## Change Stream Probe

**Result:** ERROR
**Date:** 2026-04-10T19:01:22.634Z
**Error:** The $changeStream stage is only supported on replica sets
**Error code:** 40573
**Error codeName:** Location40573
**Change streams supported:** NO — replica set required

**Full error:**
```
The $changeStream stage is only supported on replica sets — Change streams require a MongoDB replica set. Railway may be running a standalone instance.
```

**Next step:** Plan 15-04 MUST use the /api/cron/tick fallback (1 cron service running every minute) since change streams are not available.
