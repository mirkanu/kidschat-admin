import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { notifySafetyAlert } from "@/lib/notify-safety-alert";

/**
 * POST /api/notify/safety-alert
 *
 * Triggers a safety alert email to all opted-in ADMIN users.
 * Includes deduplication — identical (conversationId + matchedPattern) within
 * 1 hour returns { sent: 0, reason: "duplicate" } without sending.
 *
 * Body:
 * {
 *   childName: string,
 *   alertType: "safety_redirect" | "jailbreak_attempt",
 *   matchedPattern: string,
 *   messageExcerpt: string,
 *   detectedAt: string (ISO),
 *   conversationId: string
 * }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { childName, alertType, matchedPattern, messageExcerpt, detectedAt, conversationId } =
    body;

  // Validate required fields
  const missing = (
    ["childName", "alertType", "matchedPattern", "messageExcerpt", "detectedAt", "conversationId"] as const
  ).filter((k) => !body[k]);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  if (alertType !== "safety_redirect" && alertType !== "jailbreak_attempt") {
    return NextResponse.json(
      { error: "alertType must be 'safety_redirect' or 'jailbreak_attempt'" },
      { status: 400 }
    );
  }

  try {
    const result = await notifySafetyAlert({
      childName,
      alertType,
      matchedPattern,
      messageExcerpt,
      detectedAt,
      conversationId,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[notify/safety-alert] Error sending email:", err);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
