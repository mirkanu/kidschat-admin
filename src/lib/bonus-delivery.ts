/**
 * Bonus delivery lib — Phase 15 "YES" bonus purchase flow.
 *
 * Plan 15-04: Removed enforcement.ts imports (lockImageAccess, unlockImageAccess,
 * unlockAllAccess). ACL-based locking is no longer used — LibreChat's native
 * tokenCredits enforcement supersedes it.
 *
 * Implements:
 * - sendBonusOfferMessage: inserts a bonus offer into the messages collection
 * - detectBonusConfirmation: checks if child typed "YES" within 5 min (legacy helper)
 *
 * Field names from 15-00-MONGO-INSPECTION.md:
 *   messages: messageId, user, conversationId, isCreatedByUser, text, endpoint, agent_id, etc.
 *   conversations: conversationId (UUID), user, updatedAt
 */

import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { getWeeklyBonusSpend } from "@/lib/bonus-purchases";

type ConversationDoc = Record<string, unknown>;

export interface PendingState {
  awaitingBonusConfirmation?: boolean;
  confirmationOfferedAt?: Date;
  lockType?: "image_cap" | "monthly_cap";
  activeConversationId?: string;
  packSizeEUR?: number;
  confirmedViaMessageId?: string;
}

/**
 * Inserts a bonus offer message (or warning message) into the messages collection.
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
  const convsCol = db.collection<ConversationDoc>("conversations");
  await convsCol.updateOne(
    { conversationId } as Parameters<typeof convsCol.updateOne>[0],
    { $set: { updatedAt: now } }
  );

  return messageId;
}

/**
 * Checks if the child typed "YES" in their conversation within 5 minutes of the offer.
 * Uses a strict regex: /^\s*yes\.?\s*$/i to match "yes", "YES", "yes."
 *
 * @deprecated The change-stream-listener now handles YES detection inline via
 * balance_state.activeOfferMessageId + createdAt comparison. This function is
 * kept for backward compat with the bonus-delivery tests.
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
  });

  return yesMessage !== null;
}

/**
 * @deprecated Use applyBonusCredit from budget.ts instead.
 * Kept for backward compat with existing tests. Delegates to budget.ts.
 *
 * Credits the bonus pack and updates balances.
 * - Checks the weekly bonus cap before proceeding
 * - Inserts a bonus_purchases record
 * - $inc balances.tokenCredits
 * - Clears balance_state.activeOfferMessageId
 */
export async function applyBonusCredit(userId: string, pending: PendingState, db: Db): Promise<void> {
  const { confirmedViaMessageId, packSizeEUR: pendingPackSize } = pending;

  if (!confirmedViaMessageId) {
    throw new Error("Invalid pending state: missing confirmedViaMessageId");
  }

  // Get pack size from settings or pending state
  // Check both new schema fields (weeklyBonusCapEur, bonusPackEur) and legacy field names
  const settingsCol = db.collection("settings");
  const settingsDoc = await settingsCol.findOne(
    { key: "global_defaults" } as Parameters<typeof settingsCol.findOne>[0]
  );

  const weeklyBonusCapEur =
    (settingsDoc?.weeklyBonusCapEur as number | undefined) ??
    (settingsDoc?.weeklyBonusCap as number | undefined) ??
    0.50;
  const packSizeEur =
    pendingPackSize ??
    (settingsDoc?.bonusPackEur as number | undefined) ??
    (settingsDoc?.bonusPackSize as number | undefined) ??
    0.20;

  // Check weekly bonus cap
  const currentWeeklySpend = await getWeeklyBonusSpend(userId, db);
  if (currentWeeklySpend + packSizeEur > weeklyBonusCapEur) {
    throw new Error(
      `Weekly bonus cap exceeded: current spend €${currentWeeklySpend} + pack €${packSizeEur} > cap €${weeklyBonusCapEur}`
    );
  }

  // Delegate to budget.ts for the actual operation
  const { applyBonusCredit: budgetApplyBonus } = await import("@/lib/budget");
  await budgetApplyBonus({
    userId,
    db,
    amountEur: packSizeEur,
    confirmationMessageId: confirmedViaMessageId,
  });
}
