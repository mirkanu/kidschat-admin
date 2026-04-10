/**
 * scripts/verify-instrumentation.ts
 *
 * Documentation + checklist script for verifying that Next.js 15 instrumentation.ts
 * fires register() on `next start` in the current build setup.
 *
 * THIS IS NOT A TEST RUNNER. It's a self-contained guide the operator follows manually.
 *
 * =============================================================================
 * BACKGROUND
 * =============================================================================
 *
 * Next.js 15 (stable) supports src/instrumentation.ts out of the box.
 * - No experimental flag needed (removed in Next 15; was `experimental.instrumentationHook` in Next 14)
 * - The `register()` export runs ONCE on server startup in the Node.js runtime
 * - Useful for: starting background workers, opening DB connections, initializing SDKs
 *
 * Plan 15-04 wants to put either a polling loop OR a short-lived cron handler inside
 * instrumentation.ts. This test confirms it actually fires in our build setup before
 * we commit architectural code to it.
 *
 * =============================================================================
 * PROJECT FINDINGS (recorded 2026-04-10)
 * =============================================================================
 *
 * Next.js version: ^15.5.14 (confirmed from package.json)
 * next.config.ts: No `experimental.instrumentationHook` flag present — correct for Next 15
 *   (in Next 15, instrumentationHook is enabled by default; the flag is only needed in Next 14)
 *
 * =============================================================================
 * MANUAL VERIFICATION STEPS
 * =============================================================================
 *
 * Step 1: Create a throwaway src/instrumentation.ts
 *
 *   Create the file /data/home/KidAI/src/instrumentation.ts with this exact content:
 *
 *   ─────────────────────────────────────────────────────────────────────────────
 *   export async function register() {
 *     if (process.env.NEXT_RUNTIME === "nodejs") {
 *       console.log(
 *         "[INSTRUMENTATION-VERIFY] register() fired at",
 *         new Date().toISOString()
 *       );
 *     }
 *   }
 *   ─────────────────────────────────────────────────────────────────────────────
 *
 *   IMPORTANT: This is a THROWAWAY test file. Do NOT commit it. It will be deleted
 *   in Step 4. Plan 15-04 will create the real instrumentation.ts with actual logic.
 *
 * Step 2: Build and start the app locally
 *
 *   Run in /data/home/KidAI:
 *
 *     npm run build && npm start
 *
 *   OR if the project uses a custom start command:
 *
 *     npx next build && npx next start
 *
 *   Wait for the server to start. You'll see something like:
 *     ✓ Ready in X.Xs
 *     ○ Starting...
 *
 * Step 3: Look for the instrumentation log line
 *
 *   Within 5 seconds of `next start` completing, scan the terminal output for:
 *
 *     [INSTRUMENTATION-VERIFY] register() fired at <ISO timestamp>
 *
 *   SUCCESS CRITERION: This line appears in stdout.
 *
 *   Note: The line may appear BEFORE "Ready in Xs" on some Next.js versions —
 *   scroll up in the terminal after startup completes to check.
 *
 * Step 4: Revert the throwaway file
 *
 *   CRITICAL: Delete or revert the throwaway instrumentation.ts so it doesn't
 *   interfere with Plan 15-04:
 *
 *     git checkout HEAD -- src/instrumentation.ts
 *
 *   If the file is untracked (new file), delete it:
 *
 *     rm src/instrumentation.ts
 *
 * Step 5: Record the outcome in 15-03-DECISIONS.md
 *
 *   Open .planning/phases/15-safety-alert-extension-rate-limiting/15-03-DECISIONS.md
 *   and fill in the ## Instrumentation Hook Verification section with one of:
 *
 *   FIRED: The line "[INSTRUMENTATION-VERIFY] register() fired at <ISO>" appeared
 *          in stdout within 5 seconds of next start.
 *          → Plan 15-04 CAN use instrumentation.ts for background worker.
 *
 *   NOT-FIRED: The line did NOT appear in stdout even though next start completed.
 *              → Plan 15-04 must use /api/cron/tick every 1 min instead.
 *
 *   ERROR: Build failed or server crashed.
 *          → Investigate, record the error message.
 *
 * =============================================================================
 * DECISION IMPACT (from 15.1-CONTEXT.md)
 * =============================================================================
 *
 * If instrumentation.ts FIRES:
 *   Plan 15-04 puts a setInterval (60s) inside register() that polls
 *   messages collection for new child inserts since last seen timestamp.
 *   No new Railway service needed.
 *
 * If instrumentation.ts does NOT fire:
 *   Plan 15-04 creates 1 new Railway cron service calling /api/cron/tick
 *   every minute. The tick handler polls messages by createdAt > lastSeen.
 *   Requires creating 1 new Railway service.
 *
 * NOTE: Change streams are already confirmed NOT available on this Railway MongoDB
 * instance (standalone, not replica set — recorded in ## Change Stream Probe).
 * So the approach is: instrumentation.ts polling OR /api/cron/tick polling.
 * The question here is purely about which trigger mechanism works.
 */

// This script is documentation-only. There is no executable code below.
// The operator follows the steps above and records the outcome manually.
export {};
