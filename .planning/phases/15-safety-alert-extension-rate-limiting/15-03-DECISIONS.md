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

---

## LibreChat Balance UI

**Status:** CONFIRMED VISIBLE

**Date verified:** 2026-04-10

**Operator observation:**
`NATIVE_TOKEN_DISPLAY_VISIBLE: "Balance: 10,000,000"` — Sebastian (test child account) sees this value in LibreChat's Settings page. LibreChat's native balance display IS enabled and rendered for children.

**Implication for Plan 15-05:**
Plan 15-05 does NOT need to build a kid-facing usage UI from scratch. It can rely on LibreChat's native display for the numeric balance, and supplement with 70% warning synthetic messages for proactive alerts ("You've used 70% of your daily allowance — keep going!"). The native display surfaces the raw token number; the synthetic message layer adds human-readable context when thresholds are approaching.

---

## Locked Decisions for Plan 15-04

**Status:** LOCKED — all three probes complete, operator approved

```
change_stream: no
  # CONFIRMED: Railway MongoDB is standalone (not replica set). Error code 40573.
  # Change streams NOT supported.

instrumentation_hook: yes
  # CONFIRMED: register() fires in < 1s after next start. FIRED at 2026-04-10T19:05:48.594Z.

approach:
  # change_stream=no AND instrumentation_hook=yes →
  # instrumentation.ts running a 60s setInterval that polls messages by createdAt > lastSeen
  # No new Railway service needed. All logic runs inside the admin Next.js process.
  # NOTE: The original Path B (/api/cron/tick HTTP endpoint) is superseded — the setInterval
  # runs in-process, requires no CRON_SECRET, and has no HTTP hop overhead.

native_balance_display: visible
  # CONFIRMED: "Balance: 10,000,000" visible in LibreChat Settings page for Sebastian.
  # Plan 15-05 can rely on native display for numeric balance; add synthetic threshold messages
  # for proactive human-readable alerts at 70% usage.

reset_crons_mechanism: railway.toml
  # Per user preference (Automate Railway feedback) — config-as-code preferred.
  # Daily reset as cron service: 0 0 * * *
  # Monthly reset as cron service: 0 0 1 * *

resumeToken_persistence: none
  # N/A: change streams not supported. Polling uses createdAt timestamp in balance_state.
  # balance_state.lastSeenAt (createdAt of last processed message) replaces resumeToken.
```

**DECIDED:** instrumentation.ts + 60s setInterval polling (messages.createdAt > balance_state.lastSeenAt), runs inside the admin Next.js process. Daily and monthly reset crons ship via railway.toml as separate Railway cron services. No new Railway services for the polling tick loop. No CRON_SECRET needed for polling.
