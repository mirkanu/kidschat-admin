import type { Db } from "mongodb";

export interface WeeklyChildStats {
  name: string;
  totalMessages: number;
  activeDays: number;
  topPresets: string[];
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
 */
export function formatDigestStats(raw: RawDigestRow[]): WeeklyChildStats[] {
  return raw.map((row) => {
    const name = row._id ?? "Unknown Child";
    const totalMessages = row.totalMessages ?? 0;
    const activeDays = (row.distinctDays ?? []).length;
    const topPresets = (row.distinctPresets ?? [])
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .slice(0, 5);
    return { name, totalMessages, activeDays, topPresets };
  });
}

/**
 * Aggregate per-child weekly stats from MongoDB.
 * Returns WeeklyChildStats for all non-ADMIN users with messages in the last 7 days.
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

  return formatDigestStats(raw);
}
