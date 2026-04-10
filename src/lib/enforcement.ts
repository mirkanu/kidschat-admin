/**
 * Enforcement lib — Phase 15 rate limiting via ACL + balance hard-lock.
 *
 * ACL-based image lock: removes aclentries for DRAWING_AGENT_IDS, saving to locked_acl_entries.
 * Balance hard-lock: sets tokenCredits: 0 in the balances collection.
 *
 * Field names verified from 15-00-MONGO-INSPECTION.md:
 *   aclentries.principalId = user reference (NOT "user")
 *   aclentries.resourceId = MongoDB ObjectId of agent doc (NOT agent_xxx string)
 *   balances collection is plural (NOT "balance")
 */

import type { Db } from "mongodb";
import { getEffectiveLimits } from "@/lib/settings";
import { getImageCountToday, getDailyMessageCount, getMonthlySpendEUR } from "@/lib/cost-ledger";
import { getWeeklyBonusSpend, getActiveBonusCredit } from "@/lib/bonus-purchases";
import { sendBonusOfferMessage } from "@/lib/bonus-delivery";

export const DRAWING_AGENT_IDS = [
  "agent_wxgt6su7d3pcosiil3",
  "agent_y4w1cvoyg77p9thed9",
  "agent_64q6z5s57552cpgl0hr",
  "agent_aiv99mzvdzquym6y89k",
];

export type LockReason = "daily_image_cap" | "daily_message_cap" | "monthly_cost_cap";

export interface EnforcementResult {
  action: "no_action" | "image_locked" | "hard_locked" | "already_awaiting";
  reason?: string;
  userId?: string;
}

/**
 * Resolves agent _id ObjectIds for all DRAWING_AGENT_IDS.
 * aclentries.resourceId is a MongoDB ObjectId — must look up agents first.
 */
async function resolveDrawingAgentIds(db: Db): Promise<string[]> {
  const agents = await db
    .collection("agents")
    .find({ agentId: { $in: DRAWING_AGENT_IDS } })
    .toArray();
  return agents.map((a) => a._id?.toString?.() ?? a._id);
}

/**
 * Removes aclentries for all drawing agents for a user, saving them to locked_acl_entries.
 * This hides the drawing agents from the child's interface.
 */
export async function lockImageAccess(userId: string, db: Db, reason: LockReason = "daily_image_cap"): Promise<void> {
  const agentObjectIds = await resolveDrawingAgentIds(db);

  // Fetch existing ACL entries for this user + drawing agents
  const existingAcl = await db
    .collection("aclentries")
    .find({
      principalId: userId,
      resourceId: { $in: agentObjectIds },
      resourceType: "agent",
    })
    .toArray();

  if (existingAcl.length === 0) {
    // Nothing to lock — already locked or never had access
    return;
  }

  // Snapshot to locked_acl_entries with lockReason
  const docsToSave = existingAcl.map((acl) => ({
    ...acl,
    lockReason: reason,
    lockedAt: new Date(),
  }));

  await db.collection("locked_acl_entries").insertMany(docsToSave, { ordered: false });

  // Remove from active aclentries
  await db.collection("aclentries").deleteMany({
    principalId: userId,
    resourceId: { $in: agentObjectIds },
    resourceType: "agent",
  });
}

/**
 * Restores aclentries from locked_acl_entries for a user.
 * Uses ordered:false so duplicate key errors (11000) are swallowed.
 */
export async function unlockImageAccess(userId: string, db: Db, reason?: LockReason): Promise<void> {
  const query: Record<string, unknown> = { principalId: userId };
  if (reason) {
    query.lockReason = reason;
  }

  const locked = await db.collection("locked_acl_entries").find(query).toArray();
  if (locked.length === 0) return;

  // Restore to aclentries — strip lockReason and lockedAt fields
  const toRestore = locked.map(({ lockReason: _lr, lockedAt: _la, ...rest }) => rest);

  try {
    await db.collection("aclentries").insertMany(toRestore, { ordered: false });
  } catch (err: unknown) {
    // Swallow duplicate key errors — entries may already exist
    const mongoErr = err as { code?: number };
    if (mongoErr?.code !== 11000) {
      throw err;
    }
  }

  // Remove from locked_acl_entries
  await db.collection("locked_acl_entries").deleteMany(query);
}

/**
 * Hard-locks all access for a child:
 * 1. Sets tokenCredits: 0 in balances (LibreChat blocks next request)
 * 2. Also calls lockImageAccess as belt-and-suspenders
 */
export async function hardLockAllAccess(userId: string, db: Db): Promise<void> {
  // Write tokenCredits: 0 to balances collection
  await db.collection("balances").updateOne(
    { user: userId },
    { $set: { tokenCredits: 0 } },
    { upsert: true }
  );

  // Belt-and-suspenders: also lock image access
  await lockImageAccess(userId, db, "monthly_cost_cap");
}

/**
 * Restores full access after a monthly reset:
 * 1. Sets positive tokenCredits in balances
 * 2. Calls unlockImageAccess to restore ACL entries
 */
export async function unlockAllAccess(userId: string, db: Db, credits: number): Promise<void> {
  // Restore tokenCredits
  await db.collection("balances").updateOne(
    { user: userId },
    { $set: { tokenCredits: credits } },
    { upsert: true }
  );

  // Restore ACL entries
  await unlockImageAccess(userId, db, "monthly_cost_cap");
}

/**
 * Main orchestrator: checks a child's current usage against their effective limits
 * and takes action if any limit is exceeded.
 *
 * Awaiting-confirmation state is stored in settings collection under override_{userId}.
 */
export async function enforceChildLimits(userId: string, childName: string, db: Db): Promise<EnforcementResult> {
  // Check if already awaiting bonus confirmation
  const overrideDoc = await db
    .collection("settings")
    .findOne({ _id: `override_${userId}` } as Parameters<ReturnType<Db["collection"]>["findOne"]>[0]);

  if (overrideDoc?.awaitingBonusConfirmation === true) {
    return { action: "already_awaiting", userId };
  }

  // Fetch effective limits and current usage in parallel
  const [limits, imageCount, messageCount, monthlySpend, weeklyBonus, activeBonus] = await Promise.all([
    getEffectiveLimits(userId, db),
    getImageCountToday(userId, db),
    getDailyMessageCount(userId, db),
    getMonthlySpendEUR(userId, db),
    getWeeklyBonusSpend(userId, db),
    getActiveBonusCredit(userId, db),
  ]);

  const shouldHardLock = monthlySpend >= limits.monthlyCostCapEUR;
  const weeklyBonusExhausted = weeklyBonus >= limits.weeklyBonusCap;
  const shouldImageLock = imageCount >= limits.dailyImageLimit;
  const shouldMessageLock = messageCount >= limits.dailyMessageLimit;

  // If child has active bonus credit, don't lock (bonus covers overage)
  if (activeBonus > 0 && !shouldHardLock) {
    return { action: "no_action", userId };
  }

  // Hard lock: monthly cap hit AND weekly bonus cap exhausted
  if (shouldHardLock && weeklyBonusExhausted) {
    await hardLockAllAccess(userId, db);
    return { action: "hard_locked", reason: "monthly_cost_cap_and_bonus_exhausted", userId };
  }

  // Hard lock: monthly cap hit, offer bonus if not exhausted
  if (shouldHardLock && !weeklyBonusExhausted) {
    await lockImageAccess(userId, db, "monthly_cost_cap");
    await _offerBonus(userId, childName, "monthly_cap", limits.bonusMessageTemplate, db);
    return { action: "image_locked", reason: "monthly_cost_cap_bonus_offered", userId };
  }

  // Image lock: daily image cap hit, offer bonus if not exhausted
  if ((shouldImageLock || shouldMessageLock) && !weeklyBonusExhausted) {
    const reason: LockReason = shouldImageLock ? "daily_image_cap" : "daily_message_cap";
    await lockImageAccess(userId, db, reason);
    await _offerBonus(userId, childName, "image_cap", limits.bonusMessageTemplate, db);
    return { action: "image_locked", reason, userId };
  }

  // Image lock: daily cap hit AND weekly bonus exhausted → just lock, no offer
  if ((shouldImageLock || shouldMessageLock) && weeklyBonusExhausted) {
    const reason: LockReason = shouldImageLock ? "daily_image_cap" : "daily_message_cap";
    await lockImageAccess(userId, db, reason);
    return { action: "image_locked", reason: `${reason}_bonus_exhausted`, userId };
  }

  return { action: "no_action", userId };
}

/**
 * Helper: Find the child's most recent conversation and send a bonus offer message.
 * Sets awaitingBonusConfirmation state in settings collection.
 */
async function _offerBonus(
  userId: string,
  _childName: string,
  lockType: "image_cap" | "monthly_cap",
  template: string,
  db: Db
): Promise<void> {
  // Find most recent conversation for the child
  const conv = await db.collection("conversations").findOne(
    { user: userId },
    // @ts-expect-error sort is valid MongoDB option
    { sort: { updatedAt: -1 } }
  );

  if (!conv) return; // No conversation to offer into

  const conversationId = conv.conversationId as string;
  const agentId = DRAWING_AGENT_IDS[0]; // Use first drawing agent for the offer

  await sendBonusOfferMessage({
    userId,
    conversationId,
    agentId,
    template,
    db,
  });

  // Record awaiting state in settings
  await db.collection("settings").updateOne(
    { _id: `override_${userId}` } as Parameters<ReturnType<Db["collection"]>["updateOne"]>[0],
    {
      $set: {
        awaitingBonusConfirmation: true,
        confirmationOfferedAt: new Date(),
        lockType,
        activeConversationId: conversationId,
      },
    },
    { upsert: true }
  );
}
