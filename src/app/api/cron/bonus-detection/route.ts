/**
 * POST /api/cron/bonus-detection
 *
 * Reads all pending bonus confirmations from the settings collection,
 * checks for YES replies, and credits the bonus if confirmed.
 *
 * Schedule: every 1 minute
 * Auth: x-cron-secret header
 */
import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { detectBonusConfirmation, applyBonusCredit } from "@/lib/bonus-delivery";
import type { PendingState } from "@/lib/bonus-delivery";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  // Find all docs with awaitingBonusConfirmation: true
  const pending = await db
    .collection("settings")
    .find({ awaitingBonusConfirmation: true })
    .toArray();

  let confirmed = 0;
  let expired = 0;

  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  for (const doc of pending) {
    const userId = (doc._id as string).replace("override_", "");
    const pendingState: PendingState = {
      awaitingBonusConfirmation: true,
      confirmationOfferedAt: doc.confirmationOfferedAt as Date,
      lockType: doc.lockType as "image_cap" | "monthly_cap",
      activeConversationId: doc.activeConversationId as string,
    };

    // Check if window has expired
    const offeredAt = doc.confirmationOfferedAt as Date | undefined;
    if (!offeredAt || Date.now() - offeredAt.getTime() > FIVE_MINUTES_MS) {
      // Expired — clear the pending state
      await db.collection("settings").updateOne(
        { _id: doc._id } as Parameters<ReturnType<typeof db.collection>["updateOne"]>[0],
        {
          $unset: {
            awaitingBonusConfirmation: "",
            confirmationOfferedAt: "",
            lockType: "",
            activeConversationId: "",
          },
        }
      );
      expired++;
      continue;
    }

    try {
      const didConfirm = await detectBonusConfirmation(userId, pendingState, db);
      if (didConfirm) {
        // Find the YES message to get its messageId
        const now = new Date();
        const expiryTime = new Date(offeredAt.getTime() + FIVE_MINUTES_MS);
        const yesMessage = await db.collection("messages").findOne({
          user: userId,
          conversationId: doc.activeConversationId,
          isCreatedByUser: true,
          createdAt: { $gte: offeredAt, $lte: expiryTime },
          text: { $regex: /^\s*yes\.?\s*$/i },
        } as Parameters<ReturnType<typeof db.collection>["findOne"]>[0]);

        const pendingWithMsg: PendingState = {
          ...pendingState,
          confirmedViaMessageId: (yesMessage?.messageId as string | undefined) ?? now.toISOString(),
          packSizeEUR: doc.packSizeEUR as number | undefined,
        };

        await applyBonusCredit(userId, pendingWithMsg, db);
        confirmed++;
      }
    } catch (err) {
      console.error(`[bonus-detection] Error processing bonus for user ${userId}:`, err);
    }
  }

  return NextResponse.json({ confirmed, expired });
}
