/**
 * POST /api/cron/daily-reset
 *
 * Runs at midnight UTC:
 * 1. Restores ACL entries for children locked by daily_image_cap or daily_message_cap
 * 2. Expires bonus_purchases where expiresAt < now (sets creditRemainingEUR: 0)
 *
 * Schedule: 0 0 * * * (midnight UTC)
 * Auth: x-cron-secret header
 */
import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { unlockImageAccess } from "@/lib/enforcement";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  // Find unique userIds with daily image/message cap locks
  const lockedEntries = await db
    .collection("locked_acl_entries")
    .find({ lockReason: { $in: ["daily_image_cap", "daily_message_cap"] } })
    .toArray();

  const usersByReason = new Map<string, Set<string>>();
  for (const entry of lockedEntries) {
    const userId = entry.principalId as string;
    const reason = entry.lockReason as string;
    if (!usersByReason.has(reason)) {
      usersByReason.set(reason, new Set());
    }
    usersByReason.get(reason)!.add(userId);
  }

  let unlocked = 0;

  for (const [reason, userIds] of usersByReason.entries()) {
    for (const userId of userIds) {
      try {
        await unlockImageAccess(userId, db, reason as "daily_image_cap" | "daily_message_cap");
        unlocked++;
      } catch (err) {
        console.error(`[daily-reset] Error unlocking ${userId} for ${reason}:`, err);
      }
    }
  }

  // Also clear awaitingBonusConfirmation states (daily reset clears pending offers)
  await db.collection("settings").updateMany(
    { awaitingBonusConfirmation: true } as Parameters<ReturnType<typeof db.collection>["updateMany"]>[0],
    {
      $unset: {
        awaitingBonusConfirmation: "",
        confirmationOfferedAt: "",
        lockType: "",
        activeConversationId: "",
      },
    }
  );

  // Expire bonus_purchases where expiresAt < now
  const now = new Date();
  await db.collection("bonus_purchases").updateMany(
    { expiresAt: { $lt: now }, creditRemainingEUR: { $gt: 0 } },
    { $set: { creditRemainingEUR: 0 } }
  );

  return NextResponse.json({ unlocked });
}
