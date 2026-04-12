"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types (mirrors server-side NotificationRecipient)
// ---------------------------------------------------------------------------

interface RecipientAlerts {
  safetyAlerts: boolean;
  weeklyDigest: boolean;
  dailySummary: boolean;
  accountActivity: boolean;
}

interface Recipient {
  _id: string;
  email: string;
  name: string;
  alerts: RecipientAlerts;
}

const ALERT_LABELS: { key: keyof RecipientAlerts; label: string }[] = [
  { key: "safetyAlerts", label: "Safety Alerts" },
  { key: "weeklyDigest", label: "Weekly Digest" },
  { key: "dailySummary", label: "Daily Summary" },
  { key: "accountActivity", label: "Account Activity" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipientManager() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch recipients on mount
  const fetchRecipients = useCallback(async () => {
    try {
      const res = await fetch("/api/notification-recipients");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setRecipients(data);
    } catch {
      toast.error("Failed to load recipients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  // -------------------------------------------------------------------------
  // Add recipient
  // -------------------------------------------------------------------------

  async function handleAdd() {
    const trimmedName = addName.trim();
    const trimmedEmail = addEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      toast.error("Please enter both a name and email address");
      return;
    }

    // Optimistic add with a temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimistic: Recipient = {
      _id: tempId,
      name: trimmedName,
      email: trimmedEmail,
      alerts: {
        safetyAlerts: true,
        weeklyDigest: true,
        dailySummary: true,
        accountActivity: false,
      },
    };

    setRecipients((prev) => [...prev, optimistic]);
    setAddName("");
    setAddEmail("");
    setAdding(true);

    try {
      const res = await fetch("/api/notification-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to add recipient");
      }

      const created: Recipient = await res.json();
      // Replace optimistic entry with real one
      setRecipients((prev) =>
        prev.map((r) => (r._id === tempId ? created : r))
      );
      toast.success(`Added ${trimmedName}`);
    } catch (err) {
      // Revert optimistic add
      setRecipients((prev) => prev.filter((r) => r._id !== tempId));
      toast.error(err instanceof Error ? err.message : "Failed to add recipient");
    } finally {
      setAdding(false);
    }
  }

  // -------------------------------------------------------------------------
  // Remove recipient
  // -------------------------------------------------------------------------

  async function handleRemove(id: string) {
    const removed = recipients.find((r) => r._id === id);
    if (!removed) return;

    // Optimistic remove
    setRecipients((prev) => prev.filter((r) => r._id !== id));
    setRemovingId(id);

    try {
      const res = await fetch("/api/notification-recipients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Failed to remove recipient");
      toast.success(`Removed ${removed.name}`);
    } catch {
      // Revert
      setRecipients((prev) => [...prev, removed]);
      toast.error("Failed to remove recipient");
    } finally {
      setRemovingId(null);
    }
  }

  // -------------------------------------------------------------------------
  // Toggle alert type
  // -------------------------------------------------------------------------

  async function handleToggle(id: string, alertKey: keyof RecipientAlerts) {
    const recipient = recipients.find((r) => r._id === id);
    if (!recipient) return;

    const newValue = !recipient.alerts[alertKey];

    // Optimistic update
    setRecipients((prev) =>
      prev.map((r) =>
        r._id === id
          ? { ...r, alerts: { ...r.alerts, [alertKey]: newValue } }
          : r
      )
    );

    try {
      const res = await fetch("/api/notification-recipients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, alerts: { [alertKey]: newValue } }),
      });

      if (!res.ok) throw new Error("Failed to update alert preference");
    } catch {
      // Revert
      setRecipients((prev) =>
        prev.map((r) =>
          r._id === id
            ? { ...r, alerts: { ...r.alerts, [alertKey]: !newValue } }
            : r
        )
      );
      toast.error("Failed to update alert preference");
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            <div className="flex gap-4 mt-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-28" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recipient list */}
      {recipients.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            No recipients configured. Add an email address to start receiving
            alerts.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {recipients.map((r) => (
            <Card key={r._id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {r.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      — {r.email}
                    </span>
                  </p>
                  {/* Alert type toggles */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                    {ALERT_LABELS.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-1.5 cursor-pointer select-none text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={r.alerts[key]}
                          onChange={() => handleToggle(r._id, key)}
                          className="h-4 w-4 accent-primary cursor-pointer rounded"
                        />
                        <span className="text-muted-foreground whitespace-nowrap">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(r._id)}
                  disabled={removingId === r._id}
                  title={`Remove ${r.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add recipient form */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Add Recipient</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Name (e.g. Mom)"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            disabled={adding}
            className="sm:w-40"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Input
            placeholder="Email address"
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            disabled={adding}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Button
            onClick={handleAdd}
            disabled={adding || !addName.trim() || !addEmail.trim()}
            className="shrink-0"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Plus className="h-4 w-4 mr-1.5" />
            )}
            Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
