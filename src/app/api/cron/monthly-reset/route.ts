/**
 * POST /api/cron/monthly-reset
 *
 * Plan 15-04 rewrite: Uses budget.ts topUpMonthlyBudget for all non-admin children.
 * Replaces the old ACL-unlock + unlockAllAccess approach with native tokenCredits.
 *
 * Schedule: 0 0 1 * * (1st of month UTC)
 * Auth: x-cron-secret header
 */
import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { topUpMonthlyBudget } from "@/lib/budget";

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
  const errors: string[] = [];

  for (const user of users) {
    const userId = user._id.toString();
    try {
      await topUpMonthlyBudget(userId, db);
      reset++;
    } catch (err) {
      console.error(`[monthly-reset] Error resetting userId=${userId}:`, err);
      errors.push(userId);
    }
  }

  console.log(`[monthly-reset] Completed: reset=${reset}, errors=${errors.length}`);
  return NextResponse.json({ reset, errors });
}
