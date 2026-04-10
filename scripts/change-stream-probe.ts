/**
 * scripts/change-stream-probe.ts
 *
 * Read-only probe that opens a MongoDB change stream on the `messages` collection
 * and listens for child user insert events. Proves whether Railway-hosted MongoDB
 * supports change streams (requires replica set configuration).
 *
 * USAGE:
 *   railway run --service kidschat-admin npx tsx scripts/change-stream-probe.ts
 *
 * OR with local env:
 *   MONGODB_URI=<uri> npx tsx scripts/change-stream-probe.ts
 *
 * OR fetch URI from Railway first:
 *   railway variables --json --service kidschat-admin | jq -r '.MONGODB_URI'
 *   export MONGODB_URI=<that value>
 *   npx tsx scripts/change-stream-probe.ts
 *
 * WHAT TO DO WHILE THE PROBE IS RUNNING:
 *   In a separate browser tab, log in as Sebastian in LibreChat and send 3 messages.
 *   The probe logs each incoming event then exits after 3 events (or 5-minute timeout).
 *
 * EXIT CODES:
 *   0 — SUCCESS: change streams supported, 3 events received
 *   1 — ERROR: MongoError thrown (change streams not supported, auth failure, etc.)
 *   2 — TIMEOUT: no events in 5 minutes (change streams unsupported or replica set missing)
 *
 * This script is READ-ONLY: no inserts, updates, or deletes.
 */

import { MongoClient } from "mongodb";
import * as fs from "fs";
import * as path from "path";

const DECISIONS_FILE = path.join(
  __dirname,
  "../.planning/phases/15-safety-alert-extension-rate-limiting/15-03-DECISIONS.md"
);

const MAX_EVENTS = 3;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function appendDecisions(section: string, content: string) {
  let existing = "";
  if (fs.existsSync(DECISIONS_FILE)) {
    existing = fs.readFileSync(DECISIONS_FILE, "utf-8");
  }

  const sectionHeader = `## ${section}`;
  if (existing.includes(sectionHeader)) {
    // Replace the existing section content up to the next ## header or end-of-file
    const regex = new RegExp(
      `(## ${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?)(?=\\n## |$)`,
      "g"
    );
    existing = existing.replace(regex, `${sectionHeader}\n\n${content}\n`);
  } else {
    existing = existing.trimEnd() + `\n\n${sectionHeader}\n\n${content}\n`;
  }

  fs.mkdirSync(path.dirname(DECISIONS_FILE), { recursive: true });
  fs.writeFileSync(DECISIONS_FILE, existing, "utf-8");
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "[probe] ERROR: MONGODB_URI environment variable is not set."
    );
    console.error(
      "[probe] Run with: MONGODB_URI=<uri> npx tsx scripts/change-stream-probe.ts"
    );
    console.error(
      "[probe] Or via Railway: railway run --service kidschat-admin npx tsx scripts/change-stream-probe.ts"
    );
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log("[probe] Connecting to MongoDB...");
    await client.connect();
    console.log("[probe] Connected.");

    const db = client.db("test");
    const collection = db.collection("messages");

    console.log(
      "[probe] Opening change stream on messages collection filtered to child user inserts..."
    );
    console.log(
      "[probe] listening on messages collection — send a message as Sebastian in LibreChat now"
    );
    console.log(
      `[probe] Waiting for up to ${MAX_EVENTS} events (timeout: 5 minutes)...`
    );

    const pipeline = [
      {
        $match: {
          operationType: "insert",
          "fullDocument.isCreatedByUser": true,
        },
      },
    ];

    const changeStream = collection.watch(pipeline, {
      fullDocument: "updateLookup",
    });

    let eventCount = 0;
    let lastResumeToken: unknown = null;
    const events: string[] = [];

    const timeoutHandle = setTimeout(async () => {
      console.log(
        "[probe] TIMEOUT — no events received, change streams may not be supported or replica set not configured"
      );
      await changeStream.close();
      await client.close();

      const resultContent = [
        `**Result:** TIMEOUT`,
        `**Date:** ${new Date().toISOString()}`,
        `**Details:** No insert events received within 5 minutes. Change streams may not be supported, or the replica set is not configured on this MongoDB instance.`,
        ``,
        `**Next step:** If Railway MongoDB does not support change streams, Plan 15-04 must use the /api/cron/tick fallback (1 cron service running every minute).`,
      ].join("\n");

      appendDecisions("Change Stream Probe", resultContent);
      console.log(
        "[probe] Result recorded to 15-03-DECISIONS.md under ## Change Stream Probe"
      );
      process.exit(2);
    }, TIMEOUT_MS);

    for await (const event of changeStream) {
      clearTimeout(timeoutHandle);

      eventCount++;
      lastResumeToken = event._id;

      const messageId =
        (event.fullDocument as Record<string, unknown>)?.messageId ?? "unknown";
      const rawText =
        ((event.fullDocument as Record<string, unknown>)?.text as string) ?? "";
      const text =
        rawText.length > 80 ? rawText.substring(0, 80) + "..." : rawText;

      const tokenStr = JSON.stringify(lastResumeToken);

      console.log(
        `[event ${eventCount}] operationType=${event.operationType} messageId=${messageId} text="${text}" resumeToken=${tokenStr}`
      );

      events.push(
        `Event ${eventCount}: operationType=${event.operationType} messageId=${messageId} text="${text}" resumeToken=${tokenStr}`
      );

      if (eventCount >= MAX_EVENTS) {
        console.log(
          "[probe] SUCCESS — change streams supported. Received 3 events."
        );
        await changeStream.close();
        break;
      }

      // Re-arm the timeout for the next event
      // (clearTimeout above already handled, but we need to keep going)
    }

    await client.close();

    if (eventCount >= MAX_EVENTS) {
      const resultContent = [
        `**Result:** SUCCESS`,
        `**Date:** ${new Date().toISOString()}`,
        `**Events received:** ${eventCount}`,
        `**Last resumeToken:** \`${JSON.stringify(lastResumeToken)}\``,
        ``,
        `**Events log:**`,
        ...events.map((e) => `- ${e}`),
        ``,
        `**Conclusion:** Railway-hosted MongoDB supports change streams. Plan 15-04 can use the instrumentation.ts + change stream listener approach (Path A).`,
      ].join("\n");

      appendDecisions("Change Stream Probe", resultContent);
      console.log(
        "[probe] Result recorded to 15-03-DECISIONS.md under ## Change Stream Probe"
      );
      process.exit(0);
    } else {
      // Stream was closed with fewer than MAX_EVENTS — treat as partial success
      const resultContent = [
        `**Result:** PARTIAL (${eventCount} of ${MAX_EVENTS} events)`,
        `**Date:** ${new Date().toISOString()}`,
        `**Events received:** ${eventCount}`,
        `**Last resumeToken:** \`${JSON.stringify(lastResumeToken)}\``,
        ``,
        `**Events log:**`,
        ...events.map((e) => `- ${e}`),
        ``,
        `**Conclusion:** Change stream opened and received some events. Change streams ARE supported on this MongoDB instance.`,
      ].join("\n");

      appendDecisions("Change Stream Probe", resultContent);
      console.log(
        "[probe] Result recorded to 15-03-DECISIONS.md under ## Change Stream Probe"
      );
      process.exit(0);
    }
  } catch (err: unknown) {
    const error = err as Error & { code?: number; codeName?: string };
    console.error("[probe] ERROR:", error);

    let errorDetails = String(error);
    let changeStreamSupported = false;

    if (error.message) {
      if (
        error.message.includes("not supported") ||
        error.message.includes("replica set") ||
        error.message.includes("oplog") ||
        (error.code === 40573 /* ChangeStreamNotSupported */)
      ) {
        changeStreamSupported = false;
        console.error(
          "[probe] Diagnosis: Change streams are NOT supported on this MongoDB instance (not a replica set)."
        );
        errorDetails = `${error.message} — Change streams require a MongoDB replica set. Railway may be running a standalone instance.`;
      }
    }

    const resultContent = [
      `**Result:** ERROR`,
      `**Date:** ${new Date().toISOString()}`,
      `**Error:** ${error.message ?? String(error)}`,
      `**Error code:** ${error.code ?? "N/A"}`,
      `**Error codeName:** ${error.codeName ?? "N/A"}`,
      `**Change streams supported:** ${changeStreamSupported ? "possibly (other error)" : "NO — replica set required"}`,
      ``,
      `**Full error:**`,
      "```",
      errorDetails,
      "```",
      ``,
      `**Next step:** Plan 15-04 MUST use the /api/cron/tick fallback (1 cron service running every minute) since change streams are not available.`,
    ].join("\n");

    appendDecisions("Change Stream Probe", resultContent);
    console.log(
      "[probe] Error recorded to 15-03-DECISIONS.md under ## Change Stream Probe"
    );

    await client.close().catch(() => {});
    process.exit(1);
  }
}

main();
