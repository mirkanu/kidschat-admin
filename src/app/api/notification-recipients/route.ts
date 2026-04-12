import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getRecipients,
  addRecipient,
  removeRecipient,
  updateRecipientAlerts,
} from "@/lib/notification-recipients";

// ---------------------------------------------------------------------------
// GET — list all notification recipients
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const recipients = await getRecipients();
    return NextResponse.json(recipients);
  } catch (err) {
    console.error("[notification-recipients] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — add a new recipient
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { email, name } = body as { email?: string; name?: string };

    if (!email || !name) {
      return NextResponse.json(
        { error: "email and name are required" },
        { status: 400 }
      );
    }

    const result = await addRecipient(email, name);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Fire-and-forget account activity notification
    import("@/lib/account-activity")
      .then(({ notifyAccountActivity }) =>
        notifyAccountActivity({
          activityType: "recipient_added",
          description: `Added notification recipient: ${email}`,
          performedBy: session.user?.email ?? "unknown",
        })
      )
      .catch((err) =>
        console.error("[recipients] activity notify failed:", err)
      );

    return NextResponse.json(result.recipient);
  } catch (err) {
    console.error("[notification-recipients] POST error:", err);
    return NextResponse.json(
      { error: "Failed to add recipient" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a recipient
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const deleted = await removeRecipient(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    // Fire-and-forget account activity notification
    import("@/lib/account-activity")
      .then(({ notifyAccountActivity }) =>
        notifyAccountActivity({
          activityType: "recipient_removed",
          description: `Removed notification recipient (id: ${id})`,
          performedBy: session.user?.email ?? "unknown",
        })
      )
      .catch((err) =>
        console.error("[recipients] activity notify failed:", err)
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notification-recipients] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to remove recipient" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — update alert preferences for a recipient
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, alerts } = body as {
      id?: string;
      alerts?: Record<string, boolean>;
    };

    if (!id || !alerts) {
      return NextResponse.json(
        { error: "id and alerts are required" },
        { status: 400 }
      );
    }

    const updated = await updateRecipientAlerts(id, alerts);
    if (!updated) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notification-recipients] PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update recipient alerts" },
      { status: 500 }
    );
  }
}
