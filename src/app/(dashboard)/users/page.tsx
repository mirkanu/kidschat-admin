import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UsersTable } from "@/components/dashboard/users-table";
import type { UserSummary } from "@/app/api/users/route";

async function fetchUsers(): Promise<UserSummary[]> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/users`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.users ?? [];
  } catch {
    return [];
  }
}

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const users = await fetchUsers();

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
