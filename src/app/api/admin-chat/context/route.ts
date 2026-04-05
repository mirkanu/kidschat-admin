import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import type { AdminChatContext } from "@/lib/admin-system-prompt";

export async function GET() {
  // Auth guard: require authenticated ADMIN session
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const client = await getMongoClient();
    const db = client.db("test");

    // --- Users ---
    const rawUsers = await db
      .collection("users")
      .find({}, { projection: { name: 1, email: 1, role: 1 } })
      .toArray();

    const users = rawUsers.map((u) => ({
      name: (u.name as string) || "",
      email: (u.email as string) || "",
      role: (u.role as string) || "USER",
    }));

    // --- Message count last 24 hours ---
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const messageCountLast24h = await db
      .collection("messages")
      .countDocuments({ createdAt: { $gte: oneDayAgo } });

    // --- Safety alert count last 7 days ---
    // NOTE: Safety alerts in KidAI are detected client-side via pattern matching and are NOT
    // stored in MongoDB (there is no `alerts` or `safety_events` collection). Returning 0
    // until a future phase adds server-side alert persistence.
    const recentAlertCount = 0;

    // --- Recent conversation logs (last 50 messages, across all conversations) ---
    // Join with users to show which child sent each message.
    const recentMessages = await db
      .collection("messages")
      .aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 50 },
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
        {
          $project: {
            content: 1,
            role: 1,
            createdAt: 1,
            "userInfo.name": 1,
            "userInfo.email": 1,
          },
        },
      ])
      .toArray();

    // Format as "[User Name]: message content" lines
    // Reverse to chronological order (most recent last)
    const logLines = recentMessages
      .reverse()
      .map((msg) => {
        const sender =
          msg.role === "assistant"
            ? "[AI]"
            : `[${(msg.userInfo?.name as string) || (msg.userInfo?.email as string) || "Child"}]`;
        const content = (msg.content as string) || "";
        // Truncate very long messages for the context window
        const truncated =
          content.length > 500 ? content.slice(0, 500) + "…" : content;
        return `${sender}: ${truncated}`;
      });

    const recentConversationLogs =
      logLines.length > 0 ? logLines.join("\n") : undefined;

    const context: AdminChatContext = {
      systemPromptText: SYSTEM_PROMPT,
      users,
      recentAlertCount,
      messageCountLast24h,
      recentConversationLogs,
    };

    return NextResponse.json(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to assemble context: ${message}` },
      { status: 500 }
    );
  }
}
