import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ConversationsList } from "@/components/dashboard/conversations-list";

interface ConversationSummary {
  conversationId: string;
  title: string;
  updatedAt: string | null;
  userName: string | null;
  userEmail: string | null;
}

async function getConversations(): Promise<ConversationSummary[]> {
  const baseUrl =
    process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/conversations`, {
    // Revalidate frequently — conversations change often
    next: { revalidate: 30 },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { conversations: ConversationSummary[] };
  return data.conversations ?? [];
}

export default async function ConversationsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const conversations = await getConversations();

  // Derive unique child names for filter tabs (informational — tabs are hardcoded for now)
  const childNames = Array.from(
    new Set(
      conversations.map((c) => c.userName).filter((n): n is string => !!n)
    )
  );

  return (
    <div className="p-6 space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All children&apos;s chat history
        </p>
      </div>

      <ConversationsList
        initialConversations={conversations}
        children={childNames}
      />
    </div>
  );
}
