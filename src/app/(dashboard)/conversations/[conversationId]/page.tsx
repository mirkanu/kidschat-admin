import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { MessageThread } from "@/components/dashboard/message-thread";
import getMongoClient from "@/lib/mongodb";

interface ImageAttachment {
  fileId: string;
  url: string;
  width?: number;
  height?: number;
}

interface MessageItem {
  messageId: string;
  text: string;
  isCreatedByUser: boolean;
  sender: string;
  createdAt: string;
  images: ImageAttachment[];
}

interface ConversationDetailData {
  conversation: {
    conversationId: string;
    title: string;
    preset?: "image-search";
  };
  messages: MessageItem[];
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { conversationId } = await params;

  const client = await getMongoClient();
  const db = client.db("test");

  // Fetch conversation metadata
  const conversation = await db
    .collection("conversations")
    .findOne({ conversationId });

  if (!conversation) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground text-lg">
          Conversation not found.
        </p>
        <Link
          href="/conversations"
          className="text-primary underline underline-offset-4 hover:opacity-80"
        >
          Back to conversations
        </Link>
      </div>
    );
  }

  // Fetch messages
  const rawMessages = await db
    .collection("messages")
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .toArray();

  const LIBRECHAT_BASE = "https://librechat-production-bff2.up.railway.app";

  const messages: MessageItem[] = rawMessages.map((msg) => {
    // LibreChat stores AI responses in content[] blocks, not the text field
    let text = msg.text ?? "";
    if (!text && Array.isArray(msg.content)) {
      text = msg.content
        .filter((b: { type: string; text?: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n\n");
    }

    // Extract image attachments (e.g. DALL-E generated images)
    const images: ImageAttachment[] = [];
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments as Array<{
        file_id?: string;
        filepath?: string;
        type?: string;
        width?: number;
        height?: number;
      }>) {
        if (att.type?.startsWith("image/") && att.filepath) {
          images.push({
            fileId: att.file_id ?? "",
            url: att.filepath.startsWith("http")
              ? att.filepath
              : `${LIBRECHAT_BASE}${att.filepath}`,
            width: att.width,
            height: att.height,
          });
        }
      }
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
      images,
    };
  });

  // Phase 21-04 OVERSIGHT-02: derive preset badge from conversation.spec
  const convSpec =
    typeof conversation.spec === "string" ? conversation.spec : null;
  const preset: "image-search" | undefined =
    convSpec === "image-search" ? "image-search" : undefined;

  const data: ConversationDetailData = {
    conversation: {
      conversationId: conversation.conversationId ?? conversationId,
      title: conversation.title ?? "Untitled Conversation",
      preset,
    },
    messages,
  };

  return (
    <div>
      <MessageThread
        conversation={data.conversation}
        messages={data.messages}
      />
    </div>
  );
}
