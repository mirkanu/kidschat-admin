import type { Db } from "mongodb";

export interface DailyChildStats {
  name: string;
  totalMessages: number;
  imageRequests: number;
  topPresets: string[];
}

/**
 * Raw aggregation result shape — internal, not exported.
 */
interface RawDailyRow {
  _id: string | null;
  totalMessages: number;
  imageRequests: number;
  distinctPresets: (string | null)[];
}

/**
 * Transform raw MongoDB aggregation results into DailyChildStats objects.
 * Pure function — fully testable without a DB connection.
 */
export function formatDailyStats(raw: RawDailyRow[]): DailyChildStats[] {
  return raw.map((row) => {
    const name = row._id ?? "Unknown Child";
    const totalMessages = row.totalMessages ?? 0;
    const imageRequests = row.imageRequests ?? 0;
    const topPresets = (row.distinctPresets ?? [])
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .slice(0, 5);
    return { name, totalMessages, imageRequests, topPresets };
  });
}

/**
 * Aggregate per-child daily stats from MongoDB.
 * Returns DailyChildStats for all non-ADMIN users with messages in the last 24 hours.
 */
export async function getDailyChildStats(db: Db): Promise<DailyChildStats[]> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const raw = await db
    .collection("messages")
    .aggregate<RawDailyRow>([
      // Step 1: Match only user-created messages from the last 24 hours
      {
        $match: {
          createdAt: { $gte: oneDayAgo },
          isCreatedByUser: true,
        },
      },
      // Step 2: Join conversation to get user field, chatGptLabel (preset), and agentId
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
      // Step 5: Group by user name — count messages, image requests, distinct presets
      {
        $group: {
          _id: "$userInfo.name",
          totalMessages: { $sum: 1 },
          imageRequests: {
            $sum: {
              $cond: [{ $ifNull: ["$conv.agentId", false] }, 1, 0],
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

  return formatDailyStats(raw);
}
