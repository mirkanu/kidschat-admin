"use client";

import { RecipientManager } from "@/components/dashboard/recipient-manager";

export function NotificationSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notification Recipients</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add email addresses for parents who should receive alerts. Each
          recipient can opt into specific alert types.
        </p>
      </div>

      <RecipientManager />

      <p className="text-xs text-muted-foreground border-t pt-4">
        <span className="font-medium">Alert types:</span> Safety Alerts
        (immediate), Daily Summary (daily at 8am UTC), Weekly Digest (Mondays at
        8am UTC), Account Activity (on login/settings changes)
      </p>
    </div>
  );
}
