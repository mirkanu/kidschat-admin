/**
 * Image-search activity aggregation for the daily-summary email (Plan 21-06, OVERSIGHT-03).
 *
 * DATA SOURCE — why conversations+messages, not search_counters:
 *   The `daily-reset` cron at 00:00 UTC wipes `search_counters.deleteMany({})`
 *   before the 08:00 UTC daily-summary fires, so by the time we'd read it the
 *   count is always zero. Querying conversations+messages directly is the only
 *   source of truth for "yesterday's" queries in the 24h window.
 *
 * FILTER — preset field locked by 21-04 CONFIG_PATH check:
 *   `conversations.spec === "image-search"` — the modelSpecs name when the kid
 *   uses the Image Search preset. Other presets ("casual-buddy" etc.) are
 *   filtered out.
 *
 * JOIN SHAPE (also locked by quick-260417-p94):
 *   - messages.conversationId joins conversations.conversationId (NOT _id).
 *   - conversations.user is a string ObjectId, joinable to users._id via
 *     `{$toString: "$_id"}`.
 *   - messages.isCreatedByUser=true + messages.text is the kid's query text
 *     (LibreChat v0.8.x uses `text`, not `content`).
 *
 * PRIVACY:
 *   Raw query strings returned in `queries` are ephemeral — the caller feeds
 *   them to `summarizeImageSearchQueries` for paraphrasing, then STRIPS the
 *   array from both the email template payload and the email_notifications
 *   audit doc (threats T-21-06-01 / T-21-06-02).
 */

import type { Db } from "mongodb";

export interface ImageSearchStats {
  count: number;
  /** Most-recent-first, deduplicated by exact text, capped at 5, each trimmed to 200 chars. */
  queries: string[];
}

/**
 * Aggregate yesterday's image-search activity for one child.
 *
 * Returns `count` = total matching user messages in window (for the email's
 * "Image searches: N" line), and `queries` = the most-recent-first, dedup'd,
 * 5-capped, 200-char-trimmed sample fed to Haiku for paraphrasing.
 */
export async function getImageSearchStats(
  childName: string,
  db: Db,
): Promise<ImageSearchStats> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const rows = await db
    .collection("messages")
    .aggregate<{ text: string; createdAt: Date }>([
      { $match: { createdAt: { $gte: oneDayAgo }, isCreatedByUser: true } },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "conversationId",
          as: "conv",
        },
      },
      { $unwind: { path: "$conv", preserveNullAndEmptyArrays: false } },
      { $match: { "conv.spec": "image-search" } },
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
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: false } },
      { $match: { "userInfo.name": childName } },
      { $project: { text: 1, createdAt: 1 } },
      { $sort: { createdAt: -1 } },
      // NB: no $limit — we need the true count AND the top-5 sample.
    ])
    .toArray();

  const count = rows.length;

  // Dedupe by exact text, preserve most-recent-first order, cap to 5,
  // trim each to 200 chars with ellipsis.
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const r of rows) {
    const raw = typeof r.text === "string" ? r.text : "";
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    queries.push(raw.length > 200 ? raw.slice(0, 200) + "…" : raw);
    if (queries.length >= 5) break;
  }

  return { count, queries };
}
