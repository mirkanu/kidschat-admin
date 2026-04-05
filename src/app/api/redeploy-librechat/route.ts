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

  const serviceId = process.env.RAILWAY_SERVICE_LIBRECHAT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
  const railwayToken = process.env.RAILWAY_API_TOKEN;

  if (!serviceId || !environmentId || !railwayToken) {
    return NextResponse.json(
      { error: "Railway redeploy not configured. Set RAILWAY_API_TOKEN and RAILWAY_SERVICE_LIBRECHAT_ID in environment variables." },
      { status: 500 }
    );
  }

  try {
    // Railway GraphQL API to trigger a redeploy
    const res = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${railwayToken}`,
      },
      body: JSON.stringify({
        query: `mutation { serviceInstanceRedeploy(serviceId: "${serviceId}", environmentId: "${environmentId}") }`,
      }),
    });

    const data = await res.json();

    if (data.errors) {
      return NextResponse.json(
        { error: `Railway API error: ${data.errors[0]?.message ?? "Unknown"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "LibreChat redeploy triggered" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Redeploy failed: ${message}` },
      { status: 500 }
    );
  }
}
