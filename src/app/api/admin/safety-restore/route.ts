/**
 * Temporary API route for Phase 15.3 safety restore.
 * MUST be deleted after use (Task 2 deletes this file).
 *
 * Protected by CRON_SECRET header.
 * POST /api/admin/safety-restore
 *   ?checkOnly=true  → read-only mode
 */

import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";

const AGENT_ID = "agent_wxgt6su7d3pcosiil3";
const STUCK_PREFIXES = ["SYSTEM INSTRUCTION", "SYSTEM TEST"];

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkOnly = req.nextUrl.searchParams.get("checkOnly") === "true";

  const results: Record<string, unknown> = {
    agentStatus: "unknown",
    balanceStateCleaned: 0,
    bonusPurchasesStatus: "unknown",
    settingsCleaned: 0,
    checkOnly,
  };

  try {
    const mongoClient = await getMongoClient();
    const db = mongoClient.db("test");

    // 1. Agent instructions check/restore
    const agentsCol = db.collection("agents");
    const agent = await agentsCol.findOne({ id: AGENT_ID });

    if (!agent) {
      results.agentStatus = "not_found";
    } else {
      const instructions = agent.instructions as string | undefined;
      const isStuck = instructions != null && STUCK_PREFIXES.some((p) => instructions.startsWith(p));

      if (!isStuck) {
        results.agentStatus = "clean";
      } else if (checkOnly) {
        results.agentStatus = "ERROR_stuck_prefix";
        results.checkFailed = true;
      } else {
        const bsCol = db.collection("balance_state");
        const stuckDocs = await bsCol
          .find({ originalAgentInstructions: { $type: "string", $ne: null } })
          .toArray();

        const matchingDoc = stuckDocs.find((doc) => {
          const pw = doc.pendingWarning as { agentId?: string } | null | undefined;
          return pw?.agentId === AGENT_ID;
        });

        if (matchingDoc && typeof matchingDoc.originalAgentInstructions === "string") {
          await agentsCol.updateOne(
            { id: AGENT_ID },
            { $set: { instructions: matchingDoc.originalAgentInstructions } }
          );
          results.agentStatus = "restored";
        } else {
          results.agentStatus = "ERROR_no_backup_found";
          results.error = "No originalAgentInstructions backup found in balance_state. Manual restore required.";
          return NextResponse.json(results, { status: 500 });
        }
      }
    }

    // 2. Balance state cleanup
    const balanceStateCol = db.collection("balance_state");
    if (checkOnly) {
      const count = await balanceStateCol.countDocuments({
        $or: [
          { pendingWarning: { $exists: true } },
          { originalAgentInstructions: { $exists: true } },
          { activeOfferMessageId: { $exists: true } },
          { activeOfferExpiresAt: { $exists: true } },
          { activeOfferConversationId: { $exists: true } },
          { warnedAt70PctOn: { $exists: true } },
        ],
      });
      results.balanceStateCleaned = count;
      if (count > 0) results.checkFailed = true;
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
      results.balanceStateCleaned = bsResult.modifiedCount;
    }

    // 3. Drop bonus_purchases collection
    const collections = await db.listCollections({ name: "bonus_purchases" }).toArray();
    const exists = collections.length > 0;
    if (checkOnly) {
      results.bonusPurchasesStatus = exists ? "still_exists" : "does_not_exist";
      if (exists) results.checkFailed = true;
    } else {
      if (exists) {
        await db.collection("bonus_purchases").drop().catch(() => void 0);
        results.bonusPurchasesStatus = "dropped";
      } else {
        results.bonusPurchasesStatus = "did_not_exist";
      }
    }

    // 4. Clean settings
    const settingsCol = db.collection("settings");
    if (checkOnly) {
      const count = await settingsCol.countDocuments({
        $or: [
          { bonusPackEur: { $exists: true } },
          { weeklyBonusCapEur: { $exists: true } },
          { bonusMessageTemplate: { $exists: true } },
        ],
      });
      results.settingsCleaned = count;
      if (count > 0) results.checkFailed = true;
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
      results.settingsCleaned = settingsResult.modifiedCount;
    }

    results.done = true;
    return NextResponse.json(results, { status: 200 });
  } catch (err) {
    console.error("[safety-restore] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
