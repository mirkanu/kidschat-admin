"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { NotificationPrefs } from "@/app/api/users/route";

interface NotificationPrefsToggleProps {
  userId: string;
  initialPrefs?: NotificationPrefs;
}

export function NotificationPrefsToggle({
  userId,
  initialPrefs,
}: NotificationPrefsToggleProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    safetyAlerts: initialPrefs?.safetyAlerts ?? true,
    weeklyDigest: initialPrefs?.weeklyDigest ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function handleToggle(key: keyof NotificationPrefs) {
    const newPrefs: NotificationPrefs = { ...prefs, [key]: !prefs[key] };
    // Optimistic update
    setPrefs(newPrefs);
    setSaving(true);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_prefs: newPrefs }),
      });

      if (!res.ok) {
        // Revert on error
        setPrefs(prefs);
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update preferences");
      }
    } catch {
      // Revert on network error
      setPrefs(prefs);
      toast.error("Failed to update preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <label className={`flex items-center gap-1.5 cursor-pointer select-none ${saving ? "opacity-60" : ""}`}>
        <input
          type="checkbox"
          checked={prefs.safetyAlerts}
          onChange={() => handleToggle("safetyAlerts")}
          disabled={saving}
          className="h-3.5 w-3.5 accent-primary cursor-pointer"
        />
        <span className="text-muted-foreground whitespace-nowrap">Safety</span>
      </label>
      <label className={`flex items-center gap-1.5 cursor-pointer select-none ${saving ? "opacity-60" : ""}`}>
        <input
          type="checkbox"
          checked={prefs.weeklyDigest}
          onChange={() => handleToggle("weeklyDigest")}
          disabled={saving}
          className="h-3.5 w-3.5 accent-primary cursor-pointer"
        />
        <span className="text-muted-foreground whitespace-nowrap">Digest</span>
      </label>
    </div>
  );
}
