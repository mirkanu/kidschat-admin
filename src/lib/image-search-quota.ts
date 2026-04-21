/**
 * Phase 21-02 — Per-child daily Openverse image-search counter.
 *
 * Collection: search_counters (keyed by {userId, utcDay})
 * Called by /api/image-search/quota (from the Openverse MCP, Plan 21-01).
 * Reset nightly by /api/cron/daily-reset at 00:00 UTC.
 *
 * Cap resolution: getEffectiveSearchCap (child_override > global_defaults > HARDCODED_DEFAULTS=20).
 *
 * Race-safety: atomic $inc via findOneAndUpdate returns post-increment value.
 * If post > cap we roll back with $inc: -1 so two concurrent calls can't both
 * squeeze past the cap.
 */
import { type Db } from "mongodb";
import { getEffectiveSearchCap, todayIso } from "./budget";

interface SearchCounterDoc {
  userId: string;
  utcDay: string; // "YYYY-MM-DD"
  count: number;
}

export async function checkAndIncrementSearchCount(
  userId: string,
  db: Db,
): Promise<{ allowed: boolean; remaining: number }> {
  const cap = await getEffectiveSearchCap(userId, db);
  const utcDay = todayIso();
  const col = db.collection<SearchCounterDoc>("search_counters");

  const result = await col.findOneAndUpdate(
    { userId, utcDay } as Parameters<typeof col.findOneAndUpdate>[0],
    {
      $inc: { count: 1 },
      $setOnInsert: { userId, utcDay },
    },
    { upsert: true, returnDocument: "after" },
  );

  // Post-increment count. Different driver versions return the doc directly or
  // under a `value` property — handle both defensively.
  const post =
    (result as { count?: number } | null)?.count ??
    (result as { value?: { count?: number } } | null)?.value?.count ??
    1;

  if (post > cap) {
    await col.updateOne(
      { userId, utcDay } as Parameters<typeof col.updateOne>[0],
      { $inc: { count: -1 } },
    );
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: Math.max(0, cap - post) };
}

export async function getSearchCounter(userId: string, db: Db): Promise<number> {
  const col = db.collection<SearchCounterDoc>("search_counters");
  const doc = await col.findOne({
    userId,
    utcDay: todayIso(),
  } as Parameters<typeof col.findOne>[0]);
  return doc?.count ?? 0;
}

export async function resetAllSearchCounters(db: Db): Promise<number> {
  const r = await db.collection("search_counters").deleteMany({});
  return r.deletedCount ?? 0;
}
