"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserSummary } from "@/app/api/users/route";

interface Props {
  mode: "create" | "edit";
  user?: UserSummary;
  onSuccess: (user: UserSummary) => void;
  onClose: () => void;
  open: boolean;
}

export function UserFormDialog({ mode, user, onSuccess, onClose, open }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">(user?.role ?? "USER");

  function handleClose() {
    setError(null);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (mode === "create") {
          if (!name || !email || !password || !role) {
            setError("All fields are required");
            return;
          }

          const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, role }),
          });

          const data = await res.json();

          if (!res.ok) {
            setError(data.error ?? "Failed to create user");
            return;
          }

          const newUser: UserSummary = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            lastActive: null,
            createdAt: new Date().toISOString(),
          };

          onSuccess(newUser);
          handleClose();
        } else {
          // Edit mode
          if (!user) return;

          const body: { name: string; role: "ADMIN" | "USER"; password?: string } = {
            name,
            role,
          };
          if (password) {
            body.password = password;
          }

          const res = await fetch(`/api/users/${user.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const data = await res.json();

          if (!res.ok) {
            setError(data.error ?? "Failed to update user");
            return;
          }

          const updatedUser: UserSummary = {
            ...user,
            name,
            role,
          };

          onSuccess(updatedUser);
          handleClose();
        }
      } catch {
        setError("An unexpected error occurred");
      }
    });
  }

  const title = mode === "create" ? "Add User" : "Edit User";
  const description =
    mode === "create"
      ? "Create a new account. The user can sign in immediately."
      : "Update account details. Leave password blank to keep current.";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required={mode === "create"}
              disabled={isPending || mode === "edit"}
              readOnly={mode === "edit"}
              className={mode === "edit" ? "bg-muted text-muted-foreground" : ""}
            />
            {mode === "edit" && (
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Password{mode === "edit" && " (optional)"}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "edit" ? "Leave blank to keep current" : "Password"}
              required={mode === "create"}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "ADMIN" | "USER")}
              disabled={isPending}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">Child (User)</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="active:scale-95">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
