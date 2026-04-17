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
      content: string;
      role?: string;
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
      { $project: { content: 1, role: 1, isCreatedByUser: 1, createdAt: 1 } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ])
    .toArray();

  if (rows.length === 0) return "";

  // Map most-recent-first → role-prefixed lines, trimmed per-message.
  const lines = rows.map((m) => {
    const prefix = m.isCreatedByUser ? "[Child]" : "[AI]";
    const content = typeof m.content === "string" ? m.content : "";
    // Per-message cap: 500 chars, mirrors admin-chat/context pattern.
    const trimmed = content.length > 500 ? content.slice(0, 500) + "\u2026" : content;
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
 * Returns DailyChildStats for all non-ADMIN users with messages in the last 24 hours.
 *
 * Each returned kid has:
 *   - totalMessages  — from the messages aggregation
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

  // Enrich each kid in parallel with alertCount + conversationExcerpts.
  // Both are pure DB reads; the AI-generated summary fields are populated by
  // the route layer AFTER this returns.
  await Promise.all(
    kids.map(async (kid) => {
      if (!kid.name || kid.name === "Unknown Child") {
        // Can't look up alerts / messages for an anonymous row.
        return;
      }
      const [alertCount, conversationExcerpts] = await Promise.all([
        db.collection("email_notifications").countDocuments({
          type: "safety_alert",
          childName: kid.name,
          sentAt: { $gte: oneDayAgo },
        }),
        getRecentConversations(kid.name, db, 20),
      ]);
      kid.alertCount = alertCount;
      kid.conversationExcerpts = conversationExcerpts;
    }),
  );

  return kids;
}
