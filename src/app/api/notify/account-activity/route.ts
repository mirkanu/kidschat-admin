import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { notifyAccountActivity, type AccountActivityType } from "@/lib/account-activity";

const ALLOWED_TYPES: AccountActivityType[] = [
  "login",
  "settings_change",
  "recipient_added",
  "recipient_removed",
];

export async function POST(req: NextRequest) {
  // Session-based auth only — no cron secret (this is triggered by user actions)
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    activityType?: string;
    description?: string;
    performedBy?: string;
    ipAddress?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { activityType, description, performedBy, ipAddress } = body;

  // Validate required fields
  if (!activityType || !description || !performedBy) {
    return NextResponse.json(
      { error: "Missing required fields: activityType, description, performedBy" },
      { status: 400 }
    );
  }

  // Validate activityType against allowed values
  if (!ALLOWED_TYPES.includes(activityType as AccountActivityType)) {
    return NextResponse.json(
      { error: `Invalid activityType. Allowed: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const result = await notifyAccountActivity({
      activityType: activityType as AccountActivityType,
      description,
      performedBy,
      ipAddress,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[account-activity] Error:", err);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
