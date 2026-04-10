/**
 * POST /api/admin/migrate
 *
 * One-shot migration endpoint for Plan 15-04.
 * Auth: x-admin-secret header (uses CRON_SECRET env var)
 *
 * IMPORTANT: Delete this file after the migration is confirmed.
 * This is a temporary endpoint to run the migration from inside the Railway container.
 */
import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-admin-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");
  const log: string[] = [];

  function record(msg: string) {
    console.log(`[migrate-15-04] ${msg}`);
    log.push(msg);
  }

  try {
    // ---- Step 1: Rewrite settings docs ----
    record("Step 1: Rewriting settings docs...");
    const settingsCol = db.collection("settings");
    const allSettings = await settingsCol.find({}).toArray();
    record(`Found ${allSettings.length} settings docs`);

    for (const doc of allSettings) {
      const id = String(doc._id);
      if (id === "global_defaults") {
        if (doc.key === "global_defaults" && "dailyCostCapEur" in doc) {
          record(`global_defaults: already migrated (skip)`);
          continue;
        }
        const newDoc = {
          key: "global_defaults",
          dailyCostCapEur: (doc.dailyCostCapEur as number | undefined) ?? 0.10,
          monthlyCostCapEur: (doc.monthlyCostCapEUR as number | undefined) ?? (doc.monthlyCostCapEur as number | undefined) ?? 2.00,
          bonusPackEur: (doc.bonusPackSize as number | undefined) ?? (doc.bonusPackEur as number | undefined) ?? 0.20,
          weeklyBonusCapEur: (doc.weeklyBonusCap as number | undefined) ?? (doc.weeklyBonusCapEur as number | undefined) ?? 0.50,
          bonusMessageTemplate: (doc.bonusMessageTemplate as string | undefined) ?? "You've reached your limit. Type YES to unlock extra usage.",
        };
        await settingsCol.replaceOne(
          { _id: id } as unknown as Parameters<typeof settingsCol.replaceOne>[0],
          { _id: id, ...newDoc } as unknown as Parameters<typeof settingsCol.replaceOne>[1]
        );
        record(`global_defaults: migrated → dailyCostCapEur=${newDoc.dailyCostCapEur}`);
      } else if (typeof id === "string" && id.startsWith("override_")) {
        if (doc.key === "child_override") {
          record(`${id}: already migrated (skip)`);
          continue;
        }
        const userId = id.replace("override_", "");
        const newDoc: Record<string, unknown> = { key: "child_override", userId };
        if (doc.dailyCostCapEur != null) newDoc.dailyCostCapEur = doc.dailyCostCapEur;
        if (doc.monthlyCostCapEur != null) newDoc.monthlyCostCapEur = doc.monthlyCostCapEur;
        if (doc.monthlyCostCapEUR != null) newDoc.monthlyCostCapEur = doc.monthlyCostCapEUR;
        if (doc.bonusPackEur != null) newDoc.bonusPackEur = doc.bonusPackEur;
        if (doc.bonusPackSize != null) newDoc.bonusPackEur = doc.bonusPackSize;
        if (doc.weeklyBonusCapEur != null) newDoc.weeklyBonusCapEur = doc.weeklyBonusCapEur;
        if (doc.weeklyBonusCap != null) newDoc.weeklyBonusCapEur = doc.weeklyBonusCap;
        await settingsCol.replaceOne(
          { _id: id } as unknown as Parameters<typeof settingsCol.replaceOne>[0],
          { _id: id, ...newDoc } as unknown as Parameters<typeof settingsCol.replaceOne>[1]
        );
        record(`${id}: migrated to child_override for userId=${userId}`);
      }
    }

    const existingGlobal = await settingsCol.findOne({ _id: "global_defaults" } as unknown as Parameters<typeof settingsCol.findOne>[0]);
    if (!existingGlobal) {
      await settingsCol.insertOne({
        _id: "global_defaults",
        key: "global_defaults",
        dailyCostCapEur: 0.10,
        monthlyCostCapEur: 2.00,
        bonusPackEur: 0.20,
        weeklyBonusCapEur: 0.50,
        bonusMessageTemplate: "You've reached your limit. Type YES to unlock extra usage.",
      } as unknown as Parameters<typeof settingsCol.insertOne>[0]);
      record("global_defaults: inserted with HARDCODED_DEFAULTS");
    }

    // ---- Step 2: Seed balance_state ----
    record("Step 2: Seeding balance_state for non-admin users...");
    const usersCol = db.collection("users");
    const nonAdminUsers = await usersCol.find({ role: { $ne: "ADMIN" } }).toArray();
    record(`Found ${nonAdminUsers.length} non-admin users`);

    const balanceStateCol = db.collection("balance_state");
    const now = new Date();
    const startOfUtcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfUtcMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    let seeded = 0;
    for (const user of nonAdminUsers) {
      const userId = user._id.toString();
      const existing = await balanceStateCol.findOne({ userId });
      if (existing) continue;
      await balanceStateCol.insertOne({
        userId,
        lastDailyReset: startOfUtcDay,
        lastMonthlyReset: startOfUtcMonth,
        monthlySpendEur: 0,
        warnedAt70PctOn: null,
        activeOfferMessageId: null,
        activeOfferExpiresAt: null,
        activeOfferConversationId: null,
      });
      seeded++;
      record(`Seeded balance_state for userId=${userId}`);
    }
    record(`balance_state: ${seeded} seeded`);

    // ---- Step 3: Drop cost_ledger ----
    record("Step 3: Dropping cost_ledger...");
    try {
      await db.collection("cost_ledger").drop();
      record("cost_ledger: DROPPED");
    } catch (err: unknown) {
      const e = err as { codeName?: string; code?: number };
      if (e.codeName === "NamespaceNotFound" || e.code === 26) {
        record("cost_ledger: does not exist (no-op)");
      } else { throw err; }
    }

    // ---- Step 4: Drop locked_acl_entries ----
    record("Step 4: Dropping locked_acl_entries...");
    try {
      await db.collection("locked_acl_entries").drop();
      record("locked_acl_entries: DROPPED");
    } catch (err: unknown) {
      const e = err as { codeName?: string; code?: number };
      if (e.codeName === "NamespaceNotFound" || e.code === 26) {
        record("locked_acl_entries: does not exist (no-op)");
      } else { throw err; }
    }

    record("Migration complete.");
    return NextResponse.json({ success: true, log });

  } catch (err) {
    console.error("[migrate-15-04] FATAL:", err);
    return NextResponse.json({ success: false, error: String(err), log }, { status: 500 });
  }
}
