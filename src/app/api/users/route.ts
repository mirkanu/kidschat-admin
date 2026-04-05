import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMongoClient } from "@/lib/mongodb";
import bcryptjs from "bcryptjs";

export interface NotificationPrefs {
  safetyAlerts: boolean;
  weeklyDigest: boolean;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  lastActive: string | null;
  createdAt: string;
  notification_prefs?: NotificationPrefs;
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  const rawUsers = await db
    .collection("users")
    .find({}, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  const users: UserSummary[] = rawUsers.map((u) => ({
    id: u._id.toString(),
    name: u.name ?? "",
    email: u.email ?? "",
    role: u.role ?? "USER",
    lastActive: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
    notification_prefs: u.notification_prefs as NotificationPrefs | undefined,
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, email, password, role } = body;

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (role !== "ADMIN" && role !== "USER") {
    return NextResponse.json({ error: "Role must be ADMIN or USER" }, { status: 400 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashedPassword = await bcryptjs.hash(password, 12);
  const now = new Date();

  const result = await db.collection("users").insertOne({
    name,
    email: email.toLowerCase(),
    username: email.split("@")[0],
    password: hashedPassword,
    role,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      user: {
        id: result.insertedId.toString(),
        name,
        email: email.toLowerCase(),
        role,
      },
    },
    { status: 201 }
  );
}
