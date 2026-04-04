import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { MessageThread } from "@/components/dashboard/message-thread";

interface MessageItem {
  messageId: string;
  text: string;
  isCreatedByUser: boolean;
  sender: string;
  createdAt: string;
}

interface ConversationDetailData {
  conversation: {
    conversationId: string;
    title: string;
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

  const baseUrl =
    process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/conversations/${conversationId}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    // 404 or other error
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

  const data: ConversationDetailData = await res.json();

  return (
    <div className="p-6">
      <MessageThread
        conversation={data.conversation}
        messages={data.messages}
      />
    </div>
  );
}
