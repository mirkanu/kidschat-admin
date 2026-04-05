import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchGist, updateGist } from "@/lib/gist-client";
import getMongoClient from "@/lib/mongodb";

const GIST_FILENAME = "librechat.yaml";

/**
 * Replace the systemPrompt literal block scalar value in a librechat.yaml string.
 *
 * The YAML structure looks like:
 *   systemPrompt: |
 *     line one
 *     line two
 *
 * We find that block and replace everything up to the next non-indented key
 * (or end of string).
 */
function replaceSystemPrompt(yaml: string, newPrompt: string): string {
  // Indent each line of the new prompt with 6 spaces (matching librechat.yaml structure)
  const indented = newPrompt
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

  // Match `systemPrompt: |` followed by indented lines until a non-indented or less-indented line
  const pattern = /([ \t]*systemPrompt:\s*\|\n)((?:[ \t]+[^\n]*\n?)*)/;
  const replacement = `$1${indented}\n`;

  if (pattern.test(yaml)) {
    return yaml.replace(pattern, replacement);
  }

  // If systemPrompt key not found, append it (fallback — should not normally happen)
  return yaml + `\n      systemPrompt: |\n${indented}\n`;
}

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
  if (!draft || typeof draft !== "string") {
    return NextResponse.json(
      { error: "draft (string) is required" },
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

  // Verify token is present (fetchGist will throw if missing, but check early)
  if (!process.env.GITHUB_GIST_TOKEN) {
    return NextResponse.json(
      { error: "Missing server configuration: GITHUB_GIST_TOKEN" },
      { status: 500 }
    );
  }

  // Step 1: Fetch current Gist content
  let currentGistContent: string;
  try {
    const gist = await fetchGist(gistId);
    currentGistContent = gist.content;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch current Gist: ${message}` },
      { status: 502 }
    );
  }

  // Step 2: Save rollback entry to MongoDB BEFORE overwriting
  const deployedAt = new Date();
  try {
    const client = await getMongoClient();
    const db = client.db("test");
    await db.collection("prompt_history").insertOne({
      previousContent: currentGistContent,
      deployedPrompt: draft,
      deployedAt,
      deployedBy: (session.user as { email?: string })?.email ?? "unknown",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save rollback entry: ${message}` },
      { status: 500 }
    );
  }

  // Step 3: Build the updated YAML with new prompt
  const updatedYaml = replaceSystemPrompt(currentGistContent, draft);

  // Step 4: Push updated content to Gist
  try {
    await updateGist(gistId, GIST_FILENAME, updatedYaml);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update Gist: ${message}` },
      { status: 502 }
    );
  }

  // Step 5: Update app_config.active_prompt for Safety Rules sync
  try {
    const client = await getMongoClient();
    const db = client.db("test");
    await db.collection("app_config").updateOne(
      { key: "active_prompt" },
      { $set: { value: draft, updatedAt: deployedAt } },
      { upsert: true }
    );
  } catch (err) {
    // Non-fatal: log but don't fail the deploy
    console.error("Failed to update app_config.active_prompt:", err);
  }

  return NextResponse.json({
    success: true,
    deployedAt: deployedAt.toISOString(),
  });
}
