import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateGist } from "@/lib/gist-client";
import getMongoClient from "@/lib/mongodb";

interface PromptHistoryEntry {
  _id?: unknown;
  previousContent: string;
  previousPrompt?: string;
  deployedPrompt: string;
  deployedAt: Date;
  deployedBy: string;
}

const GIST_FILENAME = "librechat.yaml";

async function requireAdmin() {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if ((session.user as { role?: string })?.role !== "ADMIN") {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const client = await getMongoClient();
    const db = client.db("test");
    const entry = await db
      .collection<PromptHistoryEntry>("prompt_history")
      .findOne({}, { sort: { deployedAt: -1 } });

    if (!entry) {
      return NextResponse.json({ hasHistory: false });
    }

    return NextResponse.json({
      hasHistory: true,
      entry: {
        previousPrompt: entry.previousPrompt ?? null,
        deployedPrompt: entry.deployedPrompt,
        deployedAt: entry.deployedAt,
        deployedBy: entry.deployedBy,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch history: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "rollback") {
    return NextResponse.json(
      { error: "Invalid action. Expected: rollback" },
      { status: 400 }
    );
  }

  const gistId = process.env.GIST_ID;
  if (!gistId) {
    return NextResponse.json(
      { error: "Missing server configuration: GIST_ID" },
      { status: 500 }
    );
  }

  // Fetch most recent history entry
  let entry: PromptHistoryEntry | null;
  try {
    const client = await getMongoClient();
    const db = client.db("test");
    entry = await db
      .collection<PromptHistoryEntry>("prompt_history")
      .findOne({}, { sort: { deployedAt: -1 } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch history: ${message}` },
      { status: 500 }
    );
  }

  if (!entry) {
    return NextResponse.json(
      { error: "No rollback history available" },
      { status: 404 }
    );
  }

  // Restore the full previous YAML content to Gist
  try {
    await updateGist(gistId, GIST_FILENAME, entry.previousContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to restore Gist: ${message}` },
      { status: 502 }
    );
  }

  // Update app_config.active_prompt to the restored previous prompt
  const restoredAt = new Date();
  try {
    const client = await getMongoClient();
    const db = client.db("test");
    await db.collection("app_config").updateOne(
      { key: "active_prompt" },
      {
        $set: {
          value: entry.previousPrompt ?? entry.deployedPrompt,
          updatedAt: restoredAt,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    // Non-fatal: log but don't fail the rollback
    console.error("Failed to update app_config.active_prompt during rollback:", err);
  }

  return NextResponse.json({
    success: true,
    restoredAt: restoredAt.toISOString(),
  });
}
