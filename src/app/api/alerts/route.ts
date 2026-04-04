import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { detectSafetyEvent, type SafetyEvent } from "@/lib/safety-patterns";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "90", 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const client = await getMongoClient();
  const db = client.db("test");

  // Fetch recent messages — limit to prevent memory issues
  const rawMessages = await db
    .collection("messages")
    .find({ createdAt: { $gte: cutoff } })
    .sort({ createdAt: -1 })
    .limit(5000)
    .toArray();

  // Run pattern detection in JS
  const matchedMessages = rawMessages
    .map((msg) => {
      const text: string = msg.text ?? "";
      const isUser: boolean = Boolean(msg.isCreatedByUser);
      const result = detectSafetyEvent(text, isUser);
      if (!result.detected) return null;
      return {
        conversationId: msg.conversationId as string,
        messageText: text.slice(0, 150),
        type: result.type!,
        matchedPattern: result.matchedPattern!,
        detectedAt:
          msg.createdAt instanceof Date
            ? msg.createdAt.toISOString()
            : String(msg.createdAt ?? ""),
      };
    })
    .filter(
      (
        m
      ): m is {
        conversationId: string;
        messageText: string;
        type: SafetyEvent["type"];
        matchedPattern: string;
        detectedAt: string;
      } => m !== null
    );

  if (matchedMessages.length === 0) {
    return NextResponse.json({ alerts: [], totalCount: 0 });
  }

  // Batch-lookup conversation metadata for matched messages
  const conversationIds = [
    ...new Set(matchedMessages.map((m) => m.conversationId)),
  ];

  const conversations = await db
    .collection("conversations")
    .find({ conversationId: { $in: conversationIds } })
    .toArray();

  // Build lookup map: conversationId -> { title, user (userId string) }
  const convMap = new Map<string, { title: string; user: string }>();
  for (const conv of conversations) {
    convMap.set(conv.conversationId as string, {
      title: (conv.title as string) ?? "Untitled Conversation",
      user: (conv.user as string) ?? "",
    });
  }

  // Collect unique user IDs and lookup user names
  const userIds = [...new Set(conversations.map((c) => c.user as string).filter(Boolean))];

  // users._id is ObjectId; conversations.user is plain string representation
  const { ObjectId } = await import("mongodb");
  const validObjectIds = userIds
    .filter((id) => {
      try {
        new ObjectId(id);
        return true;
      } catch {
        return false;
      }
    })
    .map((id) => new ObjectId(id));

  const users = validObjectIds.length
    ? await db
        .collection("users")
        .find({ _id: { $in: validObjectIds } })
        .project({ _id: 1, name: 1 })
        .toArray()
    : [];

  // Build user lookup: userId string -> name
  const userMap = new Map<string, string>();
  for (const user of users) {
    userMap.set(user._id.toString(), (user.name as string) ?? "Unknown");
  }

  // Assemble final SafetyEvent objects
  const alerts: SafetyEvent[] = matchedMessages.map((m) => {
    const conv = convMap.get(m.conversationId);
    const childName = conv ? (userMap.get(conv.user) ?? "Unknown Child") : "Unknown Child";
    return {
      type: m.type,
      conversationId: m.conversationId,
      conversationTitle: conv?.title ?? "Untitled Conversation",
      childName,
      messageText: m.messageText,
      detectedAt: m.detectedAt,
      matchedPattern: m.matchedPattern,
    };
  });

  // Sort newest first
  alerts.sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );

  return NextResponse.json({ alerts, totalCount: alerts.length });
}
