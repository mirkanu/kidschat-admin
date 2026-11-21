import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import {
  KIDAI_AGENT_IDS,
  applyManagedRules,
  renderRulesForAgent,
} from "@/lib/agent-rules";

interface PromptHistoryEntry {
  _id?: unknown;
  /** Managed rules that were live before this deploy (the rollback target). */
  previousManagedRules?: string;
  /** Legacy field — the old implementation stored the Gist YAML here. */
  previousContent?: string;
  previousPrompt?: string;
  deployedPrompt: string;
  deployedAt: Date;
  deployedBy: string;
  rolledBackAt?: Date;
}

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
      .findOne(
        { rolledBackAt: { $exists: false } },
        { sort: { deployedAt: -1 } }
      );

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

  const restoredAt = new Date();

  try {
    const client = await getMongoClient();
    const db = client.db("test");
    const historyCol = db.collection<PromptHistoryEntry>("prompt_history");

    const entry = await historyCol.findOne(
      { rolledBackAt: { $exists: false } },
      { sort: { deployedAt: -1 } }
    );

    if (!entry) {
      return NextResponse.json(
        { error: "No rollback history available" },
        { status: 404 }
      );
    }

    // The managed rules that were live before this deploy. Entries written by
    // the old Gist-based implementation have no previousManagedRules — for
    // those, fall back to an empty block, which removes the managed rules
    // from the agents and puts them back to their pre-Editor text.
    const previousManagedRules = entry.previousManagedRules ?? "";

    const agentsCol = db.collection("agents");
    const agents = await agentsCol
      .find({ id: { $in: KIDAI_AGENT_IDS } })
      .toArray();

    if (agents.length > 0) {
      const operations = agents.map((agent) => {
        const name = (agent.name as string) ?? "";
        const instructions = (agent.instructions as string) ?? "";
        return {
          updateOne: {
            filter: { id: agent.id },
            update: {
              $set: {
                instructions: applyManagedRules(
                  instructions,
                  renderRulesForAgent(previousManagedRules, name)
                ),
              },
            },
          },
        };
      });
      await agentsCol.bulkWrite(operations);
    }

    // Mirror to app_config.active_prompt (editor + Safety Rules page).
    await db.collection("app_config").updateOne(
      { key: "active_prompt" },
      { $set: { value: previousManagedRules, updatedAt: restoredAt } },
      { upsert: true }
    );

    // Mark the entry as rolled back so it is not offered again.
    await historyCol.updateOne(
      { _id: entry._id },
      { $set: { rolledBackAt: restoredAt } }
    );

    return NextResponse.json({
      success: true,
      restoredAt: restoredAt.toISOString(),
      agentsRestored: agents.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to roll back: ${message}` },
      { status: 500 }
    );
  }
}
