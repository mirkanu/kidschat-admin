/**
 * GET /api/health/crons
 *
 * Dead-man's switch: checks when each critical cron last ran.
 * Returns stale=true for any cron that hasn't run in >26 hours.
 *
 * No auth required — read-only, no sensitive data exposed.
 * Used by BetterStack uptime checks and manual debugging.
 */
import getMongoClient from "@/lib/mongodb";

const STALE_THRESHOLD_HOURS = 26;

interface CronEntry {
  key: string;
  lastRunAt?: Date;
  lastRunStats?: Record<string, unknown>;
}

interface CronStatus {
  lastRunAt: string | null;
  ageHours: number | null;
  stale: boolean;
}

const MONITORED_CRONS = ["daily_reset", "daily_summary"] as const;

export async function GET() {
  try {
    const client = await getMongoClient();
    const db = client.db("test");

    const rows = await db
      .collection<CronEntry>("cron_state")
      .find({ key: { $in: [...MONITORED_CRONS] } })
      .toArray();

    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    const now = Date.now();

    const crons: Record<string, CronStatus> = {};
    let allOk = true;

    for (const key of MONITORED_CRONS) {
      const row = byKey[key];
      if (!row?.lastRunAt) {
        crons[key] = { lastRunAt: null, ageHours: null, stale: true };
        allOk = false;
        continue;
      }
      const ageMs = now - new Date(row.lastRunAt).getTime();
      const ageHours = Math.round((ageMs / 3_600_000) * 10) / 10;
      const stale = ageHours > STALE_THRESHOLD_HOURS;
      if (stale) allOk = false;
      crons[key] = { lastRunAt: new Date(row.lastRunAt).toISOString(), ageHours, stale };
    }

    return Response.json(
      { ok: allOk, checkedAt: new Date().toISOString(), thresholdHours: STALE_THRESHOLD_HOURS, crons },
      { status: allOk ? 200 : 503 }
    );
  } catch (err) {
    console.error("[health/crons] MongoDB error:", err);
    return Response.json({ ok: false, error: "db_error" }, { status: 503 });
  }
}
