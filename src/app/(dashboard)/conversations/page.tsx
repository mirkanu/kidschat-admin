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
  preset?: "image-search";
}

async function getConversations(): Promise<ConversationSummary[]> {
  const client = await getMongoClient();
  const db = client.db("test");

  const pipeline = [
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
        // Phase 21-04 OVERSIGHT-02: project modelSpec name so the list can
        // render a preset badge. LibreChat stores this as `conversations.spec`
        // (verified by scripts/probe-conv.ts against claude-test's Phase 20
        // conversations — every Image Search row has spec:"image-search").
        spec: 1,
      },
    },
  ];

  type ConversationSummaryRaw = ConversationSummary & { spec?: string | null };

  const conversations = await db
    .collection("conversations")
    .aggregate<ConversationSummaryRaw>(pipeline)
    .toArray();

  // Serialize dates to ISO strings and derive preset field
  return conversations
    .slice(0, 100)
    .map((c) => {
      const { spec, ...rest } = c;
      const preset: ConversationSummary["preset"] =
        spec === "image-search" ? "image-search" : undefined;
      return {
        ...rest,
        updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
        preset,
      };
    });
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
