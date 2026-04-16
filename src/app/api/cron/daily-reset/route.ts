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
import { accumulateYesterdaySpend, topUpDailyBudget } from "@/lib/budget";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  // Fetch all non-admin users
  const users = await db
    .collection("users")
    .find({ role: { $ne: "ADMIN" } }, { projection: { _id: 1 } })
    .toArray();

  let reset = 0;
  let accumulated = 0;
  const errors: string[] = [];

  for (const user of users) {
    const userId = user._id.toString();
    try {
      const delta = await accumulateYesterdaySpend(userId, db);
      if (delta > 0) accumulated++;
      await topUpDailyBudget(userId, db);
      reset++;
    } catch (err) {
      console.error(`[daily-reset] Error resetting userId=${userId}:`, err);
      errors.push(userId);
    }
  }

  console.log(`[daily-reset] Completed: reset=${reset}, accumulated=${accumulated}, errors=${errors.length}`);

  // Phase 19 observability — record last successful run so silent cron failures are detectable.
  try {
    await db.collection("cron_state").updateOne(
      { key: "daily_reset" },
      {
        $set: {
          key: "daily_reset",
          lastRunAt: new Date(),
          lastRunStats: { reset, accumulated, errors: errors.length },
        },
      },
      { upsert: true }
    );
  } catch (err) {
    // Non-fatal — don't fail the cron if observability write fails.
    console.error("[daily-reset] Failed to write cron_state:", err);
  }

  return NextResponse.json({ reset, accumulated, errors });
}
