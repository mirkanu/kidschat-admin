/**
 * scripts/mongo-inspect.ts
 *
 * One-shot MongoDB inspection script for Phase 15 planning.
 * Connects to the live Railway MongoDB and dumps field shapes for:
 *   - balance collection
 *   - aclentries collection
 *   - messages collection (tokenCount presence)
 *   - files collection (image_generation context)
 *   - agents collection (drawing agents)
 *   - conversations collection
 *
 * Run modes:
 *   npx tsx scripts/mongo-inspect.ts                  -- read-only inspection
 *   npx tsx scripts/mongo-inspect.ts --synthetic-message -- write probe (requires userId + conversationId)
 *
 * This script is IDEMPOTENT and READ-ONLY in default mode.
 */

import { MongoClient, ObjectId } from "mongodb";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const DRAWING_AGENT_IDS = [
  "agent_wxgt6su7d3pcosiil3", // Friendly Tutor
  "agent_y4w1cvoyg77p9thed9", // Casual Buddy
  "agent_64q6z5s57552cpgl0hr", // Balanced Helper
  "agent_aiv99mzvdzquym6y89k", // Standard Formal
];

const MONGO_INSPECTION_MD = path.join(
  __dirname,
  "../.planning/phases/15-safety-alert-extension-rate-limiting/15-00-MONGO-INSPECTION.md"
);

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function appendToDoc(content: string) {
  fs.appendFileSync(MONGO_INSPECTION_MD, content + "\n");
}

function writeDoc(content: string) {
  fs.writeFileSync(MONGO_INSPECTION_MD, content + "\n");
}

async function runInspection(db: ReturnType<MongoClient["db"]>) {
  const rows: string[] = [];

  console.log("\n=== Phase 15 MongoDB Inspection ===\n");

  // 1. balance collection
  console.log("1. Inspecting balance collection...");
  const balanceDoc = await db.collection("balance").findOne({});
  if (balanceDoc) {
    const keyField = balanceDoc.user !== undefined ? "user" : balanceDoc.userId !== undefined ? "userId" : "UNKNOWN";
    const creditField =
      balanceDoc.tokenCredits !== undefined
        ? "tokenCredits"
        : balanceDoc.credit !== undefined
          ? "credit"
          : "UNKNOWN";
    const sampleValue =
      balanceDoc.tokenCredits !== undefined
        ? balanceDoc.tokenCredits
        : balanceDoc.credit !== undefined
          ? balanceDoc.credit
          : "N/A";
    console.log(`  Key field: ${keyField}, Credit field: ${creditField}, Sample: ${sampleValue}`);
    rows.push(
      `| balance | user/userId | \`${keyField}\` | \`${String(balanceDoc[keyField]).substring(0, 20)}\` | Primary key field |`
    );
    rows.push(
      `| balance | tokenCredits/credit | \`${creditField}\` | \`${sampleValue}\` | Balance amount field |`
    );
  } else {
    console.log("  EMPTY — balance.enabled is likely not set in librechat.yaml");
    rows.push(
      `| balance | tokenCredits/credit | N/A | N/A | EMPTY — balance.enabled likely not set in librechat.yaml |`
    );
    rows.push(`| balance | user/userId | N/A | N/A | EMPTY collection |`);
  }

  // 2. aclentries collection
  console.log("2. Inspecting aclentries collection...");
  const aclDoc = await db.collection("aclentries").findOne({ resource: /agent_/ });
  if (aclDoc) {
    const userField =
      aclDoc.user !== undefined ? "user" : aclDoc.principalId !== undefined ? "principalId" : "UNKNOWN";
    const resourceField =
      aclDoc.resource !== undefined ? "resource" : aclDoc.resourceId !== undefined ? "resourceId" : "UNKNOWN";
    console.log(
      `  User field: ${userField}, Resource field: ${resourceField}, permBits: ${aclDoc.permBits}, roleId: ${aclDoc.roleId}`
    );
    rows.push(
      `| aclentries | user/principalId | \`${userField}\` | \`${String(aclDoc[userField]).substring(0, 20)}\` | Who the ACL entry belongs to |`
    );
    rows.push(
      `| aclentries | resource/resourceId | \`${resourceField}\` | \`${String(aclDoc[resourceField]).substring(0, 30)}\` | What resource the ACL is for |`
    );
    rows.push(`| aclentries | permBits | \`permBits\` | \`${aclDoc.permBits}\` | Permission bits value |`);
    rows.push(`| aclentries | roleId | \`roleId\` | \`${aclDoc.roleId}\` | Role ID value |`);
  } else {
    console.log("  No aclentries with agent_ resource found");
    rows.push(`| aclentries | user/principalId | N/A | N/A | No agent_ entries found |`);
  }

  // 3. messages collection — tokenCount presence
  console.log("3. Inspecting messages collection (tokenCount presence)...");
  const msgWithToken = await db
    .collection("messages")
    .findOne({ isCreatedByUser: false, tokenCount: { $exists: true } });
  const msgWithoutToken = await db.collection("messages").findOne({ isCreatedByUser: false });

  if (msgWithToken) {
    const tc = msgWithToken.tokenCount;
    const hasInputOutput = tc && tc.input !== undefined && tc.output !== undefined;
    console.log(
      `  tokenCount EXISTS on AI messages. Input/output sub-fields: ${hasInputOutput ? "YES" : "NO"}`
    );
    console.log(`  tokenCount sample:`, JSON.stringify(tc, null, 2));
    rows.push(
      `| messages | tokenCount | \`tokenCount\` | \`${JSON.stringify(tc).substring(0, 50)}\` | IS populated on AI responses |`
    );
    rows.push(
      `| messages | tokenCount.input/output | ${hasInputOutput ? "YES" : "NO"} | \`${hasInputOutput ? `{input:${tc.input},output:${tc.output}}` : "flat value"}\` | Sub-field structure |`
    );
  } else if (msgWithoutToken) {
    console.log("  tokenCount NOT present on AI messages — char-formula fallback needed");
    rows.push(
      `| messages | tokenCount | ABSENT | N/A | NOT populated on AI responses — char-formula fallback needed |`
    );
    // Print all keys to help understand structure
    const keys = Object.keys(msgWithoutToken).filter((k) => k !== "_id");
    rows.push(
      `| messages | available fields | N/A | \`${keys.slice(0, 8).join(", ")}\` | Top-level field names |`
    );
  } else {
    console.log("  No AI messages found in messages collection");
    rows.push(`| messages | tokenCount | N/A | N/A | No AI messages found |`);
  }

  // 4. files collection — image_generation context
  console.log("4. Inspecting files collection (image_generation)...");
  const imageFiles = await db
    .collection("files")
    .find({ context: "image_generation" })
    .limit(3)
    .toArray();

  if (imageFiles.length > 0) {
    const sample = imageFiles[0];
    const userField = sample.user !== undefined ? "user" : sample.userId !== undefined ? "userId" : "UNKNOWN";
    console.log(
      `  Found ${imageFiles.length} image_generation files. User field: ${userField}`
    );
    rows.push(
      `| files | context | \`context\` | \`image_generation\` | Correct filter for DALL-E images |`
    );
    rows.push(
      `| files | user/userId | \`${userField}\` | \`${String(sample[userField]).substring(0, 20)}\` | User reference field |`
    );
  } else {
    console.log("  No image_generation files found (no DALL-E images generated yet, or different context value)");
    rows.push(
      `| files | context | N/A | N/A | No image_generation files found — check if any images have been generated |`
    );
  }

  // 5. agents collection — drawing agents
  console.log("5. Inspecting agents collection (drawing agents)...");
  const agents = await db
    .collection("agents")
    .find({ id: { $in: DRAWING_AGENT_IDS } })
    .project({ id: 1, tools: 1, name: 1 })
    .toArray();

  console.log(`  Found ${agents.length}/${DRAWING_AGENT_IDS.length} drawing agents`);
  for (const agent of agents) {
    const hasDalle = agent.tools && JSON.stringify(agent.tools).includes("dalle");
    console.log(`  - ${agent.id}: tools=${JSON.stringify(agent.tools)}, dalle=${hasDalle}`);
    rows.push(
      `| agents | id/tools | \`${agent.id}\` | \`dalle=${hasDalle}\` | Drawing agent presence + tools |`
    );
  }
  if (agents.length < DRAWING_AGENT_IDS.length) {
    const foundIds = agents.map((a) => a.id);
    const missing = DRAWING_AGENT_IDS.filter((id) => !foundIds.includes(id));
    console.log(`  MISSING agents: ${missing.join(", ")}`);
    for (const missingId of missing) {
      rows.push(`| agents | id | \`${missingId}\` | MISSING | This agent was not found in DB |`);
    }
  }

  // 6. conversations collection
  console.log("6. Inspecting conversations collection...");
  const convDoc = await db.collection("conversations").findOne({});
  if (convDoc) {
    const hasConversationId = convDoc.conversationId !== undefined;
    const idField = hasConversationId ? "conversationId" : "_id";
    console.log(
      `  Key field for lookups: ${idField}. Sample keys: ${Object.keys(convDoc).slice(0, 8).join(", ")}`
    );
    rows.push(
      `| conversations | conversationId/\_id | \`${idField}\` | \`${hasConversationId ? String(convDoc.conversationId).substring(0, 20) : "ObjectId"}\` | Primary lookup field |`
    );
    rows.push(
      `| conversations | top-level fields | N/A | \`${Object.keys(convDoc).slice(0, 8).join(", ")}\` | Field inventory |`
    );
  } else {
    console.log("  No conversations found");
    rows.push(`| conversations | conversationId/\_id | N/A | N/A | No conversations found |`);
  }

  return rows;
}

async function runSyntheticMessage(db: ReturnType<MongoClient["db"]>) {
  console.log("\n=== Synthetic Message Test ===\n");
  console.log(
    "This will insert a synthetic AI message into the live MongoDB to verify Pattern 8 delivery."
  );
  console.log("IMPORTANT: The message will be deleted after you confirm the test.\n");

  const userId = await promptUser("Enter the test child's userId (from MongoDB): ");
  const conversationId = await promptUser(
    "Enter an active conversationId (from LibreChat URL after opening a chat): "
  );

  if (!userId || !conversationId) {
    console.error("userId and conversationId are required. Aborting.");
    process.exit(1);
  }

  const syntheticId = new ObjectId();
  const timestamp = Date.now();
  const syntheticMessage = {
    _id: syntheticId,
    messageId: syntheticId.toHexString(),
    conversationId,
    parentMessageId: "00000000-0000-0000-0000-000000000000",
    isCreatedByUser: false,
    endpoint: "agents",
    agent_id: DRAWING_AGENT_IDS[0],
    text: `PHASE-15-SYNTHETIC-TEST-${timestamp}`,
    model: "claude-haiku-4-5",
    sender: "Agent",
    unfinished: false,
    error: false,
    files: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  };

  console.log("\nInserting synthetic message...");
  console.log("messageId:", syntheticMessage.messageId);
  console.log("text:", syntheticMessage.text);

  await db.collection("messages").insertOne(syntheticMessage);

  // Update conversation updatedAt to trigger UI refresh (Pitfall 6)
  await db
    .collection("conversations")
    .updateOne({ conversationId }, { $set: { updatedAt: new Date() } });

  console.log(
    "\nSynthetic message inserted. Now refresh LibreChat as the test child and check if the message appears."
  );
  console.log(`Look for: "${syntheticMessage.text}" in the conversation.`);

  const verdict = await promptUser("\nDid the message appear in LibreChat? Type OK or FAIL then press Enter: ");

  const isGo = verdict.toUpperCase().trim() === "OK";
  const verdictLine = isGo
    ? "VERDICT: GO — synthetic insertion renders in LibreChat UI"
    : "VERDICT: NO-GO — bonus offer delivery must be redesigned before Plan 02";

  console.log("\n" + verdictLine);

  // Clean up synthetic message
  console.log("Cleaning up synthetic message...");
  await db.collection("messages").deleteOne({ _id: syntheticId });
  console.log("Synthetic message deleted.");

  // Append to inspection doc
  const syntheticSection = `
## Synthetic Message Test

**Test performed:** ${new Date().toISOString()}
**messageId:** ${syntheticMessage.messageId}
**conversationId:** ${conversationId}
**text:** ${syntheticMessage.text}
**Operator observations:** ${verdict}

${verdictLine}

${isGo ? "**Impact on Plan 02:** Bonus offer delivery via direct MongoDB message insertion is viable." : "**Impact on Plan 02:** Bonus offer delivery must be redesigned. Alternative: agent system instruction approach where the agent is given a context flag to offer bonuses itself."}
`;

  appendToDoc(syntheticSection);
  console.log("\nSynthetic test result appended to MONGO-INSPECTION.md");
}

async function runCleanup(db: ReturnType<MongoClient["db"]>, messageId: string) {
  console.log(`\nCleaning up synthetic message: ${messageId}`);
  const result = await db.collection("messages").deleteOne({ messageId });
  if (result.deletedCount > 0) {
    console.log("Synthetic message deleted successfully.");
  } else {
    console.log("Message not found (may already be deleted).");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const syntheticMode = args.includes("--synthetic-message");
  const cleanupIdx = args.indexOf("--cleanup");
  const cleanupMessageId = cleanupIdx >= 0 ? args[cleanupIdx + 1] : null;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI environment variable not set.");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("test");

  console.log("Connected to MongoDB (Railway)");

  if (cleanupMessageId) {
    await runCleanup(db, cleanupMessageId);
  } else if (syntheticMode) {
    await runSyntheticMessage(db);
  } else {
    const rows = await runInspection(db);

    // Write the inspection doc
    const docContent = `# 15-00 MongoDB Inspection Results

**Run date:** ${new Date().toISOString()}
**Database:** test (Railway production)
**Script:** scripts/mongo-inspect.ts

---

## Field Shape Findings

| Collection | Field asked | Actual field name | Sample value | Notes |
|------------|-------------|-------------------|--------------|-------|
${rows.join("\n")}

---

## Plan 02 Implications

*(To be filled by the human after the checkpoint below)*

- balance.enabled is [SET / NOT SET] in librechat.yaml — Plan 01 MUST [add / skip] YAML deploy task
- aclentries use field name [user / principalId] — Plan 02 enforcement code MUST use this
- messages.tokenCount [IS / IS NOT] populated — Plan 01 cost ledger MUST [use directly / apply char-formula fallback]

---

`;

    writeDoc(docContent);
    console.log("\n=== Inspection complete ===");
    console.log(`Results written to: ${MONGO_INSPECTION_MD}`);
    console.log("\nNext step: Run with --synthetic-message flag to complete the synthetic message test.");
  }

  await client.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
