/**
 * Core safety alert notification logic.
 *
 * Extracted into a standalone lib so it can be called from:
 *  - Server components (e.g. alerts page) without an internal HTTP round-trip
 *  - API route (POST /api/notify/safety-alert) for external callers
 *
 * Deduplication: within a 1-hour window, the same conversationId + matchedPattern
 * combination only sends one email.
 */

import type { SafetyEvent } from "@/lib/safety-patterns";
import { getFromAddress, getAdminUrl } from "@/lib/email-utils";

export interface NotifySafetyAlertInput {
  childName: string;
  alertType: "safety_redirect" | "jailbreak_attempt" | "image_prompt";
  matchedPattern: string;
  messageExcerpt: string;
  detectedAt: string;
  conversationId: string;
}

export interface NotifySafetyAlertResult {
  sent: number;
  id?: string;
  reason?: string;
}

/**
 * Sends a safety alert email to all ADMIN users who have not opted out.
 * Returns immediately if dedup check finds a recent duplicate.
 */
export async function notifySafetyAlert(
  input: NotifySafetyAlertInput
): Promise<NotifySafetyAlertResult> {
  const { childName, alertType, matchedPattern, messageExcerpt, detectedAt, conversationId } =
    input;

  // Lazy imports so this module is safe to import at build time
  const getMongoClient = (await import("@/lib/mongodb")).default;
  const { resend } = await import("@/lib/resend");
  const { SafetyAlertEmail } = await import(
    "@/components/emails/safety-alert-email"
  );

  const client = await getMongoClient();
  const db = client.db("test");

  // --- Dedup check ---
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await db.collection("email_notifications").findOne({
    type: "safety_alert",
    "meta.conversationId": conversationId,
    "meta.matchedPattern": matchedPattern,
    sentAt: { $gte: oneHourAgo },
  });

  if (existing) {
    return { sent: 0, reason: "duplicate" };
  }

  // --- Find recipients for safety alerts ---
  // Primary: use notification_recipients collection (supports both parents)
  // Fallback: query ADMIN users if recipients collection is empty/not seeded yet
  const { getRecipientsForType } = await import("@/lib/notification-recipients");
  let toEmails = await getRecipientsForType("safetyAlerts");

  if (toEmails.length === 0) {
    // Backward compat: fall back to ADMIN users until recipients are configured
    const adminUsers = await db
      .collection("users")
      .find({ role: "ADMIN" })
      .project({ email: 1, notification_prefs: 1 })
      .toArray();

    toEmails = adminUsers
      .filter((u) => u.notification_prefs?.safetyAlerts !== false)
      .map((u) => u.email as string)
      .filter(Boolean);
  }

  if (toEmails.length === 0) {
    return { sent: 0, reason: "no_recipients" };
  }

  // --- Build and send email ---
  const conversationUrl = `${getAdminUrl()}/conversations/${conversationId}`;
  const subject =
    alertType === "image_prompt"
      ? `Image Alert: Inappropriate image request detected for ${childName}`
      : alertType === "jailbreak_attempt"
        ? `Safety Alert: Jailbreak Attempt detected for ${childName}`
        : `Safety Alert: Safety Redirect detected for ${childName}`;

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: toEmails,
    subject,
    react: SafetyAlertEmail({
      childName,
      alertType,
      matchedPattern,
      messageExcerpt,
      detectedAt,
      conversationUrl,
    }),
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }

  // --- Record notification to prevent duplicates ---
  await db.collection("email_notifications").insertOne({
    type: "safety_alert",
    sentAt: new Date(),
    to: toEmails,
    childName,
    resendId: data?.id,
    meta: input,
  });

  return { sent: toEmails.length, id: data?.id };
}

/**
 * Notify for a batch of safety alerts (e.g. from the alerts page on page load).
 * Only considers alerts from the last 24 hours.
 * Errors are caught per-alert so one failure doesn't block the rest.
 */
export async function notifyNewAlerts(alerts: SafetyEvent[]): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentAlerts = alerts.filter(
    (a) => new Date(a.detectedAt) >= cutoff
  );

  for (const alert of recentAlerts) {
    try {
      await notifySafetyAlert({
        childName: alert.childName,
        alertType: alert.type,
        matchedPattern: alert.matchedPattern,
        messageExcerpt: alert.messageText,
        detectedAt: alert.detectedAt,
        conversationId: alert.conversationId,
      });
    } catch {
      // Never let email failures surface to the UI
      // Errors are swallowed intentionally — email delivery is best-effort
    }
  }
}
