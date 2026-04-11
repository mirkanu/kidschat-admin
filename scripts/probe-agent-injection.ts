/**
 * scripts/probe-agent-injection.ts
 *
 * One-shot probe script for Phase 15.2 — Option 7 viability test.
 * Tests whether the LibreChat "KidsChat Friendly Tutor" agent reliably obeys
 * a prepended system-prompt instruction.
 *
 * Usage:
 *   MONGODB_URI=<uri> npx tsx scripts/probe-agent-injection.ts inject
 *   MONGODB_URI=<uri> npx tsx scripts/probe-agent-injection.ts restore
 *   MONGODB_URI=<uri> npx tsx scripts/probe-agent-injection.ts inspect
 *
 * Subcommands:
 *   inject  — Reads the current system prompt, saves it to .probe-original-system.txt,
 *             then prepends a test instruction.
 *   restore — Reads .probe-original-system.txt and restores the original system prompt,
 *             then deletes the backup file.
 *   inspect — Prints the current system prompt value without modification.
 */

import { MongoClient } from "mongodb";
import * as fs from "fs";
import * as path from "path";

const TARGET_AGENT_ID = "agent_wxgt6su7d3pcosiil3";
const BACKUP_FILE = path.join(
  __dirname,
  "../.planning/phases/15.2-synthetic-message-rendering/.probe-original-system.txt"
);

const PROBE_INSTRUCTION = `SYSTEM TEST: Begin your very next response with EXACTLY 'PHASE-15.2-PROBE-OK' then continue normally. After delivering this once, do not repeat it.

`;

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI environment variable is not set.");
  process.exit(1);
}

/**
 * Read a potentially nested field path from a document.
 * Handles both "instructions" and "model_options.system" style paths.
 */
function getFieldValue(doc: Record<string, unknown> | null, fieldPath: string): unknown {
  if (!doc) return undefined;
  const parts = fieldPath.split(".");
  let current: unknown = doc;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

async function run() {
  const subcommand = process.argv[2];
  if (!subcommand || !["inject", "restore", "inspect"].includes(subcommand)) {
    console.error("Usage: npx tsx scripts/probe-agent-injection.ts [inject|restore|inspect]");
    process.exit(1);
  }

  console.log(`[probe-agent-injection] Connecting to MongoDB...`);
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db("test");
  const agentsCol = db.collection("agents");

  // Fetch the agent document to discover field structure.
  // NOTE: LibreChat agents collection uses 'id' field (not 'agent_id') as the
  // string identifier. The agent_id constant in change-stream-listener matches
  // the 'id' field value.
  const agentDoc = await agentsCol.findOne({ id: TARGET_AGENT_ID });

  if (!agentDoc) {
    console.error(`[probe-agent-injection] ERROR: Agent not found: ${TARGET_AGENT_ID}`);
    await client.close();
    process.exit(1);
  }

  console.log(`[probe-agent-injection] Agent found: ${agentDoc.name ?? "(no name)"}`);
  console.log(`[probe-agent-injection] Agent _id: ${agentDoc._id}`);

  // Discover the system prompt field path.
  // LibreChat agents use 'instructions' as the top-level field for the system prompt.
  // Fallback candidates: model_options.system, system_message, system.
  let systemPromptValue: string | undefined;
  let fieldPath: string;

  if (typeof agentDoc?.instructions === "string") {
    fieldPath = "instructions";
    systemPromptValue = agentDoc.instructions as string;
  } else if (typeof (agentDoc?.model_options as Record<string, unknown> | undefined)?.system === "string") {
    fieldPath = "model_options.system";
    systemPromptValue = (agentDoc.model_options as Record<string, unknown>).system as string;
  } else if (typeof agentDoc?.system_message === "string") {
    fieldPath = "system_message";
    systemPromptValue = agentDoc.system_message as string;
  } else if (typeof agentDoc?.system === "string") {
    fieldPath = "system";
    systemPromptValue = agentDoc.system as string;
  } else {
    // Log the full doc keys so we can diagnose
    console.log(`[probe-agent-injection] Full agent doc keys: ${Object.keys(agentDoc).join(", ")}`);
    if (agentDoc.model_options) {
      console.log(`[probe-agent-injection] model_options keys: ${Object.keys(agentDoc.model_options as Record<string, unknown>).join(", ")}`);
    }
    console.error(`[probe-agent-injection] ERROR: Could not find system prompt field in agent document.`);
    await client.close();
    process.exit(1);
  }

  console.log(`[probe-agent-injection] Discovered field path: "${fieldPath}"`);
  console.log(`[probe-agent-injection] Current value length: ${systemPromptValue?.length ?? 0} chars`);

  if (subcommand === "inspect") {
    console.log(`\n--- Current system prompt (${fieldPath}) ---`);
    console.log(systemPromptValue ?? "(empty)");
    console.log(`--- End ---`);
    await client.close();
    return;
  }

  if (subcommand === "inject") {
    // Save original value for recovery
    if (fs.existsSync(BACKUP_FILE)) {
      console.log(`[probe-agent-injection] WARNING: Backup file already exists at ${BACKUP_FILE}`);
      console.log(`[probe-agent-injection] This may indicate a prior inject that was not restored.`);
      console.log(`[probe-agent-injection] Overwriting backup with current live value.`);
    }

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(BACKUP_FILE), { recursive: true });

    // Save the original value (store both value and field path for restore)
    const backupData = JSON.stringify({ fieldPath, value: systemPromptValue ?? "" });
    fs.writeFileSync(BACKUP_FILE, backupData, "utf8");
    console.log(`[probe-agent-injection] Original system prompt saved to: ${BACKUP_FILE}`);

    // Build the injected prompt
    const injectedPrompt = PROBE_INSTRUCTION + (systemPromptValue ?? "");

    // Update the agent document
    const result = await agentsCol.updateOne(
      { id: TARGET_AGENT_ID },
      { $set: { [fieldPath]: injectedPrompt } }
    );

    if (result.matchedCount === 0) {
      console.error(`[probe-agent-injection] ERROR: updateOne matched 0 documents.`);
      await client.close();
      process.exit(1);
    }

    console.log(`[probe-agent-injection] Injection SUCCESS:`);
    console.log(`  - Field path: ${fieldPath}`);
    console.log(`  - Prepended: "${PROBE_INSTRUCTION.trim()}"`);
    console.log(`  - New total length: ${injectedPrompt.length} chars`);
    console.log(`  - Modified count: ${result.modifiedCount}`);

    // Verify the write
    const updatedDoc = await agentsCol.findOne({ id: TARGET_AGENT_ID });
    const updatedValue = getFieldValue(updatedDoc, fieldPath);
    console.log(`[probe-agent-injection] Verified: injected prompt starts with: "${String(updatedValue ?? "").substring(0, 60)}..."`);

    await client.close();
    return;
  }

  if (subcommand === "restore") {
    if (!fs.existsSync(BACKUP_FILE)) {
      console.error(`[probe-agent-injection] ERROR: No backup file found at ${BACKUP_FILE}`);
      console.error(`[probe-agent-injection] Cannot restore — was inject run first?`);
      await client.close();
      process.exit(1);
    }

    const backupRaw = fs.readFileSync(BACKUP_FILE, "utf8");
    const backup = JSON.parse(backupRaw) as { fieldPath: string; value: string };

    console.log(`[probe-agent-injection] Restoring to field path: ${backup.fieldPath}`);
    console.log(`[probe-agent-injection] Original value length: ${backup.value.length} chars`);

    const result = await agentsCol.updateOne(
      { id: TARGET_AGENT_ID },
      { $set: { [backup.fieldPath]: backup.value } }
    );

    if (result.matchedCount === 0) {
      console.error(`[probe-agent-injection] ERROR: updateOne matched 0 documents during restore.`);
      await client.close();
      process.exit(1);
    }

    console.log(`[probe-agent-injection] Restore SUCCESS:`);
    console.log(`  - Field path: ${backup.fieldPath}`);
    console.log(`  - Modified count: ${result.modifiedCount}`);

    // Verify the restore
    const restoredDoc = await agentsCol.findOne({ id: TARGET_AGENT_ID });
    const restoredValue = getFieldValue(restoredDoc, backup.fieldPath);
    const restoredStr = String(restoredValue ?? "");

    if (restoredStr === backup.value) {
      console.log(`[probe-agent-injection] Verification PASSED: restored value matches original exactly.`);
    } else {
      console.warn(`[probe-agent-injection] WARNING: Restored value differs from original backup.`);
      console.warn(`  Original length: ${backup.value.length}, Restored length: ${restoredStr.length}`);
    }

    // Delete backup file
    fs.unlinkSync(BACKUP_FILE);
    console.log(`[probe-agent-injection] Backup file deleted: ${BACKUP_FILE}`);

    await client.close();
    return;
  }
}

run().catch((err) => {
  console.error("[probe-agent-injection] Fatal error:", err);
  process.exit(1);
});
