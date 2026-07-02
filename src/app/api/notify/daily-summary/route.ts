import { NextRequest, NextResponse } from "next/server";
import type { Db } from "mongodb";
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

  // Optional test override: ?testEmail=... sends only to the specified address.
  // Requires cron auth or admin session (already checked above).
  const { searchParams } = new URL(req.url);
  const testEmail = searchParams.get("testEmail");

  const client = await getMongoClient();
  const db = client.db("test");

  // Gather per-child stats from last 24 hours.
  // Each kid arrives with alertCount + conversationExcerpts populated; AI
  // summary fields are still empty and get filled in below.
  const stats = await getDailyChildStats(db);

  // Primary: use notification_recipients collection (supports both parents)
  // Fallback: query ADMIN users if recipients collection is empty/not seeded yet
  let toEmails: string[];

  if (testEmail) {
    // Test mode: send only to the specified address, skip normal recipient logic.
    toEmails = [testEmail];
  } else {
    const { getRecipientsForType } = await import("@/lib/notification-recipients");
    toEmails = await getRecipientsForType("dailySummary");

    if (toEmails.length === 0) {
      const allAdmins = await db
        .collection("users")
        .find({ role: "ADMIN" })
        .project<{ email: string }>({ email: 1 })
        .toArray();

      toEmails = allAdmins
        .map((admin) => admin.email)
        .filter((email): email is string => typeof email === "string" && email.length > 0);
    }
  }

  const date = getToday();

  // Skip only when there are no recipient email addresses.
  // An empty stats array (all-quiet day) still triggers a send so parents
  // always receive the email, even when kids had no activity.
  if (toEmails.length === 0) {
    return NextResponse.json({
      sent: 0,
      children: stats.length,
      date,
      skipped: true,
      reason: "no_eligible_recipients",
    });
  }

  const allQuiet = stats.every(
    (k) => k.totalMessages === 0 && k.imageSearchCount === 0,
  );

  // --- Enrich with AI-generated per-kid summaries + alert paraphrases ---
  // Both calls run concurrently across kids; per-kid try/catch ensures one
  // failure doesn't block any other kid or the overall email send.
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { summarizeChildDay, summarizeAlerts } = await import("@/lib/ai-summary");

  await Promise.all(
    stats.map(async (kid) => {
      // (a) Child day summary — includes image-search queries so the paraphrase
      //     weaves them into the single summary sentence (no separate section).
      if (kid.totalMessages === 0 && kid.imageSearchCount === 0) {
        kid.summary = "No activity yesterday.";
      } else {
        try {
          kid.summary = await summarizeChildDay(
            kid.name,
            kid.totalMessages,
            kid.conversationExcerpts,
            kid.imageSearchQueries,
          );
        } catch (e) {
          console.error(
            `[daily-summary] summarizeChildDay failed for ${kid.name}:`,
            e,
          );
          kid.summary = "(summary unavailable today)";
        }
      }

      // (b) Alert summary — only when the kid had alerts today
      if (kid.alertCount > 0) {
        try {
          const alerts = await fetchAlertsForKid(db, kid.name, oneDayAgo);
          kid.alertSummary = await summarizeAlerts(kid.name, alerts);
        } catch (e) {
          console.error(
            `[daily-summary] summarizeAlerts failed for ${kid.name}:`,
            e,
          );
          kid.alertSummary = "(alert summary unavailable)";
        }
      }
    }),
  );

  // --- Build email template props ---
  // conversationExcerpts is stripped by default (threat T-p94-02).
  // Exception: when alertCount > 0 the parent needs to see what triggered the
  // concern, so we pass it through as `conversationTranscript`.
  const childrenForTemplate = stats.map(
    ({ conversationExcerpts, imageSearchQueries: _queries, ...rest }) => ({
      ...rest,
      ...(rest.alertCount > 0 && conversationExcerpts
        ? { conversationTranscript: conversationExcerpts }
        : {}),
    }),
  );

  // Lazy imports so this module is safe to import at build time
  const { resend } = await import("@/lib/resend");
  const { DailySummaryEmail } = await import("@/components/emails/daily-summary-email");

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: toEmails,
    subject: `KidsChat Daily Summary \u2014 ${date}`,
    react: DailySummaryEmail({ children: childrenForTemplate, date }),
  });

  if (error) {
    console.error("[daily-summary] Resend error:", error);
    return NextResponse.json({ error: "Failed to send email", detail: error }, { status: 500 });
  }

  // Record send in email_notifications collection. Strip conversationExcerpts
  // from the audit doc — we only retain the rendered summary + stats (privacy:
  // raw kid text should not be persisted here; threat T-p94-02).
  const childStatsForAudit = stats.map(
    ({ conversationExcerpts: _excerpts, imageSearchQueries: _queries, ...rest }) => rest,
  );

  await db.collection("email_notifications").insertOne({
    type: "daily_summary",
    sentAt: new Date(),
    to: toEmails,
    date,
    resendId: data?.id ?? null,
    meta: { childStats: childStatsForAudit },
  });

  // Record successful run so /api/health/crons can detect silence.
  try {
    await db.collection("cron_state").updateOne(
      { key: "daily_summary" },
      { $set: { key: "daily_summary", lastRunAt: new Date(), lastRunStats: { sent: toEmails.length, children: stats.length } } },
      { upsert: true }
    );
  } catch (err) {
    console.error("[daily-summary] Failed to write cron_state:", err);
  }

  // Ping BetterStack heartbeat — silence here means the cron didn't run.
  const heartbeatUrl = process.env.BETTERSTACK_HEARTBEAT_DAILY_SUMMARY;
  if (heartbeatUrl) {
    await fetch(heartbeatUrl).catch((err) =>
      console.warn("[daily-summary] BetterStack heartbeat ping failed:", err)
    );
  }

  return NextResponse.json({
    sent: toEmails.length,
    children: stats.length,
    date,
    ...(allQuiet && { quiet: true }),
  });
}

/**
 * Fetch recent safety alerts for a single child, most-recent first, capped at 10.
 * Projects only the fields the Haiku alert prompt needs.
 */
async function fetchAlertsForKid(
  db: Db,
  childName: string,
  since: Date,
): Promise<Array<{ alertType: string; matchedPattern: string; messageExcerpt: string }>> {
  const rows = await db
    .collection("email_notifications")
    .find({
      type: "safety_alert",
      childName,
      sentAt: { $gte: since },
    })
    .project<{
      meta?: {
        alertType?: string;
        matchedPattern?: string;
        messageExcerpt?: string;
      };
    }>({
      "meta.alertType": 1,
      "meta.matchedPattern": 1,
      "meta.messageExcerpt": 1,
    })
    .sort({ sentAt: -1 })
    .limit(10)
    .toArray();

  return rows.map((r) => ({
    alertType: r.meta?.alertType ?? "unknown",
    matchedPattern: r.meta?.matchedPattern ?? "",
    messageExcerpt: r.meta?.messageExcerpt ?? "",
  }));
}

/**
 * Returns today's date as an ISO date string.
 */
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}
