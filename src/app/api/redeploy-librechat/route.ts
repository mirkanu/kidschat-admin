import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const restartUrl = process.env.LIBRECHAT_RESTART_URL;
  const restartSecret = process.env.LIBRECHAT_RESTART_SECRET;

  if (!restartUrl || !restartSecret) {
    return NextResponse.json(
      { error: "LibreChat restart not configured. Set LIBRECHAT_RESTART_URL and LIBRECHAT_RESTART_SECRET in environment variables." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(restartUrl, {
      method: "POST",
      headers: {
        "x-restart-secret": restartSecret,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Restart webhook failed (${res.status}): ${body}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "LibreChat restart triggered" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Restart failed: ${message}` },
      { status: 500 }
    );
  }
}
