/**
 * 15-3-safety-restore.ts — One-shot idempotent cleanup script for Phase 15.3
 *
 * Neutralizes any stuck state left by Phase 15.2 UAT before files are deleted.
 * Supports --check-only flag to verify cleanliness without writing anything.
 *
 * Run (write mode):
 *   railway run --service kidschat-admin-production -- npx tsx scripts/15-3-safety-restore.ts
 *
 * Run (read-only verification):
 *   railway run --service kidschat-admin-production -- npx tsx scripts/15-3-safety-restore.ts --check-only
 */

import { MongoClient } from "mongodb";

const AGENT_ID = "agent_wxgt6su7d3pcosiil3";
const STUCK_PREFIXES = ["SYSTEM INSTRUCTION", "SYSTEM TEST"];
const CHECK_ONLY = process.argv.includes("--check-only");

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[15-3-safety-restore] ${msg}`);
}

function logBanner(msg: string) {
  console.error(`
${"=".repeat(60)}
MANUAL ACTION REQUIRED
${msg}
${"=".repeat(60)}
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("[15-3-safety-restore] ERROR: MONGODB_URI env var not set. Exiting.");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  let agentStatus = "clean";
  let balanceStateModified = 0;
  let bonusPurchasesStatus = "did not exist";
  let settingsModified = 0;
  let checkFailed = false;

  try {
    await client.connect();
    const db = client.db("test");

    // -----------------------------------------------------------------------
    // 1. Check / restore agent instructions
    // -----------------------------------------------------------------------

    const agentsCol = db.collection("agents");
    const agent = await agentsCol.findOne({ id: AGENT_ID });

    if (!agent) {
      log(`agent ${AGENT_ID} not found in agents collection — nothing to restore`);
      agentStatus = "not_found";
    } else {
      const instructions = agent.instructions as string | undefined;
      const isStuck = instructions != null && STUCK_PREFIXES.some((p) => instructions.startsWith(p));

      if (!isStuck) {
        log(`agent clean, no restore needed`);
        agentStatus = "clean";
      } else {
        log(`agent instructions start with SYSTEM prefix — searching for backup in balance_state...`);
        checkFailed = true;

        if (CHECK_ONLY) {
          agentStatus = "ERROR (stuck — SYSTEM prefix detected)";
        } else {
          // Search for originalAgentInstructions across all balance_state docs
          const bsCol = db.collection("balance_state");
          const stuckDocs = await bsCol
            .find({ originalAgentInstructions: { $type: "string", $ne: null } })
            .toArray();

          // Find one whose pendingWarning.agentId matches our target agent
          const matchingDoc = stuckDocs.find((doc) => {
            const pw = doc.pendingWarning as { agentId?: string } | null | undefined;
            return pw?.agentId === AGENT_ID;
          });

          if (matchingDoc && typeof matchingDoc.originalAgentInstructions === "string") {
            const restoredInstructions = matchingDoc.originalAgentInstructions;
            await agentsCol.updateOne(
              { id: AGENT_ID },
              { $set: { instructions: restoredInstructions } }
            );
            log(`RESTORED: agent ${AGENT_ID} instructions restored from balance_state backup`);
            agentStatus = "restored";
          } else {
            logBanner(
              `Could not find originalAgentInstructions for agent ${AGENT_ID}.\n` +
              `Please manually restore the Friendly Tutor agent instructions\n` +
              `via the LibreChat admin UI at:\n` +
              `https://librechat-production-bff2.up.railway.app/admin\n\n` +
              `The agent's instructions must NOT start with "SYSTEM INSTRUCTION" or "SYSTEM TEST".`
            );
            agentStatus = "ERROR (manual restore required)";
            process.exit(1);
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 2. Clean up balance_state — unset all bonus/warning fields
    // -----------------------------------------------------------------------

    const balanceStateCol = db.collection("balance_state");

    if (CHECK_ONLY) {
      // Check if any docs have any of the stuck fields
      const stuckCount = await balanceStateCol.countDocuments({
        $or: [
          { pendingWarning: { $exists: true } },
          { originalAgentInstructions: { $exists: true } },
          { activeOfferMessageId: { $exists: true } },
          { activeOfferExpiresAt: { $exists: true } },
          { activeOfferConversationId: { $exists: true } },
          { warnedAt70PctOn: { $exists: true } },
        ],
      });
      if (stuckCount > 0) {
        log(`balance_state: ${stuckCount} docs have stuck bonus/warning fields — NOT clean`);
        checkFailed = true;
        balanceStateModified = stuckCount;
      } else {
        log(`balance_state: clean (no stuck fields)`);
        balanceStateModified = 0;
      }
    } else {
      const bsResult = await balanceStateCol.updateMany(
        {},
        {
          $unset: {
            pendingWarning: "",
            originalAgentInstructions: "",
            activeOfferMessageId: "",
            activeOfferExpiresAt: "",
            activeOfferConversationId: "",
            warnedAt70PctOn: "",
          },
        }
      );
      balanceStateModified = bsResult.modifiedCount;
      log(`balance_state cleaned: ${balanceStateModified} docs`);
    }

    // -----------------------------------------------------------------------
    // 3. Drop bonus_purchases collection
    // -----------------------------------------------------------------------

    const collections = await db.listCollections({ name: "bonus_purchases" }).toArray();
    const bonusPurchasesExists = collections.length > 0;

    if (CHECK_ONLY) {
      if (bonusPurchasesExists) {
        log(`bonus_purchases collection: EXISTS — not clean`);
        bonusPurchasesStatus = "still exists";
        checkFailed = true;
      } else {
        log(`bonus_purchases collection: does not exist — clean`);
        bonusPurchasesStatus = "does not exist";
      }
    } else {
      if (bonusPurchasesExists) {
        await db.collection("bonus_purchases").drop().catch(() => void 0);
        bonusPurchasesStatus = "dropped";
        log(`bonus_purchases collection: dropped`);
      } else {
        bonusPurchasesStatus = "did not exist";
        log(`bonus_purchases collection: did not exist`);
      }
    }

    // -----------------------------------------------------------------------
    // 4. Clean settings docs — unset bonus fields
    // -----------------------------------------------------------------------

    const settingsCol = db.collection("settings");

    if (CHECK_ONLY) {
      const dirtySettings = await settingsCol.countDocuments({
        $or: [
          { bonusPackEur: { $exists: true } },
          { weeklyBonusCapEur: { $exists: true } },
          { bonusMessageTemplate: { $exists: true } },
        ],
      });
      if (dirtySettings > 0) {
        log(`settings: ${dirtySettings} docs have bonus fields — NOT clean`);
        checkFailed = true;
        settingsModified = dirtySettings;
      } else {
        log(`settings: clean (no bonus fields)`);
        settingsModified = 0;
      }
    } else {
      const settingsResult = await settingsCol.updateMany(
        {},
        {
          $unset: {
            bonusPackEur: "",
            weeklyBonusCapEur: "",
            bonusMessageTemplate: "",
          },
        }
      );
      settingsModified = settingsResult.modifiedCount;
      log(`settings cleaned: ${settingsModified} docs`);
    }

    // -----------------------------------------------------------------------
    // 5. Summary
    // -----------------------------------------------------------------------

    console.log("\n--- Summary ---");
    log(`agent: ${agentStatus}`);
    log(`balance_state cleaned: ${balanceStateModified} docs`);
    log(`bonus_purchases collection: ${bonusPurchasesStatus}`);
    log(`settings cleaned: ${settingsModified} docs`);
    log(CHECK_ONLY ? (checkFailed ? "CHECK FAILED — not clean" : "CHECK PASSED — all clean") : "DONE");

    if (CHECK_ONLY && checkFailed) {
      process.exit(1);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("[15-3-safety-restore] Unhandled error:", err);
  process.exit(1);
});
