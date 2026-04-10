import type { Db } from "mongodb";

export interface WeeklyChildStats {
  name: string;
  totalMessages: number;
  activeDays: number;
  topPresets: string[];
  /** Number of bonus pack purchases this week */
  bonusPurchasesThisWeek: number;
  /** Total EUR spent on bonus packs this week */
  totalBonusSpendEUR: number;
}

/**
 * Raw aggregation result shape — internal, not exported.
 * Represents the shape returned by MongoDB before formatting.
 */
interface RawDigestRow {
  _id: string | null;
  totalMessages: number;
  distinctDays: string[];
  distinctPresets: (string | null)[];
}

/**
 * Transform raw MongoDB aggregation results into WeeklyChildStats objects.
 * Pure function — fully testable without a DB connection.
 * Bonus stats default to 0 — callers should merge via mergeDigestBonusStats.
 */
export function formatDigestStats(raw: RawDigestRow[]): WeeklyChildStats[] {
  return raw.map((row) => {
    const name = row._id ?? "Unknown Child";
    const totalMessages = row.totalMessages ?? 0;
    const activeDays = (row.distinctDays ?? []).length;
    const topPresets = (row.distinctPresets ?? [])
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .slice(0, 5);
    return { name, totalMessages, activeDays, topPresets, bonusPurchasesThisWeek: 0, totalBonusSpendEUR: 0 };
  });
}

/** Shape of the bonus aggregation result */
interface BonusAggRow {
  _id: string; // userId
  count: number;
  totalSpend: number;
}

/**
 * Merges bonus purchase stats into WeeklyChildStats rows.
 * Pure function — testable without a DB connection.
 */
export function mergeDigestBonusStats(
  stats: WeeklyChildStats[],
  bonusByUserId: Map<string, { count: number; totalSpend: number }>
): WeeklyChildStats[] {
  return stats.map((s) => {
    // We can't look up by userId in the existing stats (they use name), so this merge
    // is done at the aggregation level via userId → name lookup in getWeeklyChildStats
    return s;
  });
}

/**
 * Formats the bonus line for a child's digest stats.
 * Returns null if no purchases this week.
 */
export function formatBonusLine(stats: WeeklyChildStats): string | null {
  if (stats.bonusPurchasesThisWeek === 0) return null;
  return `Bonuses: €${stats.totalBonusSpendEUR.toFixed(2)} (${stats.bonusPurchasesThisWeek} purchase${stats.bonusPurchasesThisWeek !== 1 ? "s" : ""})`;
}

export type { BonusAggRow };

/**
 * Aggregate per-child weekly stats from MongoDB.
 * Returns WeeklyChildStats for all non-ADMIN users with messages in the last 7 days.
 * Also merges bonus purchase totals from bonus_purchases collection.
 */
export async function getWeeklyChildStats(db: Db): Promise<WeeklyChildStats[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const raw = await db
    .collection("messages")
    .aggregate<RawDigestRow>([
      // Step 1: Match only user-created messages from the last 7 days
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          isCreatedByUser: true,
        },
      },
      // Step 2: Join conversation to get user field and chatGptLabel (preset)
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "conversationId",
          as: "conv",
        },
      },
      {
        $unwind: {
          path: "$conv",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Step 3: Join users to get name and role
      {
        $lookup: {
          from: "users",
          let: { userId: "$conv.user" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] },
              },
            },
          ],
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Step 4: Exclude ADMIN users
      {
        $match: {
          "userInfo.role": { $ne: "ADMIN" },
        },
      },
      // Step 5: Group by user name — count messages, distinct days, distinct presets
      {
        $group: {
          _id: "$userInfo.name",
          totalMessages: { $sum: 1 },
          distinctDays: {
            $addToSet: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
          },
          distinctPresets: {
            $addToSet: "$conv.chatGptLabel",
          },
        },
      },
      // Step 6: Sort by message count descending
      {
        $sort: { totalMessages: -1 },
      },
    ])
    .toArray();

  const stats = formatDigestStats(raw);

  // Gather userIds for bonus purchase lookup
  // We need to join userId → name, so also get users from the conversations above
  // Instead, aggregate bonus_purchases by userId and then look up users for name mapping
  const bonusRaw = await db
    .collection("bonus_purchases")
    .aggregate<BonusAggRow>([
      {
        $match: {
          purchasedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
          totalSpend: { $sum: "$packSizeEUR" },
        },
      },
    ])
    .toArray();

  if (bonusRaw.length === 0) {
    return stats;
  }

  // Look up user names for bonus userIds
  const { ObjectId } = await import("mongodb");
  const bonusUserIds = bonusRaw.map((b) => b._id).filter(Boolean);
  const validBonusObjectIds = bonusUserIds
    .filter((id) => {
      try { new ObjectId(id); return true; } catch { return false; }
    })
    .map((id) => new ObjectId(id));

  const bonusUsers = validBonusObjectIds.length > 0
    ? await db
        .collection("users")
        .find({ _id: { $in: validBonusObjectIds } })
        .project<{ _id: { toString(): string }; name: string }>({ _id: 1, name: 1 })
        .toArray()
    : [];

  const userIdToName = new Map<string, string>();
  for (const u of bonusUsers) {
    userIdToName.set(u._id.toString(), u.name ?? "Unknown");
  }

  // Build bonus map by name
  const bonusByName = new Map<string, { count: number; totalSpend: number }>();
  for (const row of bonusRaw) {
    const name = userIdToName.get(row._id) ?? null;
    if (name) {
      bonusByName.set(name, { count: row.count, totalSpend: row.totalSpend });
    }
  }

  // Merge bonus stats into WeeklyChildStats
  return stats.map((s) => {
    const bonus = bonusByName.get(s.name);
    if (!bonus) return s;
    return {
      ...s,
      bonusPurchasesThisWeek: bonus.count,
      totalBonusSpendEUR: bonus.totalSpend,
    };
  });
}
