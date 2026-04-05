import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";

interface MessageItem {
  messageId: string;
  text: string;
  isCreatedByUser: boolean;
  sender: string;
  createdAt: string; // ISO string
}

interface ConversationDetail {
  conversationId: string;
  title: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;

  const client = await getMongoClient();
  const db = client.db("test");

  // Fetch conversation metadata
  const conversation = await db
    .collection("conversations")
    .findOne({ conversationId });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Fetch messages sorted chronologically
  const rawMessages = await db
    .collection("messages")
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .toArray();

  const messages: MessageItem[] = rawMessages.map((msg) => {
    let text = msg.text ?? "";
    if (!text && Array.isArray(msg.content)) {
      text = msg.content
        .filter((b: { type: string; text?: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n\n");
    }
    return {
      messageId: msg.messageId ?? msg._id.toString(),
      text,
      isCreatedByUser: Boolean(msg.isCreatedByUser),
      sender: msg.sender ?? "Unknown",
      createdAt:
        msg.createdAt instanceof Date
          ? msg.createdAt.toISOString()
          : String(msg.createdAt ?? ""),
    };
  });

  const conversationDetail: ConversationDetail = {
    conversationId: conversation.conversationId ?? conversationId,
    title: conversation.title ?? "Untitled Conversation",
  };

  return NextResponse.json({ conversation: conversationDetail, messages });
}
