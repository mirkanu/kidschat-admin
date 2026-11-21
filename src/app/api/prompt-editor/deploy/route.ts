import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import {
  KIDAI_AGENT_IDS,
  applyManagedRules,
  renderRulesForAgent,
} from "@/lib/agent-rules";

/**
 * Deploy the Rules Editor draft.
 *
 * The draft is written into the managed safety-rules block of every kid-facing
 * LibreChat agent (`agents.instructions` in Mongo), and mirrored to
 * `app_config.active_prompt` so the editor and the Safety Rules page show
 * what is actually live.
 *
 * The draft is NOT written to the LibreChat config Gist: LibreChat's config
 * schema has no `systemPrompt` key, so such a write is ignored — and the
 * previous implementation appended it with the wrong indentation, producing
 * invalid YAML that would have broken LibreChat's config load entirely.
 */
export async function POST(request: Request) {
  // Auth guard: require authenticated ADMIN session
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { draft?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { draft } = body;
  if (!draft || typeof draft !== "string" || !draft.trim()) {
    return NextResponse.json(
      { error: "draft (non-empty string) is required" },
      { status: 400 }
    );
  }

  const trimmedDraft = draft.trim();
  const deployedAt = new Date();
  const deployedBy = (session.user as { email?: string })?.email ?? "unknown";

  try {
    const client = await getMongoClient();
    const db = client.db("test");
    const agentsCol = db.collection("agents");

    const agents = await agentsCol
      .find({ id: { $in: KIDAI_AGENT_IDS } })
      .toArray();

    if (agents.length === 0) {
      return NextResponse.json(
        { error: "No KidAI agents found — nothing to deploy to" },
        { status: 500 }
      );
    }

    // Current managed rules (template) — this is what a rollback restores.
    const activeDoc = await db
      .collection("app_config")
      .findOne({ key: "active_prompt" });
    const previousManagedRules =
      typeof activeDoc?.value === "string" ? activeDoc.value : "";

    // Save the rollback entry BEFORE overwriting anything.
    await db.collection("prompt_history").insertOne({
      previousManagedRules,
      previousPrompt: previousManagedRules,
      deployedPrompt: trimmedDraft,
      deployedAt,
      deployedBy,
    });

    // Write the managed block into every agent.
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
                renderRulesForAgent(trimmedDraft, name)
              ),
            },
          },
        },
      };
    });

    const result = await agentsCol.bulkWrite(operations);

    // Mirror to app_config.active_prompt (editor + Safety Rules page).
    await db.collection("app_config").updateOne(
      { key: "active_prompt" },
      { $set: { value: trimmedDraft, updatedAt: deployedAt } },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      deployedAt: deployedAt.toISOString(),
      agentsUpdated: result.modifiedCount,
      agentNames: agents.map((a) => a.name),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Deploy failed: ${message}` },
      { status: 500 }
    );
  }
}
