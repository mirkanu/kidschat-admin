import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";

interface ConversationSummary {
  conversationId: string;
  title: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const child = searchParams.get("child") ?? "all";

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
  ];

  // Filter by child name
  if (child === "sebastian" || child === "penelope") {
    pipeline.push({
      $match: {
        "userInfo.name": { $regex: child, $options: "i" },
      },
    });
  }

  // Filter by search keyword on title
  if (search) {
    pipeline.push({
      $match: {
        title: { $regex: search, $options: "i" },
      },
    });
  }

  pipeline.push(
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
    }
  );

  const conversations = await db
    .collection("conversations")
    .aggregate<ConversationSummary>(pipeline)
    .toArray();

  // Serialize dates to ISO strings
  const serialized = conversations.map((c) => ({
    ...c,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
  }));

  return NextResponse.json({ conversations: serialized });
}
