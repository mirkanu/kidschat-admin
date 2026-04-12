/**
 * POST /api/cron/archive-deleted
 *
 * Phase 17-01: Conversation delete protection — periodic archive cron.
 *
 * Snapshots all conversations + messages into archive collections so that
 * conversations hard-deleted by a child in LibreChat are still visible to
 * parents in the admin dashboard.
 *
 * Schedule: every 5 minutes (*/5 * * * *) via railway.toml
 * Auth: x-cron-secret header (same pattern as daily-reset / monthly-reset)
 */

import { NextRequest, NextResponse } from "next/server";
import { archiveConversations } from "@/lib/archive-conversations";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");

  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await archiveConversations();
    console.log("[archive-deleted] Cron completed:", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[archive-deleted] Cron error:", err);
    return NextResponse.json(
      { error: "Archive failed", detail: String(err) },
      { status: 500 }
    );
  }
}
