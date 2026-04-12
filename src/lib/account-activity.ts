/**
 * Account activity notification sender.
 *
 * Sends email alerts for login events, settings changes, and recipient
 * management. Opt-in only (accountActivity defaults false in recipients).
 *
 * Dedup: same activityType + performedBy within 5 minutes prevents spam
 * (e.g. rapid login retries).
 */

import { getFromAddress, getAdminUrl } from "@/lib/email-utils";

export type AccountActivityType =
  | "login"
  | "settings_change"
  | "recipient_added"
  | "recipient_removed";

export interface NotifyAccountActivityInput {
  activityType: AccountActivityType;
  description: string;
  performedBy: string;
  ipAddress?: string;
}

export interface NotifyAccountActivityResult {
  sent: number;
  id?: string;
  reason?: string;
}

const ACTIVITY_LABELS: Record<AccountActivityType, string> = {
  login: "Login",
  settings_change: "Settings Change",
  recipient_added: "Recipient Added",
  recipient_removed: "Recipient Removed",
};

export async function notifyAccountActivity(
  input: NotifyAccountActivityInput
): Promise<NotifyAccountActivityResult> {
  const { activityType, description, performedBy, ipAddress } = input;

  // Lazy imports — safe at build time
  const getMongoClient = (await import("@/lib/mongodb")).default;
  const { getRecipientsForType } = await import("@/lib/notification-recipients");

  // Opt-in only — no ADMIN fallback (this is a new feature, defaults off)
  const toEmails = await getRecipientsForType("accountActivity");
  if (toEmails.length === 0) {
    return { sent: 0, reason: "no_recipients" };
  }

  const client = await getMongoClient();
  const db = client.db("test");

  // --- Dedup: same activityType + performedBy within 5 minutes ---
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const existing = await db.collection("email_notifications").findOne({
    type: "account_activity",
    "meta.activityType": activityType,
    "meta.performedBy": performedBy,
    sentAt: { $gte: fiveMinutesAgo },
  });

  if (existing) {
    return { sent: 0, reason: "duplicate" };
  }

  // --- Send email ---
  const { resend } = await import("@/lib/resend");
  const { AccountActivityEmail } = await import(
    "@/components/emails/account-activity-email"
  );

  const activityLabel = ACTIVITY_LABELS[activityType];
  const timestamp = new Date().toISOString();

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: toEmails,
    subject: `KidsChat Account Activity \u2014 ${activityLabel}`,
    react: AccountActivityEmail({
      activityType: activityLabel,
      description,
      performedBy,
      timestamp,
      dashboardUrl: getAdminUrl(),
    }),
  });

  if (error) {
    console.error("[account-activity] Resend error:", error);
    throw new Error(`Resend API error: ${error.message}`);
  }

  // --- Record notification ---
  await db.collection("email_notifications").insertOne({
    type: "account_activity",
    sentAt: new Date(),
    to: toEmails,
    resendId: data?.id ?? null,
    meta: { activityType, description, performedBy, ipAddress },
  });

  return { sent: toEmails.length, id: data?.id };
}
