/**
 * POST /api/cron/cost-ledger-sweep
 *
 * Polls new AI-response messages since lastPoll, calculates cost per message,
 * inserts to cost_ledger collection, and updates lastPoll timestamp.
 * Idempotent across runs — deduplicates on messageId.
 *
 * Schedule: every 2 minutes
 * Auth: x-cron-secret header
 */
import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { calculateMessageCostEUR, estimateInputTokens, estimateOutputTokens } from "@/lib/cost-ledger";

const EUR_RATE = parseFloat(process.env.USD_TO_EUR_RATE ?? "0.92");
const DEFAULT_LOOKBACK_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");
  type CronStateDoc = { _id?: string; lastPoll?: Date };
  const cronStateCol = db.collection<CronStateDoc>("cron_state");

  // Read lastPoll from cron_state, default to 5 minutes ago
  const cronState = await cronStateCol.findOne({ _id: "cost_ledger_sweep" } as Parameters<typeof cronStateCol.findOne>[0]);
  const lastPoll: Date = cronState?.lastPoll instanceof Date
    ? cronState.lastPoll
    : new Date(Date.now() - DEFAULT_LOOKBACK_MS);

  const now = new Date();

  // Fetch new AI-response messages (isCreatedByUser:false) since lastPoll
  const newMessages = await db
    .collection("messages")
    .find({
      isCreatedByUser: false,
      createdAt: { $gt: lastPoll, $lte: now },
    })
    .toArray();

  if (newMessages.length === 0) {
    // Update lastPoll even on empty run
    await cronStateCol.updateOne(
      { _id: "cost_ledger_sweep" } as Parameters<typeof cronStateCol.updateOne>[0],
      { $set: { lastPoll: now } },
      { upsert: true }
    );
    return NextResponse.json({ processed: 0, inserted: 0 });
  }

  // Get user info to filter out ADMIN messages
  const conversationIds = [...new Set(newMessages.map((m) => m.conversationId as string).filter(Boolean))];
  const conversations = await db
    .collection("conversations")
    .find({ conversationId: { $in: conversationIds } })
    .toArray();

  const convMap = new Map<string, string>();
  for (const conv of conversations) {
    convMap.set(conv.conversationId as string, conv.user as string);
  }

  // Get user roles
  const userIds = [...new Set([...convMap.values()].filter(Boolean))];
  const { ObjectId } = await import("mongodb");
  const validObjectIds = userIds
    .filter((id) => {
      try { new ObjectId(id); return true; } catch { return false; }
    })
    .map((id) => new ObjectId(id));

  const users = validObjectIds.length > 0
    ? await db.collection("users").find({ _id: { $in: validObjectIds } }).project({ _id: 1, role: 1 }).toArray()
    : [];

  const userRoleMap = new Map<string, string>();
  for (const u of users) {
    userRoleMap.set(u._id.toString(), (u.role as string) ?? "USER");
  }

  // Get already-processed messageIds to dedup
  const messageIds = newMessages.map((m) => m.messageId as string).filter(Boolean);
  const existing = await db
    .collection("cost_ledger")
    .find({ messageId: { $in: messageIds } })
    .project({ messageId: 1 })
    .toArray();
  const existingIds = new Set(existing.map((e) => e.messageId as string));

  let processed = 0;
  let inserted = 0;

  for (const msg of newMessages) {
    processed++;
    const msgId = msg.messageId as string;

    // Skip already processed
    if (existingIds.has(msgId)) continue;

    // Resolve userId via conversation
    const userId = convMap.get(msg.conversationId as string);
    if (!userId) continue;

    // Skip ADMIN users
    const role = userRoleMap.get(userId);
    if (role === "ADMIN") continue;

    // Calculate cost using char-formula (tokenCount is flat int, no input/output split)
    const tokenCount = (msg.tokenCount as number | undefined) ?? 0;
    const text = (msg.text as string | undefined) ?? "";

    // Use token count if available, otherwise estimate from text length
    const outputTokens = tokenCount > 0 ? tokenCount : estimateOutputTokens({ text });
    const inputTokens = estimateInputTokens({ text });

    const { costEUR } = calculateMessageCostEUR({
      inputTokens,
      outputTokens,
      imageCount: 0, // Image costs are tracked separately via files collection
      eurRate: EUR_RATE,
    });

    await db.collection("cost_ledger").insertOne({
      messageId: msgId,
      userId,
      costEUR,
      recordedAt: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt as string),
    });

    inserted++;
  }

  // Update lastPoll
  await cronStateCol.updateOne(
    { _id: "cost_ledger_sweep" } as Parameters<typeof cronStateCol.updateOne>[0],
    { $set: { lastPoll: now } },
    { upsert: true }
  );

  return NextResponse.json({ processed, inserted });
}
