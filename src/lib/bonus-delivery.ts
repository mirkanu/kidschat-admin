/**
 * Bonus delivery lib — Phase 15 "YES" bonus purchase flow.
 *
 * Plan 15.2-01 (Option 7 — Agent System Prompt Context Injection):
 * sendBonusOfferMessage no longer inserts synthetic rows into the messages
 * collection. Instead it temporarily prepends a verbatim-delivery instruction
 * to the target agent's `instructions` field. When the kid sends their next
 * message, the agent delivers the text as the opening line of its natural
 * reply — riding LibreChat's native SSE pipeline so React Query cache is
 * updated in real-time.
 *
 * After delivery is detected (change-stream-listener sees an AI message
 * created AFTER pendingWarning.injectedAt), restoreAgentSystemPrompt is
 * called to put the original instructions back and clear the pending state.
 *
 * A 10-minute TTL safety net in pollOnce force-restores stuck prompts even if
 * the kid goes offline before replying.
 *
 * Field path empirically confirmed during Task 1 probe:
 *   agents collection: query key = { id: agentId }
 *   system prompt field: instructions (NOT model_options.system)
 *
 * Plan 15-04: Removed enforcement.ts imports (lockImageAccess, unlockImageAccess,
 * unlockAllAccess). ACL-based locking is no longer used — LibreChat's native
 * tokenCredits enforcement supersedes it.
 */

import { v4 as uuidv4 } from "uuid";
import type { Db } from "mongodb";
import { getWeeklyBonusSpend } from "@/lib/bonus-purchases";

export interface PendingState {
  awaitingBonusConfirmation?: boolean;
  confirmationOfferedAt?: Date;
  lockType?: "image_cap" | "monthly_cap";
  activeConversationId?: string;
  packSizeEUR?: number;
  confirmedViaMessageId?: string;
}

/**
 * The field path in the agents collection that holds the system prompt.
 * Confirmed empirically by the Phase 15.2 probe: the live agent doc has a top-level
 * `instructions` string field. The original plan assumed `model_options.system` but
 * the actual field is `instructions`.
 */
const AGENT_SYSTEM_FIELD = "instructions";

/**
 * Injects a verbatim-delivery instruction into the target agent's system prompt,
 * then records the pending state in balance_state so the change-stream-listener
 * can detect delivery and restore the original.
 *
 * This replaces the old direct-insert approach (which was invisible to active
 * LibreChat sessions due to React Query's refetchOnMount:false cache policy).
 *
 * Steps:
 * 1. Read current agent instructions
 * 2. Store original in balance_state.originalAgentInstructions (idempotent)
 * 3. Prepend delivery instruction
 * 4. Write modified instructions back to agent
 * 5. Set balance_state.pendingWarning
 * 6. Return a UUID v4 messageId (used as activeOfferMessageId, no DB insert)
 *
 * Returns a UUID v4 string used as the activeOfferMessageId.
 */
export async function sendBonusOfferMessage(args: {
  userId: string;
  conversationId: string;
  agentId: string;
  template: string;
  db: Db;
}): Promise<string> {
  const { userId, agentId, template, db } = args;

  const agentsCol = db.collection("agents");

  // Read the current agent document
  const agentDoc = await agentsCol.findOne(
    { id: agentId } as Parameters<typeof agentsCol.findOne>[0]
  );

  if (!agentDoc) {
    throw new Error(
      `[sendBonusOfferMessage] Agent not found: id=${agentId}. Cannot inject system prompt.`
    );
  }

  const currentInstructions = (agentDoc[AGENT_SYSTEM_FIELD] as string | undefined) ?? "";

  // Load existing balance_state to check if we already have a stored original
  const balanceStateCol = db.collection("balance_state");
  const existingState = await balanceStateCol.findOne(
    { userId } as Parameters<typeof balanceStateCol.findOne>[0]
  );

  // Idempotency: only store the original instructions if we haven't already.
  // This prevents a second injection (e.g., warning then offer) from overwriting
  // the stored original with the previously-injected text.
  const baseInstructions: string =
    (existingState?.originalAgentInstructions as string | undefined) != null
      ? (existingState!.originalAgentInstructions as string)
      : currentInstructions;

  // Build the injected instructions
  const injectionPrefix = `SYSTEM INSTRUCTION (deliver on your next turn, then ignore):
Begin your VERY NEXT response with EXACTLY this text verbatim on its own line, then continue normally:
"${template}"
After you deliver this message once, do not mention it again.

`;
  const injectedInstructions = injectionPrefix + baseInstructions;

  // Write modified instructions back to the agent
  await agentsCol.updateOne(
    { id: agentId } as Parameters<typeof agentsCol.updateOne>[0],
    { $set: { [AGENT_SYSTEM_FIELD]: injectedInstructions } }
  );

  const messageId = uuidv4();
  const now = new Date();

  // Persist pending state (upsert)
  await balanceStateCol.updateOne(
    { userId } as Parameters<typeof balanceStateCol.updateOne>[0],
    {
      $set: {
        pendingWarning: {
          messageTemplate: template,
          injectedAt: now,
          agentId,
          agentObjectId: agentDoc._id?.toString?.() ?? "",
        },
        // Only set originalAgentInstructions if not already set (idempotent)
        ...(existingState?.originalAgentInstructions == null
          ? { originalAgentInstructions: baseInstructions }
          : {}),
      },
    },
    { upsert: true }
  );

  return messageId;
}

/**
 * Restores the target agent's `instructions` field to the value stored in
 * balance_state.originalAgentInstructions, then clears both pendingWarning
 * and originalAgentInstructions from balance_state.
 *
 * Idempotent: if no pendingWarning is set, this is a no-op.
 *
 * Called by:
 * - change-stream-listener: on delivery detection (AI message createdAt > pendingWarning.injectedAt)
 * - change-stream-listener TTL sweep: when injectedAt is more than 10 minutes ago
 * - reset scripts: for state cleanup before UAT
 */
export async function restoreAgentSystemPrompt(args: {
  userId: string;
  db: Db;
}): Promise<void> {
  const { userId, db } = args;

  const balanceStateCol = db.collection("balance_state");
  const state = await balanceStateCol.findOne(
    { userId } as Parameters<typeof balanceStateCol.findOne>[0]
  );

  // No pending warning — nothing to restore
  if (!state?.pendingWarning) {
    return;
  }

  const { agentId } = state.pendingWarning as { agentId: string };
  const originalInstructions = (state.originalAgentInstructions as string | undefined) ?? "";

  // Restore the agent's instructions
  const agentsCol = db.collection("agents");
  await agentsCol.updateOne(
    { id: agentId } as Parameters<typeof agentsCol.updateOne>[0],
    { $set: { [AGENT_SYSTEM_FIELD]: originalInstructions } }
  );

  // Clear pending state
  await balanceStateCol.updateOne(
    { userId } as Parameters<typeof balanceStateCol.updateOne>[0],
    { $unset: { pendingWarning: "", originalAgentInstructions: "" } }
  );
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
