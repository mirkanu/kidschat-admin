import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { getFromAddress } from "@/lib/email-utils";
import { getWeeklyChildStats } from "@/lib/weekly-digest";

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

  // Gather per-child stats from last 7 days
  const stats = await getWeeklyChildStats(db);

  // Query ADMIN users and filter to those who haven't opted out of weekly digests
  const allAdmins = await db
    .collection("users")
    .find({ role: "ADMIN" })
    .project<{ email: string; notification_prefs?: { weeklyDigest?: boolean } }>({
      email: 1,
      notification_prefs: 1,
    })
    .toArray();

  const eligibleAdmins = allAdmins.filter(
    (admin) => admin.notification_prefs?.weeklyDigest !== false
  );

  const toEmails = eligibleAdmins
    .map((admin) => admin.email)
    .filter((email): email is string => typeof email === "string" && email.length > 0);

  // Nothing to send
  if (toEmails.length === 0 || stats.length === 0) {
    return NextResponse.json({
      sent: 0,
      children: stats.length,
      weekOf: getWeekOf(),
      skipped: true,
      reason: toEmails.length === 0 ? "no_eligible_admins" : "no_child_stats",
    });
  }

  const weekOf = getWeekOf();

  // Lazy imports so this module is safe to import at build time
  const { resend } = await import("@/lib/resend");
  const { WeeklyDigestEmail } = await import("@/components/emails/weekly-digest-email");

  // Send the digest email via Resend
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: toEmails,
    subject: `KidsChat Weekly Activity Summary \u2014 Week of ${weekOf}`,
    react: WeeklyDigestEmail({ children: stats, weekOf }),
  });

  if (error) {
    console.error("[weekly-digest] Resend error:", error);
    return NextResponse.json({ error: "Failed to send email", detail: error }, { status: 500 });
  }

  // Record send in email_notifications collection
  await db.collection("email_notifications").insertOne({
    type: "weekly_digest",
    sentAt: new Date(),
    to: toEmails,
    weekOf,
    resendId: data?.id ?? null,
    meta: { childStats: stats },
  });

  return NextResponse.json({
    sent: toEmails.length,
    children: stats.length,
    weekOf,
  });
}

/**
 * Returns the ISO date string for 7 days ago (start of the reported week).
 */
function getWeekOf(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}
