/**
 * Bonus purchases lib — Phase 15 "Extra Usage" model.
 *
 * Storage: MongoDB `bonus_purchases` collection
 * Each document tracks one bonus pack purchase by a child,
 * including the remaining credit and expiry.
 *
 * Week boundary: Monday 00:00:00 UTC (ISO week standard).
 */

import type { Db, ObjectId } from "mongodb";

export interface BonusPurchase {
  _id?: ObjectId;
  userId: string;
  childName: string;
  /** EUR value of the bonus pack purchased */
  packSizeEUR: number;
  purchasedAt: Date;
  /** The LibreChat messageId that confirmed this purchase ("YES" response) */
  confirmedViaMessageId: string;
  /** Bonus credit expires at midnight UTC */
  expiresAt: Date;
  /** EUR credit remaining — decremented as usage is billed against this bonus */
  creditRemainingEUR: number;
  /** ISO date string of the Monday that starts this purchase's week (for weekly cap queries) */
  weekOf: string;
}

/**
 * Returns the UTC start of the week (Monday 00:00:00 UTC) for a given date.
 * JavaScript getUTCDay(): 0=Sun, 1=Mon, 2=Tue, ..., 6=Sat
 */
export function getStartOfWeekUTC(date: Date): Date {
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Days since Monday: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday)
  );
  return monday;
}

/**
 * Returns the total packSizeEUR spent on bonus purchases since the start of
 * the current UTC week (Monday 00:00:00 UTC).
 */
export async function getWeeklyBonusSpend(userId: string, db: Db): Promise<number> {
  const weekStart = getStartOfWeekUTC(new Date());

  const results = await db
    .collection("bonus_purchases")
    .aggregate([
      {
        $match: {
          userId,
          purchasedAt: { $gte: weekStart },
        },
      },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: "$packSizeEUR" },
        },
      },
    ])
    .toArray();

  return results[0]?.totalSpend ?? 0;
}

/**
 * Returns the total creditRemainingEUR across all non-expired bonus purchases
 * for the child where creditRemainingEUR > 0.
 */
export async function getActiveBonusCredit(userId: string, db: Db): Promise<number> {
  const now = new Date();

  const results = await db
    .collection("bonus_purchases")
    .aggregate([
      {
        $match: {
          userId,
          expiresAt: { $gt: now },
          creditRemainingEUR: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalCredit: { $sum: "$creditRemainingEUR" },
        },
      },
    ])
    .toArray();

  return results[0]?.totalCredit ?? 0;
}
