/**
 * Next.js 15 instrumentation hook — Plan 15-04.
 *
 * register() fires once at server startup (before "Ready").
 * Boots the in-process polling loop that monitors kid messages for:
 * - 70% daily budget warnings
 * - Bonus offer trigger (when credits hit 0)
 * - YES confirmation detection
 *
 * Architecture: instrumentation.ts + 60s setInterval polling
 * (locked by 15-03-DECISIONS.md — Railway MongoDB is standalone, no change streams)
 *
 * Guard: only runs in the Node.js runtime (not edge/workers).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Only run in production or when explicitly enabled in development
  if (process.env.NODE_ENV === "development" && process.env.ENABLE_LISTENER !== "true") {
    console.log("[instrumentation] Polling listener disabled in development (set ENABLE_LISTENER=true to enable)");
    return;
  }

  // Use dynamic import with webpackIgnore to prevent webpack from bundling
  // the MongoDB-dependent change-stream-listener module.
  // The NEXT_RUNTIME guard ensures this only runs server-side.
  try {
    const listenerModule = await import(
      /* webpackIgnore: true */
      "./lib/change-stream-listener"
    );
    const { startChangeStreamListener } = listenerModule as {
      startChangeStreamListener: () => Promise<void>;
    };
    startChangeStreamListener().catch((err: unknown) => {
      console.error("[instrumentation] change stream listener failed:", err);
    });
    console.log("[instrumentation] register() fired — polling listener started");
  } catch (err) {
    console.error("[instrumentation] Failed to start change stream listener:", err);
  }
}
