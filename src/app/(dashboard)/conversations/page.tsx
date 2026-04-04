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
}

async function getConversations(): Promise<ConversationSummary[]> {
  const client = await getMongoClient();
  const db = client.db("test");

  const pipeline: object[] = [
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
    { $limit: 100 },
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

  const conversations = await db
    .collection("conversations")
    .aggregate<ConversationSummary>(pipeline)
    .toArray();

  // Serialize dates to ISO strings
  return conversations.map((c) => ({
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
