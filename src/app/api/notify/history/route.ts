import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMongoClient } from "@/lib/mongodb";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  const notifications = await db
    .collection("email_notifications")
    .find({})
    .sort({ sentAt: -1 })
    .limit(100)
    .toArray();

  const serialized = notifications.map((n) => ({
    ...n,
    _id: n._id.toString(),
    sentAt: n.sentAt instanceof Date ? n.sentAt.toISOString() : String(n.sentAt ?? ""),
  }));

  return NextResponse.json({ notifications: serialized });
}
