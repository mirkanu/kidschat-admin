/**
 * POST /api/cron/limit-enforcement
 *
 * Iterates all non-ADMIN users and runs enforceChildLimits for each.
 * Collects enforcement actions and returns a summary.
 *
 * Schedule: every 2 minutes (staggered +1 min after cost-ledger-sweep)
 * Auth: x-cron-secret header
 */
import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { enforceChildLimits } from "@/lib/enforcement";
import type { EnforcementResult } from "@/lib/enforcement";

interface ActionSummary extends EnforcementResult {
  childName: string;
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  // Get all non-ADMIN users
  const users = await db
    .collection("users")
    .find({ role: { $ne: "ADMIN" } })
    .project<{ _id: { toString(): string }; name: string }>({ _id: 1, name: 1 })
    .toArray();

  const enforced: ActionSummary[] = [];

  for (const user of users) {
    try {
      const userId = user._id.toString();
      const childName = user.name ?? "Unknown";
      const result = await enforceChildLimits(userId, childName, db);
      if (result.action !== "no_action") {
        enforced.push({ ...result, childName });
      }
    } catch (err) {
      console.error(`[limit-enforcement] Error enforcing limits for user ${user._id}:`, err);
    }
  }

  return NextResponse.json({ enforced });
}
