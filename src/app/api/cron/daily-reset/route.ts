/**
 * POST /api/cron/daily-reset
 *
 * Plan 15-04 rewrite: Uses budget.ts topUpDailyBudget for all non-admin children.
 * Replaces the old ACL-unlock approach with LibreChat-native tokenCredits top-up.
 *
 * Schedule: 0 0 * * * (midnight UTC)
 * Auth: x-cron-secret header
 */
import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { accumulateYesterdaySpend, topUpAdminBudget, topUpDailyBudget } from "@/lib/budget";
import { resetAllSearchCounters } from "@/lib/image-search-quota";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  // Fetch ALL users (kids + admins); branch on role inside the loop.
  const users = await db
    .collection("users")
    .find({}, { projection: { _id: 1, role: 1 } })
    .toArray();

  let reset = 0;
  let accumulated = 0;
  let admins_refilled = 0;
  const errors: string[] = [];

  for (const user of users) {
    const userId = user._id.toString();
    try {
      if (user.role === "ADMIN") {
        // Parents: flat $max-to-1M refill. No monthly cap tracking, no accumulation.
        await topUpAdminBudget(userId, db);
        admins_refilled++;
      } else {
        // Kids: accumulate yesterday's spend into monthlySpendEur, then $max-to-dailyCap.
        const delta = await accumulateYesterdaySpend(userId, db);
        if (delta > 0) accumulated++;
        await topUpDailyBudget(userId, db);
        reset++;
      }
    } catch (err) {
      console.error(`[daily-reset] Error resetting userId=${userId} role=${user.role}:`, err);
      errors.push(userId);
    }
  }

  // Phase 21-02: wipe per-child Openverse search counters after the user loop.
  // Collection key is {userId, utcDay} so deleteMany is equivalent to counter=0 for today.
  let search_counters_reset = 0;
  try {
    search_counters_reset = await resetAllSearchCounters(db);
  } catch (err) {
    console.error("[daily-reset] Failed to reset search_counters:", err);
  }

  console.log(`[daily-reset] Completed: reset=${reset}, accumulated=${accumulated}, admins_refilled=${admins_refilled}, search_counters_reset=${search_counters_reset}, errors=${errors.length}`);

  // Phase 19 observability — record last successful run so silent cron failures are detectable.
  try {
    await db.collection("cron_state").updateOne(
      { key: "daily_reset" },
      {
        $set: {
          key: "daily_reset",
          lastRunAt: new Date(),
          lastRunStats: { reset, accumulated, admins_refilled, search_counters_reset, errors: errors.length },
        },
      },
      { upsert: true }
    );
  } catch (err) {
    // Non-fatal — don't fail the cron if observability write fails.
    console.error("[daily-reset] Failed to write cron_state:", err);
  }

  return NextResponse.json({ reset, accumulated, admins_refilled, search_counters_reset, errors });
}
