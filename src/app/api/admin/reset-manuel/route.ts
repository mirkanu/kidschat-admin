/**
 * POST /api/admin/reset-manuel
 *
 * TEMPORARY endpoint — Phase 15.2 UAT only.
 * TODO: Delete this file after UAT is confirmed.
 *
 * Resets Manuel's balance and state for end-to-end testing of the
 * Option 7 system-prompt injection flow.
 *
 * Auth: x-cron-secret header (same pattern as cron routes).
 *
 * Usage:
 *   curl -X POST https://kidschat-admin-production.up.railway.app/api/admin/reset-manuel \
 *     -H "x-cron-secret: $CRON_SECRET"
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import getMongoClient from "@/lib/mongodb";
import { restoreAgentSystemPrompt } from "@/lib/bonus-delivery";

// €0.01 = ~10849 tokens at budget.ts eurToTokens rate (1 token = €0.0000009216)
const TARGET_EUR = 0.01;
const TARGET_TOKENS = Math.round(TARGET_EUR / 0.0000009216);

export async function POST(req: NextRequest) {
  // Auth guard (same as cron routes)
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await getMongoClient();
    const db = client.db("test");

    // 1. Find Manuel's user
    const usersCol = db.collection("users");
    const manuelUser = await usersCol.findOne({ name: /manuel/i } as Parameters<typeof usersCol.findOne>[0]);
    if (!manuelUser) {
      return NextResponse.json({ error: "Manuel user not found" }, { status: 404 });
    }

    const manuelUserId = manuelUser._id.toString();

    // 2. Set balance to €0.01 equivalent tokens
    const balancesCol = db.collection("balances");
    await balancesCol.updateOne(
      { user: new ObjectId(manuelUserId) },
      { $set: { tokenCredits: TARGET_TOKENS } },
      { upsert: true }
    );

    // 3. Clear balance_state
    const balanceStateCol = db.collection("balance_state");
    await balanceStateCol.updateOne(
      { userId: manuelUserId } as Parameters<typeof balanceStateCol.updateOne>[0],
      {
        $set: {
          warnedAt70PctOn: null,
          activeOfferMessageId: null,
          activeOfferExpiresAt: null,
          activeOfferConversationId: null,
          pendingWarning: null,
          originalAgentInstructions: null,
        },
      },
      { upsert: true }
    );

    // 4. Delete prior invisible synthetic messages
    const messagesCol = db.collection("messages");
    const deleteResult = await messagesCol.deleteMany({
      user: manuelUserId,
      sender: "KidsChat Friendly Tutor",
      isCreatedByUser: false,
    } as Parameters<typeof messagesCol.deleteMany>[0]);

    // 5. Force-restore agent instructions if any stuck pendingWarning
    await restoreAgentSystemPrompt({ userId: manuelUserId, db });

    // 6. Verify final state
    const finalBalance = await balancesCol.findOne(
      { user: new ObjectId(manuelUserId) }
    );

    return NextResponse.json({
      userId: manuelUserId,
      userName: manuelUser.name,
      tokenCreditsSet: finalBalance?.tokenCredits ?? null,
      eurEquivalent: TARGET_EUR,
      balanceStateCleared: true,
      syntheticsDeleted: deleteResult.deletedCount,
    });
  } catch (err) {
    console.error("[reset-manuel] Error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
