/**
 * Bonus delivery lib — Phase 15 "YES" bonus purchase flow.
 *
 * Implements:
 * - sendBonusOfferMessage: inserts a bonus offer into the messages collection
 * - detectBonusConfirmation: checks if child typed "YES" within 5 min
 * - applyBonusCredit: credits the bonus and unlocks access
 *
 * Field names from 15-00-MONGO-INSPECTION.md:
 *   messages: messageId, user, conversationId, isCreatedByUser, text, endpoint, agent_id, etc.
 *   conversations: conversationId (UUID), user, updatedAt
 */

import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { getWeeklyBonusSpend, getStartOfWeekUTC } from "@/lib/bonus-purchases";
import { unlockImageAccess, unlockAllAccess } from "@/lib/enforcement";

const EUR_RATE = parseFloat(process.env.USD_TO_EUR_RATE ?? "0.92");
const TOKEN_CREDIT_PER_EUR = 1_000_000; // 1M credits per EUR

export interface PendingState {
  awaitingBonusConfirmation?: boolean;
  confirmationOfferedAt?: Date;
  lockType?: "image_cap" | "monthly_cap";
  activeConversationId?: string;
  packSizeEUR?: number;
  confirmedViaMessageId?: string;
}

/**
 * Inserts a bonus offer message into the messages collection.
 * Pattern 8: direct MongoDB insert (confirmed viable by synthetic probe in 15-00).
 * Also updates conversations.updatedAt to trigger UI refresh (Pitfall 6).
 *
 * Returns the messageId of the inserted message.
 */
export async function sendBonusOfferMessage(args: {
  userId: string;
  conversationId: string;
  agentId: string;
  template: string;
  db: Db;
}): Promise<string> {
  const { userId, conversationId, agentId, template, db } = args;

  const messageId = new ObjectId().toString();
  const now = new Date();

  const messageDoc = {
    messageId,
    user: userId,
    conversationId,
    isCreatedByUser: false,
    text: template,
    endpoint: "agents",
    agent_id: agentId,
    sender: "Assistant",
    model: "agents",
    error: false,
    unfinished: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("messages").insertOne(messageDoc);

  // Update conversations.updatedAt to trigger LibreChat UI refresh (Pitfall 6)
  await db.collection("conversations").updateOne(
    { conversationId } as Parameters<ReturnType<Db["collection"]>["updateOne"]>[0],
    { $set: { updatedAt: now } }
  );

  return messageId;
}

/**
 * Checks if the child typed "YES" in their conversation within 5 minutes of the offer.
 * Uses a strict regex: /^\s*yes\.?\s*$/i to match "yes", "YES", "yes."
 *
 * Returns true if a matching message is found within the 5-minute window.
 */
export async function detectBonusConfirmation(
  userId: string,
  pending: PendingState,
  db: Db
): Promise<boolean> {
  const { confirmationOfferedAt, activeConversationId } = pending;
  if (!confirmationOfferedAt || !activeConversationId) return false;

  const now = new Date();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  // Check if the 5-minute window has elapsed
  if (now.getTime() - confirmationOfferedAt.getTime() > FIVE_MINUTES_MS) {
    return false;
  }

  const expiryTime = new Date(confirmationOfferedAt.getTime() + FIVE_MINUTES_MS);

  // Look for a "YES" message from the user in the active conversation since the offer
  const yesMessage = await db.collection("messages").findOne({
    user: userId,
    conversationId: activeConversationId,
    isCreatedByUser: true,
    createdAt: { $gte: confirmationOfferedAt, $lte: expiryTime },
    text: { $regex: /^\s*yes\.?\s*$/i },
  } as Parameters<ReturnType<Db["collection"]>["findOne"]>[0]);

  return yesMessage !== null;
}

/**
 * Credits the bonus pack and unlocks access.
 * - Checks the weekly bonus cap before proceeding
 * - Inserts a bonus_purchases record
 * - Unlocks image access (for image_cap) or adds tokenCredits (for monthly_cap)
 * - Clears the awaiting confirmation state in settings
 */
export async function applyBonusCredit(userId: string, pending: PendingState, db: Db): Promise<void> {
  const { lockType, confirmedViaMessageId, packSizeEUR: pendingPackSize } = pending;

  if (!lockType || !confirmedViaMessageId) {
    throw new Error("Invalid pending state: missing lockType or confirmedViaMessageId");
  }

  // Get effective pack size and weekly cap from settings
  const settingsDoc = await db
    .collection("settings")
    .findOne({ _id: "global_defaults" } as Parameters<ReturnType<Db["collection"]>["findOne"]>[0]);

  const weeklyBonusCap = (settingsDoc?.weeklyBonusCap as number | undefined) ?? 5.0;
  const packSizeEUR = pendingPackSize ?? (settingsDoc?.bonusPackSize as number | undefined) ?? 2.0;

  // Check weekly bonus cap
  const currentWeeklySpend = await getWeeklyBonusSpend(userId, db);
  if (currentWeeklySpend + packSizeEUR > weeklyBonusCap) {
    throw new Error(
      `Weekly bonus cap exceeded: current spend €${currentWeeklySpend} + pack €${packSizeEUR} > cap €${weeklyBonusCap}`
    );
  }

  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const weekOf = getStartOfWeekUTC(now).toISOString().split("T")[0];

  // Insert bonus_purchases record
  await db.collection("bonus_purchases").insertOne({
    userId,
    packSizeEUR,
    purchasedAt: now,
    confirmedViaMessageId,
    expiresAt: midnight,
    creditRemainingEUR: packSizeEUR,
    weekOf,
  });

  // Unlock access based on lock type
  if (lockType === "image_cap") {
    await unlockImageAccess(userId, db);
  } else if (lockType === "monthly_cap") {
    // Add tokenCredits to balance via $inc
    const creditsToAdd = Math.floor((packSizeEUR / EUR_RATE) * TOKEN_CREDIT_PER_EUR);
    await db.collection("balances").updateOne(
      { user: userId },
      { $inc: { tokenCredits: creditsToAdd } },
      { upsert: true }
    );
    // Also unlock image ACL
    await unlockImageAccess(userId, db, "monthly_cost_cap");
  }

  // Clear the awaiting confirmation state
  await db.collection("settings").updateOne(
    { _id: `override_${userId}` } as Parameters<ReturnType<Db["collection"]>["updateOne"]>[0],
    {
      $unset: {
        awaitingBonusConfirmation: "",
        confirmationOfferedAt: "",
        lockType: "",
        activeConversationId: "",
      },
    }
  );
}
