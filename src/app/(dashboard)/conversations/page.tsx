import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ConversationsList } from "@/components/dashboard/conversations-list";
import getMongoClient from "@/lib/mongodb";

interface ConversationSummary {
  conversationId: string;
  title: string;
  updatedAt: string | null;
  userName: string | null;
  userEmail: string | null;
  isDeleted?: boolean;
}

async function getConversations(): Promise<ConversationSummary[]> {
  const client = await getMongoClient();
  const db = client.db("test");

  const buildPipeline = () => [
    // Join users by matching conversations.user (string) against users._id (ObjectId)
    {
      $lookup: {
        from: "users",
        let: { userId: "$user" },
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
    { $sort: { updatedAt: -1 } },
    {
      $project: {
        _id: 0,
        conversationId: 1,
        title: 1,
        updatedAt: 1,
        createdAt: 1,
        userName: "$userInfo.name",
        userEmail: "$userInfo.email",
      },
    },
  ];

  // Query live conversations
  const liveConversations = await db
    .collection("conversations")
    .aggregate<ConversationSummary>(buildPipeline())
    .toArray();

  // Query archived conversations (may include deleted ones)
  const archivedConversations = await db
    .collection("archived_conversations")
    .aggregate<ConversationSummary>(buildPipeline())
    .toArray();

  // Build a set of live conversation IDs for deduplication
  const liveIds = new Set(liveConversations.map((c) => c.conversationId));

  // Only include archived conversations that are no longer in the live collection
  // (i.e., they were deleted by the child)
  const deletedConversations = archivedConversations
    .filter((c) => !liveIds.has(c.conversationId))
    .map((c) => ({ ...c, isDeleted: true }));

  // Merge: live first (most recent activity), then deleted ones
  const all = [...liveConversations, ...deletedConversations]
    .sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 100);

  // Serialize dates to ISO strings
  return all.map((c) => ({
    ...c,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
  }));
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
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All children&apos;s chat history — including conversations deleted by
          children (shown with a &quot;Deleted&quot; badge)
        </p>
      </div>

      <ConversationsList
        initialConversations={conversations}
        children={childNames}
      />
    </div>
  );
}
