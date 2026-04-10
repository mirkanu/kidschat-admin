/**
 * POST /api/cron/monthly-reset
 *
 * Runs on the 1st of the month UTC:
 * 1. Finds children with tokenCredits: 0 (hard-locked by monthly cap)
 * 2. Restores their balance and ACL entries
 * 3. Clears monthly_cost_cap locked ACL entries
 *
 * Schedule: 0 0 1 * * (1st of month UTC)
 * Auth: x-cron-secret header
 */
import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { unlockAllAccess } from "@/lib/enforcement";
import { getEffectiveLimits } from "@/lib/settings";

const EUR_RATE = parseFloat(process.env.USD_TO_EUR_RATE ?? "0.92");
const TOKEN_CREDIT_PER_EUR = 1_000_000; // 1M credits per EUR

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  // Find children with tokenCredits: 0 (hard-locked)
  const hardLockedBalances = await db
    .collection("balances")
    .find({ tokenCredits: 0 })
    .toArray();

  let restored = 0;

  for (const balance of hardLockedBalances) {
    const userId = balance.user as string;
    if (!userId) continue;

    try {
      // Get effective limits to determine the restore amount
      const limits = await getEffectiveLimits(userId, db);

      // Convert monthly cost cap to token credits
      // monthlyCostCapEUR / EUR_RATE = USD value, * TOKEN_CREDIT_PER_EUR = credits
      const startBalanceCredits = Math.floor(
        (limits.monthlyCostCapEUR / EUR_RATE) * TOKEN_CREDIT_PER_EUR
      );

      await unlockAllAccess(userId, db, startBalanceCredits);
      restored++;
    } catch (err) {
      console.error(`[monthly-reset] Error restoring access for user ${userId}:`, err);
    }
  }

  // Also restore children locked by monthly_cost_cap in locked_acl_entries but NOT hard-locked via balance
  const monthlyLockedEntries = await db
    .collection("locked_acl_entries")
    .find({ lockReason: "monthly_cost_cap" })
    .toArray();

  const additionalUsers = new Set<string>();
  for (const entry of monthlyLockedEntries) {
    const userId = entry.principalId as string;
    const alreadyRestored = hardLockedBalances.some((b) => (b.user as string) === userId);
    if (!alreadyRestored) {
      additionalUsers.add(userId);
    }
  }

  for (const userId of additionalUsers) {
    try {
      const limits = await getEffectiveLimits(userId, db);
      const startBalanceCredits = Math.floor(
        (limits.monthlyCostCapEUR / EUR_RATE) * TOKEN_CREDIT_PER_EUR
      );
      await unlockAllAccess(userId, db, startBalanceCredits);
      restored++;
    } catch (err) {
      console.error(`[monthly-reset] Error restoring additional user ${userId}:`, err);
    }
  }

  return NextResponse.json({ restored });
}
