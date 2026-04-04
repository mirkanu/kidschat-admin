import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { getMongoClient } from "@/lib/mongodb";
import bcryptjs from "bcryptjs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = await request.json();
  const { name, role, password } = body;

  if (!name && !role && !password) {
    return NextResponse.json({ error: "At least one field is required" }, { status: 400 });
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() };

  if (name !== undefined) $set.name = name;
  if (role !== undefined) $set.role = role;
  if (password) {
    $set.password = await bcryptjs.hash(password, 12);
  }

  const client = await getMongoClient();
  const db = client.db("test");

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(userId);
  } catch {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const result = await db
    .collection("users")
    .updateOne({ _id: objectId }, { $set });

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  // Prevent self-deletion
  const sessionUserId = (session.user as { id?: string })?.id;
  if (sessionUserId === userId) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const client = await getMongoClient();
  const db = client.db("test");

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(userId);
  } catch {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const result = await db.collection("users").deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
