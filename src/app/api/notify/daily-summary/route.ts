import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { getFromAddress } from "@/lib/email-utils";
import { getDailyChildStats } from "@/lib/daily-summary";

export async function POST(req: NextRequest) {
  // Auth: accept either a valid admin session OR a matching cron secret header
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");

  const hasCronAuth = cronSecret && headerSecret === cronSecret;

  if (!hasCronAuth) {
    // Fall back to session-based auth (admin manually triggering)
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const client = await getMongoClient();
  const db = client.db("test");

  // Gather per-child stats from last 24 hours
  const stats = await getDailyChildStats(db);

  // Primary: use notification_recipients collection (supports both parents)
  // Fallback: query ADMIN users if recipients collection is empty/not seeded yet
  const { getRecipientsForType } = await import("@/lib/notification-recipients");
  let toEmails = await getRecipientsForType("dailySummary");

  if (toEmails.length === 0) {
    // Backward compat: fall back to ADMIN users until recipients are configured
    const allAdmins = await db
      .collection("users")
      .find({ role: "ADMIN" })
      .project<{ email: string }>({ email: 1 })
      .toArray();

    toEmails = allAdmins
      .map((admin) => admin.email)
      .filter((email): email is string => typeof email === "string" && email.length > 0);
  }

  const date = getToday();

  // Nothing to send
  if (toEmails.length === 0 || stats.length === 0) {
    return NextResponse.json({
      sent: 0,
      children: stats.length,
      date,
      skipped: true,
      reason: toEmails.length === 0 ? "no_eligible_recipients" : "no_child_stats",
    });
  }

  // Lazy imports so this module is safe to import at build time
  const { resend } = await import("@/lib/resend");
  const { DailySummaryEmail } = await import("@/components/emails/daily-summary-email");

  // Send the daily summary email via Resend
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: toEmails,
    subject: `KidsChat Daily Summary \u2014 ${date}`,
    react: DailySummaryEmail({ children: stats, date }),
  });

  if (error) {
    console.error("[daily-summary] Resend error:", error);
    return NextResponse.json({ error: "Failed to send email", detail: error }, { status: 500 });
  }

  // Record send in email_notifications collection
  await db.collection("email_notifications").insertOne({
    type: "daily_summary",
    sentAt: new Date(),
    to: toEmails,
    date,
    resendId: data?.id ?? null,
    meta: { childStats: stats },
  });

  return NextResponse.json({
    sent: toEmails.length,
    children: stats.length,
    date,
  });
}

/**
 * Returns today's date as an ISO date string.
 */
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}
