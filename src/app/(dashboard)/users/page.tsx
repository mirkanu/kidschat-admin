import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UsersTable } from "@/components/dashboard/users-table";
import type { UserSummary } from "@/app/api/users/route";
import getMongoClient from "@/lib/mongodb";

async function getUsers(): Promise<UserSummary[]> {
  try {
    const client = await getMongoClient();
    const db = client.db("test");

    const rawUsers = await db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return rawUsers.map((u) => ({
      id: u._id.toString(),
      name: u.name ?? "",
      email: u.email ?? "",
      role: u.role ?? "USER",
      lastActive: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
      createdAt: u.createdAt
        ? new Date(u.createdAt).toISOString()
        : new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const users = await getUsers();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage all accounts</p>
      </div>

      <UsersTable initialUsers={users} />
    </div>
  );
}
