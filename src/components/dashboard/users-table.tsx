"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserFormDialog } from "@/components/dashboard/user-form-dialog";
import { NotificationPrefsToggle } from "@/components/dashboard/notification-prefs-toggle";
import type { UserSummary } from "@/app/api/users/route";

interface Props {
  initialUsers: UserSummary[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function UsersTable({ initialUsers }: Props) {
  const [users, setUsers] = useState<UserSummary[]>(initialUsers);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setSelectedUser(null);
    setDialogMode("create");
  }

  function openEdit(user: UserSummary) {
    setSelectedUser(user);
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedUser(null);
  }

  function handleCreateSuccess(newUser: UserSummary) {
    setUsers((prev) => [newUser, ...prev]);
    toast.success("Account created");
  }

  function handleEditSuccess(updatedUser: UserSummary) {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    toast.success("Account updated");
  }

  async function handleDelete(user: UserSummary) {
    const confirmed = window.confirm(
      `Delete ${user.name}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(user.id);

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete account");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("Account deleted");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">
            {users.length} account{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} className="active:scale-95">
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Notifications</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                    >
                      {user.role === "ADMIN" ? "Admin" : "Child"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.role === "ADMIN" ? (
                      <NotificationPrefsToggle
                        userId={user.id}
                        initialPrefs={user.notification_prefs}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.lastActive)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(user)}
                        className="active:scale-95"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                        className="active:scale-95"
                      >
                        {deletingId === user.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {dialogMode === "create" && (
        <UserFormDialog
          mode="create"
          open={true}
          onSuccess={handleCreateSuccess}
          onClose={closeDialog}
        />
      )}

      {dialogMode === "edit" && selectedUser && (
        <UserFormDialog
          mode="edit"
          user={selectedUser}
          open={true}
          onSuccess={handleEditSuccess}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
