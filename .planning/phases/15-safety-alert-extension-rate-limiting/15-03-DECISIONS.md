# 15-03 Architectural Decisions

Phase 15.1 gap-closure probe results. These lock the architecture Plan 15-04 will follow.

---

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

---

## Instrumentation Hook Verification

**Next.js version:** ^15.5.14 (package.json)
**next.config.ts:** No `experimental.instrumentationHook` flag — correct. In Next 15, instrumentation.ts is enabled by default (the experimental flag was removed in Next 15; only needed in Next 14).

**Verification script:** `scripts/verify-instrumentation.ts` — contains full manual checklist for the operator.

**Outcome:** FIRED

`[INSTRUMENTATION-VERIFY] register() fired at 2026-04-10T19:05:48.594Z` appeared in stdout approximately 850ms after `next start` (within the "Starting..." phase, before "Ready").

**Test details:**
- Throwaway `src/instrumentation.ts` created with `register()` containing a console.log
- `npm run build` succeeded (standalone output build)
- `npm start` → `next start` fired `register()` at server startup
- Note: project uses `output: "standalone"` so production runs via `node .next/standalone/server.js`, but `next start` also works for local verification
- Throwaway `src/instrumentation.ts` deleted after test (not committed)

**Conclusion:** Plan 15-04 CAN use `src/instrumentation.ts` with `register()` for a background polling loop. No additional Railway service needed for the tick mechanism.
