/**
 * POST /api/image-search/quota — Phase 21-02 (SEARCH-07)
 *
 * Called by the Openverse MCP (Plan 21-01) before every image search to enforce
 * the per-child daily count cap. The MCP passes the child's userId; we atomically
 * increment and check against the effective cap (child_override > global_defaults
 * > HARDCODED_DEFAULTS=20).
 *
 * Auth: shared secret via `x-quota-secret` header, constant-time compared against
 * CRON_SECRET. Same secret already used by /api/cron/* and /api/notify/*.
 *
 * Middleware: /api/image-search/quota is excluded from the session auth matcher
 * in src/middleware.ts (header-based auth, no session cookies).
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import getMongoClient from "@/lib/mongodb";
import { checkAndIncrementSearchCount } from "@/lib/image-search-quota";

export const dynamic = "force-dynamic";

function constantTimeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("x-quota-secret") ?? "";
  if (!secret || !constantTimeEq(header, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const client = await getMongoClient();
  // DB name MUST match the project-wide pattern used by sibling routes:
  //   /api/cron/daily-reset/route.ts and /api/notify/weekly-digest/route.ts
  // both use `client.db("test")` (Railway Mongo template default).
  // If that ever changes project-wide, this route migrates alongside them.
  const db = client.db("test");

  const result = await checkAndIncrementSearchCount(userId, db);

  // Structured log for OVERSIGHT + future Sentry/dead-man observability (Phase 999.1).
  console.log(
    JSON.stringify({
      event: "image_search.quota.check",
      userId,
      allowed: result.allowed,
      remaining: result.remaining,
    }),
  );

  return NextResponse.json(result);
}
