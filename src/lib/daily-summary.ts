import type { Db } from "mongodb";

/**
 * Per-child daily stats surfaced in the daily-summary email.
 *
 * Shape history:
 *   - v1 (Phase 18): totalMessages + imageRequests + topPresets.
 *   - v2 (quick task 260417-p94): drops imageRequests + topPresets,
 *     adds alertCount + AI-rendered summary + alertSummary + the raw
 *     conversationExcerpts that were fed to the summariser.
 *
 * `summary`, `alertSummary` and `conversationExcerpts` are populated
 * downstream in `/api/notify/daily-summary/route.ts`:
 *   - `getDailyChildStats(db)` returns rows with `alertCount` +
 *     `conversationExcerpts` pre-populated (both are pure DB reads).
 *   - The route then runs Haiku 4.5 per-kid and writes into
 *     `summary` and (when `alertCount > 0`) `alertSummary`.
 *   - `conversationExcerpts` is STRIPPED from the email_notifications
 *     audit doc before insert (privacy — see threat T-p94-02).
 */
export interface DailyChildStats {
  name: string;
  totalMessages: number;
  alertCount: number;
  /** AI-rendered one-sentence summary + "Concerns:" line, or fallback string. */
  summary: string;
  /** AI-rendered one-sentence alert paraphrase; null when `alertCount === 0`. */
  alertSummary: string | null;
  /** Raw role-prefixed excerpts fed to the AI — ephemeral, not persisted. */
  conversationExcerpts: string;
  // --- Plan 21-06 / OVERSIGHT-03 ---
  /** Total image-search queries in last 24h (rendered on every kid card). */
  imageSearchCount: number;
  /** Most-recent-first, dedup'd, capped at 5. Fed to summarizeChildDay alongside conversation excerpts. Ephemeral — stripped from audit doc. */
  imageSearchQueries: string[];
}

/**
 * Raw aggregation result shape — internal, not exported.
 * Matches the new simplified $group stage (just _id + totalMessages).
 */
interface RawDailyRow {
  _id: string | null;
  totalMessages: number;
}

/**
 * Transform raw MongoDB aggregation results into DailyChildStats objects.
 * Pure function — fully testable without a DB connection.
 *
 * All AI-populated / query-populated fields default to empty values; the
 * caller (`getDailyChildStats` + route.ts) fills them in.
 */
export function formatDailyStats(raw: RawDailyRow[]): DailyChildStats[] {
  return raw.map((row) => ({
    name: row._id ?? "Unknown Child",
    totalMessages: row.totalMessages ?? 0,
    alertCount: 0,
    summary: "",
    alertSummary: null,
    conversationExcerpts: "",
    imageSearchCount: 0,
    imageSearchQueries: [],
  }));
}

/**
 * Fetch and format a role-prefixed transcript of the last 24h of chat
 * between one child and the AI. Used as input to `summarizeChildDay`.
 *
 * Returns "" when the child has no messages in the window — the caller
 * uses this as a signal to skip the Haiku call and render
 * "No activity yesterday." directly.
 *
 * Hard-caps total length to 12000 chars (~3000 input tokens per
 * CONTEXT.md budget) — truncation keeps the MOST RECENT messages.
 */
export async function getRecentConversations(
  childName: string,
  db: Db,
  limit: number = 20,
): Promise<string> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const rows = await db
    .collection("messages")
    .aggregate<{
      text: string;
      isCreatedByUser?: boolean;
      createdAt: Date;
    }>([
      { $match: { createdAt: { $gte: oneDayAgo } } },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "conversationId",
          as: "conv",
        },
      },
      { $unwind: { path: "$conv", preserveNullAndEmptyArrays: false } },
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
      { $project: { text: 1, isCreatedByUser: 1, createdAt: 1 } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ])
    .toArray();

  if (rows.length === 0) return "";

  // Map most-recent-first → role-prefixed lines, trimmed per-message.
  const lines = rows.map((m) => {
    const prefix = m.isCreatedByUser ? "[Child]" : "[AI]";
    const text = typeof m.text === "string" ? m.text : "";
    // Per-message cap: 500 chars, mirrors admin-chat/context pattern.
    const trimmed = text.length > 500 ? text.slice(0, 500) + "\u2026" : text;
    return `${prefix}: ${trimmed}`;
  });

  // Flip to chronological (oldest → newest) so the AI reads the day in order.
  lines.reverse();
  let joined = lines.join("\n");

  // Hard cap ~3000 input tokens (12000 chars). Keep most recent — trim from front.
  if (joined.length > 12000) {
    joined = "\u2026" + joined.slice(joined.length - 12000);
  }

  return joined;
}

/**
 * Aggregate per-child daily stats from MongoDB.
 * Returns DailyChildStats for ALL non-ADMIN users (even those with no activity).
 *
 * Each returned kid has:
 *   - totalMessages  — from the messages aggregation (0 for silent kids)
 *   - alertCount     — from email_notifications (type: safety_alert, last 24h)
 *   - conversationExcerpts — from getRecentConversations (fed to AI later)
 *   - summary / alertSummary — defaults ("" / null); populated by route.ts after AI calls
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
      // Step 2: Join conversation to get user field
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "conversationId",
          as: "conv",
        },
      },
      { $unwind: { path: "$conv", preserveNullAndEmptyArrays: true } },
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
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      // Step 4: Exclude ADMIN users
      { $match: { "userInfo.role": { $ne: "ADMIN" } } },
      // Step 5: Group by user name — just count messages now
      {
        $group: {
          _id: "$userInfo.name",
          totalMessages: { $sum: 1 },
        },
      },
      // Step 6: Sort by message count descending
      { $sort: { totalMessages: -1 } },
    ])
    .toArray();

  const kids = formatDailyStats(raw);

  // Merge zero-stat entries for kids who had no messages today.
  // The messages aggregation only returns kids who appeared in the collection,
  // so silent kids are absent. We fetch all non-ADMIN users and push a
  // zero-stat entry for each name not already in `kids`.
  const allUsers = await db
    .collection("users")
    .find({ role: { $ne: "ADMIN" } })
    .project<{ name: string }>({ name: 1 })
    .toArray();

  const seen = new Set(kids.map((k) => k.name));
  for (const user of allUsers) {
    if (user.name && !seen.has(user.name)) {
      kids.push({
        name: user.name,
        totalMessages: 0,
        alertCount: 0,
        summary: "",
        alertSummary: null,
        conversationExcerpts: "",
        imageSearchCount: 0,
        imageSearchQueries: [],
      });
    }
  }

  // Enrich each kid in parallel with alertCount + conversationExcerpts.
  // Both are pure DB reads; the AI-generated summary fields are populated by
  // the route layer AFTER this returns.
  await Promise.all(
    kids.map(async (kid) => {
      if (!kid.name || kid.name === "Unknown Child") {
        // Can't look up alerts / messages for an anonymous row.
        return;
      }
      const { getImageSearchStats } = await import("./image-search-summary");
      const [alertCount, conversationExcerpts, imageSearchStats] =
        await Promise.all([
          db.collection("email_notifications").countDocuments({
            type: "safety_alert",
            childName: kid.name,
            sentAt: { $gte: oneDayAgo },
          }),
          getRecentConversations(kid.name, db, 20),
          getImageSearchStats(kid.name, db),
        ]);
      kid.alertCount = alertCount;
      kid.conversationExcerpts = conversationExcerpts;
      kid.imageSearchCount = imageSearchStats.count;
      kid.imageSearchQueries = imageSearchStats.queries;
    }),
  );

  return kids;
}
