/**
 * scripts/reset-manuel-15-2.ts
 *
 * Idempotent reset script for Phase 15.2 UAT.
 * Resets Manuel's balance and state so he can trigger the 70% warning and
 * bonus offer flow in a controlled end-to-end test.
 *
 * Can be run in two ways:
 * 1. Via the temporary API route:
 *    curl -X POST https://kidschat-admin-production.up.railway.app/api/admin/reset-manuel \
 *      -H "x-cron-secret: $CRON_SECRET"
 *
 * 2. Locally (if MONGODB_URI is available):
 *    MONGODB_URI=<uri> npx tsx scripts/reset-manuel-15-2.ts
 *
 * What this script does:
 * 1. Finds Manuel's user doc by name pattern /manuel/i
 * 2. Sets balances.tokenCredits to €0.01 equivalent (~10870 tokens)
 * 3. Clears balance_state fields: warnedAt70PctOn, activeOfferMessageId,
 *    activeOfferExpiresAt, activeOfferConversationId, pendingWarning,
 *    originalAgentInstructions
 * 4. Deletes prior invisible synthetic messages from Manuel's conversations
 *    (where sender = "KidsChat Friendly Tutor" and isCreatedByUser = false)
 * 5. Force-restores the Friendly Tutor agent's instructions if any prior
 *    pendingWarning is stuck (safety)
 * 6. Returns a JSON summary of what was done
 */

import { MongoClient, ObjectId } from "mongodb";
import { restoreAgentSystemPrompt } from "../src/lib/bonus-delivery";

// €0.01 = 10870 tokens (at $0.000001/token input rate, €1 ≈ $1.08, €0.01 ≈ $0.0108 ≈ 10800 tokens)
// Using the same formula as budget.ts: tokens = EUR / 0.0000009216 * 100 = EUR * 1,085,069
// Simpler: use 10870 which is what budget.ts eurToTokens(0.01) produces
const TARGET_EUR = 0.01;
// From budget.ts tokensToEur: 1 token = €0.0000009216 (weighted avg input/output)
// eurToTokens = eur / 0.0000009216 = 10,850 for €0.01
const TARGET_TOKENS = Math.round(TARGET_EUR / 0.0000009216); // ≈ 10849

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI environment variable is not set.");
  process.exit(1);
}

async function resetManuel() {
  console.log("[reset-manuel] Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db("test");

  // 1. Find Manuel's user
  const usersCol = db.collection("users");
  const manuelUser = await usersCol.findOne({ name: /manuel/i });
  if (!manuelUser) {
    console.error("[reset-manuel] ERROR: Manuel user not found.");
    await client.close();
    process.exit(1);
  }

  const manuelUserId = manuelUser._id.toString();
  console.log(`[reset-manuel] Found Manuel: userId=${manuelUserId}, name=${manuelUser.name}`);

  // 2. Set balance to €0.01 equivalent tokens
  const balancesCol = db.collection("balances");
  await balancesCol.updateOne(
    { user: new ObjectId(manuelUserId) },
    { $set: { tokenCredits: TARGET_TOKENS } },
    { upsert: true }
  );
  console.log(`[reset-manuel] Set tokenCredits = ${TARGET_TOKENS} (€${TARGET_EUR})`);

  // 3. Clear balance_state
  const balanceStateCol = db.collection("balance_state");
  await balanceStateCol.updateOne(
    { userId: manuelUserId },
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
  console.log("[reset-manuel] Cleared balance_state");

  // 4. Delete prior invisible synthetic messages from Manuel's conversations
  const messagesCol = db.collection("messages");
  const deleteResult = await messagesCol.deleteMany({
    user: manuelUserId,
    sender: "KidsChat Friendly Tutor",
    isCreatedByUser: false,
  });
  console.log(`[reset-manuel] Deleted ${deleteResult.deletedCount} prior synthetic messages`);

  // 5. Force-restore agent instructions if any stuck pendingWarning
  await restoreAgentSystemPrompt({ userId: manuelUserId, db });
  console.log("[reset-manuel] Agent instructions restore check complete (no-op if clean)");

  // 6. Verify the final state
  const finalBalance = await balancesCol.findOne({ user: new ObjectId(manuelUserId) });
  const finalState = await balanceStateCol.findOne({ userId: manuelUserId });

  const summary = {
    userId: manuelUserId,
    userName: manuelUser.name,
    tokenCreditsSet: finalBalance?.tokenCredits ?? null,
    eurEquivalent: TARGET_EUR,
    balanceStateCleared: !finalState?.pendingWarning && !finalState?.originalAgentInstructions,
    syntheticsDeleted: deleteResult.deletedCount,
  };

  console.log("[reset-manuel] Summary:", JSON.stringify(summary, null, 2));

  await client.close();
  return summary;
}

resetManuel().catch((err) => {
  console.error("[reset-manuel] Fatal error:", err);
  process.exit(1);
});
