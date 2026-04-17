import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";
import getMongoClient from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  lastActive: string | null;
}

async function getUser(userId: string): Promise<User | null> {
  try {
    const client = await getMongoClient();
    const db = client.db("test");

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(userId);
    } catch {
      return null;
    }

    const user = await db
      .collection("users")
      .findOne({ _id: objectId }, { projection: { password: 0 } });

    if (!user) return null;

    return {
      id: user._id.toString(),
      name: (user.name as string) ?? "",
      email: (user.email as string) ?? "",
      role: (user.role as string) ?? "USER",
      createdAt: user.createdAt
        ? new Date(user.createdAt as Date).toISOString()
        : new Date().toISOString(),
      lastActive: user.updatedAt ? new Date(user.updatedAt as Date).toISOString() : null,
    };
  } catch {
    return null;
  }
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "Never";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { userId } = await params;
  const user = await getUser(userId);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb nav */}
      <div>
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>
      </div>

      {/* Page heading */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        </div>
        <Badge variant={user.role === "ADMIN" ? "destructive" : "secondary"}>
          {user.role}
        </Badge>
      </div>

      {/* User metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="font-medium mt-0.5">{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last active</dt>
              <dd className="font-medium mt-0.5">{formatDate(user.lastActive)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="font-mono text-xs mt-0.5 text-muted-foreground">{user.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium mt-0.5">{user.role}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

    </div>
  );
}
