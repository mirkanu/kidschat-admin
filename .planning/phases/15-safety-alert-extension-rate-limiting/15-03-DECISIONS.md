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

**Status:** PENDING OPERATOR VERIFICATION

**Instructions:**
1. Open https://librechat-production-bff2.up.railway.app in an incognito window
2. Log in as Sebastian (sebastian.kuhs@kidschat.local / KidsChat2026!Sebastian)
3. Look at: sidebar, user menu, account/profile area, anywhere balance info might appear
4. Record one of:
   - `NATIVE_TOKEN_DISPLAY_VISIBLE: <exact text the kid sees — "Credits: X"? "$X.00"? progress bar? other?>`
   - `NATIVE_TOKEN_DISPLAY_HIDDEN: <describe where you looked>`
5. Check if any menu or settings toggle needs to be enabled for balance to appear
6. Save screenshot to `.planning/phases/15-safety-alert-extension-rate-limiting/15-03-balance-sidebar.png`
   OR describe what you see in text below

**Operator observation:**
_To be filled in — see instructions above_

<!-- Example outcomes:
NATIVE_TOKEN_DISPLAY_VISIBLE: "Credits: 1,000,000" shown in bottom-left sidebar under username
NATIVE_TOKEN_DISPLAY_HIDDEN: Checked sidebar, user menu, account settings — no balance widget visible
-->

---

## Locked Decisions for Plan 15-04

**Status:** PENDING — fill in after LibreChat balance UI verification above

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

native_balance_display: <operator fill in: visible | hidden | partial>
  # PENDING: Operator must log in as Sebastian and check sidebar

reset_crons_mechanism: railway.toml
  # Per user preference (Automate Railway feedback) — config-as-code preferred.
  # Daily reset: 0 0 * * *
  # Monthly reset: 0 0 1 * *

resumeToken_persistence: none
  # N/A: change streams not supported. Polling uses createdAt timestamp in balance_state.
  # balance_state.lastSeenAt (createdAt of last processed message) replaces resumeToken.
```

**DECIDED:** instrumentation.ts + 60s polling (messages by createdAt > lastSeen), with resetCrons via railway.toml

_Note: The above DECIDED line is pre-filled from empirical probe results for change_stream (NO) and instrumentation_hook (YES). Operator must confirm native_balance_display before this decision is fully locked. If native_balance_display=hidden and that changes the approach, update this section._

<!-- Operator: after LibreChat verification, confirm or update the DECIDED line above. Then type your approval signal to proceed to Plan 15-04. -->
