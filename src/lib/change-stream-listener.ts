/**
 * Change stream listener / budget event processor — Plan 15-04.
 *
 * Architecture (locked by 15-03-DECISIONS.md):
 * - change_stream: no (Railway MongoDB is standalone, not replica set — error 40573)
 * - instrumentation_hook: yes (register() fires at Next.js startup)
 * - approach: 60s setInterval polling in register(), querying messages.createdAt > lastSeenAt
 *
 * This file exports:
 * - startChangeStreamListener(): polls messages every 60s for new kid messages, calls processMessageEvent
 * - processMessageEvent(): idempotent event handler for a single kid message
 *
 * Idempotency guards:
 * - 70% warning: balance_state.warnedAt70PctOn === todayIso → skip
 * - YES credit: balance_state.activeOfferMessageId === null → offer already cleared, skip
 * - YES timing: message.createdAt > balance_state.activeOfferExpiresAt → expired, skip
 */

import type { Db } from "mongodb";
import { evaluateChildState, getBalanceState, ensureBalanceState, applyBonusCredit, todayIso } from "@/lib/budget";
import { sendBonusOfferMessage } from "@/lib/bonus-delivery";

// YES confirmation regex: matches "yes", "YES", "yes.", "Yes" — strict
const YES_REGEX = /^\s*yes\.?\s*$/i;

// Drawing agent ID used for synthetic messages (first Friendly Tutor agent)
const SYNTHETIC_AGENT_ID = "agent_wxgt6su7d3pcosiil3";

// 5 minutes offer window in milliseconds
const OFFER_WINDOW_MS = 5 * 60 * 1000;

export interface MessageEvent {
  userId: string;
  text: string;
  conversationId: string;
  messageId: string;
  createdAt: Date;
  db: Db;
}

/**
 * Processes a single kid message event.
 * Checks for:
 * 1. YES confirmation for an active offer (before expiry) → applyBonusCredit
 * 2. 70% usage threshold → send warning message (once per day)
 * 3. Budget exhausted → send bonus offer (once per offer cycle)
 *
 * All checks are idempotent — calling twice with the same message is a no-op.
 */
export async function processMessageEvent(event: MessageEvent): Promise<void> {
  const { userId, text, conversationId, messageId, createdAt, db } = event;

  // Load balance state (create if missing)
  const balanceState = await getBalanceState(userId, db) ?? await ensureBalanceState(userId, db);

  // ---- YES detection ----
  if (YES_REGEX.test(text)) {
    const { activeOfferMessageId, activeOfferExpiresAt } = balanceState;

    // Guard 1: active offer must exist and not be cleared
    if (activeOfferMessageId && activeOfferExpiresAt) {
      // Guard 2: YES message must arrive BEFORE the offer expiry
      // Per plan: "message.createdAt < balance_state.activeOfferExpiresAt"
      if (createdAt < activeOfferExpiresAt) {
        // Valid YES — get the bonus pack amount and apply credit
        const { getEffectiveBudget } = await import("@/lib/budget");
        const budget = await getEffectiveBudget(userId, db);
        await applyBonusCredit({
          userId,
          db,
          amountEur: budget.bonusPackEur,
          confirmationMessageId: messageId,
        });
        return;
      }
      // Expired offer — fall through to normal evaluation
    }
    // No active offer — fall through to normal evaluation
  }

  // ---- Normal evaluation (non-YES messages, or expired YES) ----
  const state = await evaluateChildState(userId, db);
  const today = todayIso(new Date());

  // ---- 70% threshold warning ----
  // Fire if: dailyPctRemaining <= 0.30 AND not already warned today
  if (state.dailyPctRemaining <= 0.30 && balanceState.warnedAt70PctOn !== today) {
    try {
      // Find the child's most recent conversation for message injection
      const targetConvId = conversationId;

      const warningTemplate = "You've used 70% of your daily budget — keep going, you have 30% left!";
      await sendBonusOfferMessage({
        userId,
        conversationId: targetConvId,
        agentId: SYNTHETIC_AGENT_ID,
        template: warningTemplate,
        db,
      });

      // Mark as warned today
      const balanceStateCol = db.collection("balance_state");
      await balanceStateCol.updateOne(
        { userId },
        { $set: { warnedAt70PctOn: today } },
        { upsert: true }
      );
    } catch (err) {
      console.error(`[change-stream-listener] 70% warning failed for ${userId}:`, err);
    }
    return;
  }

  // ---- Bonus offer ----
  // Fire if: remainingEur <= 0 AND monthly cap not hit AND weekly bonus cap not hit AND no active offer
  if (
    state.remainingEur <= 0 &&
    !state.monthlyCapExhausted &&
    !state.weeklyBonusCapExhausted &&
    !state.hasActiveOffer
  ) {
    try {
      const { getEffectiveBudget } = await import("@/lib/budget");
      const budget = await getEffectiveBudget(userId, db);

      const offerMessageId = await sendBonusOfferMessage({
        userId,
        conversationId,
        agentId: SYNTHETIC_AGENT_ID,
        template: budget.bonusMessageTemplate,
        db,
      });

      const expiresAt = new Date(Date.now() + OFFER_WINDOW_MS);

      // Record active offer in balance_state
      const balanceStateCol = db.collection("balance_state");
      await balanceStateCol.updateOne(
        { userId },
        {
          $set: {
            activeOfferMessageId: offerMessageId,
            activeOfferExpiresAt: expiresAt,
            activeOfferConversationId: conversationId,
          },
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`[change-stream-listener] bonus offer failed for ${userId}:`, err);
    }
  }
}

/**
 * Starts the polling loop that runs every 60 seconds.
 * Called from src/instrumentation.ts register() on server startup.
 *
 * Polls messages where createdAt > cron_state.lastSeenAt AND isCreatedByUser: true.
 * Updates cron_state.lastSeenAt after each batch.
 */
export async function startChangeStreamListener(): Promise<void> {
  const { getMongoClient } = await import("@/lib/mongodb");

  console.log("[change-stream-listener] Starting polling loop (60s interval)...");

  async function pollOnce(): Promise<void> {
    try {
      const client = await getMongoClient();
      const db = client.db("test");

      // Load or initialize last seen timestamp
      const cronStateCol = db.collection("cron_state");
      const stateDoc = await cronStateCol.findOne({ _id: "poll_listener" as unknown as undefined });
      const lastSeenAt: Date = (stateDoc?.lastSeenAt as Date | undefined) ?? new Date(Date.now() - 60_000);

      // Fetch new kid messages since lastSeenAt
      const newMessages = await db
        .collection("messages")
        .find({
          createdAt: { $gt: lastSeenAt },
          isCreatedByUser: true,
        })
        .sort({ createdAt: 1 })
        .limit(200)
        .toArray();

      if (newMessages.length === 0) return;

      // Track processed messageIds within this tick (extra idempotency guard)
      const processedIds = new Set<string>();
      let newLastSeen = lastSeenAt;

      for (const msg of newMessages) {
        const msgId = (msg.messageId as string) ?? (msg._id?.toString?.() ?? "");
        if (processedIds.has(msgId)) continue;
        processedIds.add(msgId);

        // Update lastSeen to the most recent processed message
        const msgCreatedAt = msg.createdAt as Date;
        if (msgCreatedAt > newLastSeen) {
          newLastSeen = msgCreatedAt;
        }

        const userId = (msg.user as string);
        if (!userId) continue;

        try {
          await processMessageEvent({
            userId,
            text: (msg.text as string) ?? "",
            conversationId: (msg.conversationId as string) ?? "",
            messageId: msgId,
            createdAt: msgCreatedAt,
            db,
          });
        } catch (err) {
          console.error(`[change-stream-listener] processMessageEvent failed for msgId=${msgId}:`, err);
        }
      }

      // Persist updated lastSeenAt
      await cronStateCol.updateOne(
        { _id: "poll_listener" as unknown as undefined },
        { $set: { lastSeenAt: newLastSeen, updatedAt: new Date() } },
        { upsert: true }
      );

      console.log(`[change-stream-listener] Processed ${newMessages.length} messages, lastSeenAt=${newLastSeen.toISOString()}`);
    } catch (err) {
      console.error("[change-stream-listener] Poll error:", err);
    }
  }

  // Poll immediately on startup, then every 60 seconds
  pollOnce().catch((err) => console.error("[change-stream-listener] Initial poll failed:", err));
  setInterval(() => {
    pollOnce().catch((err) => console.error("[change-stream-listener] Poll interval failed:", err));
  }, 60_000);
}
