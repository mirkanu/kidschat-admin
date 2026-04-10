/**
 * Migration script for Plan 15-04 — Phase 15.1 gap closure.
 *
 * Usage (against Railway MongoDB):
 *   railway run --service kidschat-admin npx tsx scripts/migrate-15-04.ts
 *
 * What this does:
 * 1. Rewrites settings docs to new schema (dailyCostCapEur, monthlyCostCapEur, etc.)
 * 2. Seeds balance_state collection for every non-admin child
 * 3. Drops cost_ledger collection (NamespaceNotFound → no-op)
 * 4. Drops locked_acl_entries collection (NamespaceNotFound → no-op)
 *
 * Idempotent: safe to re-run. Already-migrated docs are left unchanged.
 * Exits 0 on success, 1 on error.
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI environment variable is not set.");
  console.error("Run via: railway run --service kidschat-admin npx tsx scripts/migrate-15-04.ts");
  process.exit(1);
}

async function run() {
  console.log("[migrate-15-04] Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db("test");
  console.log("[migrate-15-04] Connected to db: test");

  // ---- Step 1: Rewrite settings docs ----
  console.log("\n[migrate-15-04] Step 1: Rewriting settings docs to new schema...");

  const settingsCol = db.collection("settings");
  const allSettings = await settingsCol.find({}).toArray();
  console.log(`[migrate-15-04] Found ${allSettings.length} settings docs`);

  for (const doc of allSettings) {
    const id = doc._id as string;

    if (id === "global_defaults") {
      // Already migrated?
      if (doc.key === "global_defaults" && "dailyCostCapEur" in doc) {
        console.log(`[migrate-15-04]   global_defaults: already migrated (skip)`);
        continue;
      }

      // Map old fields to new fields
      const newDoc: Record<string, unknown> = {
        key: "global_defaults",
        dailyCostCapEur: (doc.dailyCostCapEur as number | undefined) ?? 0.10,
        monthlyCostCapEur: (doc.monthlyCostCapEUR as number | undefined) ?? (doc.monthlyCostCapEur as number | undefined) ?? 2.00,
        bonusPackEur: (doc.bonusPackSize as number | undefined) ?? (doc.bonusPackEur as number | undefined) ?? 0.20,
        weeklyBonusCapEur: (doc.weeklyBonusCap as number | undefined) ?? (doc.weeklyBonusCapEur as number | undefined) ?? 0.50,
        bonusMessageTemplate: (doc.bonusMessageTemplate as string | undefined) ?? "You've reached your limit. Type YES to unlock extra usage.",
        // Drop: dailyImageLimit, dailyMessageLimit, monthlyCostCapEUR, weeklyBonusCap, bonusPackSize
      };

      await settingsCol.replaceOne({ _id: id } as Parameters<typeof settingsCol.replaceOne>[0], { _id: id, ...newDoc } as Parameters<typeof settingsCol.replaceOne>[1]);
      console.log(`[migrate-15-04]   global_defaults: migrated → dailyCostCapEur=${newDoc.dailyCostCapEur}, monthlyCostCapEur=${newDoc.monthlyCostCapEur}`);

    } else if (typeof id === "string" && id.startsWith("override_")) {
      const userId = id.replace("override_", "");

      // Already migrated?
      if (doc.key === "child_override") {
        console.log(`[migrate-15-04]   ${id}: already migrated (skip)`);
        continue;
      }

      const newDoc: Record<string, unknown> = {
        key: "child_override",
        userId,
      };

      // Only keep EUR-denominated fields
      if (doc.dailyCostCapEur != null) newDoc.dailyCostCapEur = doc.dailyCostCapEur;
      if (doc.monthlyCostCapEur != null) newDoc.monthlyCostCapEur = doc.monthlyCostCapEur;
      if (doc.monthlyCostCapEUR != null) newDoc.monthlyCostCapEur = doc.monthlyCostCapEUR; // rename
      if (doc.bonusPackEur != null) newDoc.bonusPackEur = doc.bonusPackEur;
      if (doc.bonusPackSize != null) newDoc.bonusPackEur = doc.bonusPackSize; // rename
      if (doc.weeklyBonusCapEur != null) newDoc.weeklyBonusCapEur = doc.weeklyBonusCapEur;
      if (doc.weeklyBonusCap != null) newDoc.weeklyBonusCapEur = doc.weeklyBonusCap; // rename
      // Drop: dailyImageLimit, dailyMessageLimit, awaitingBonusConfirmation, confirmationOfferedAt, etc.

      await settingsCol.replaceOne({ _id: id } as Parameters<typeof settingsCol.replaceOne>[0], { _id: id, ...newDoc } as Parameters<typeof settingsCol.replaceOne>[1]);
      console.log(`[migrate-15-04]   ${id}: migrated to child_override for userId=${userId}`);

    } else {
      console.log(`[migrate-15-04]   ${id}: unknown doc shape, skipping`);
    }
  }

  // If no global_defaults doc exists, insert a default one
  const existingGlobal = await settingsCol.findOne({ _id: "global_defaults" } as Parameters<typeof settingsCol.findOne>[0]);
  if (!existingGlobal) {
    await settingsCol.insertOne({
      _id: "global_defaults",
      key: "global_defaults",
      dailyCostCapEur: 0.10,
      monthlyCostCapEur: 2.00,
      bonusPackEur: 0.20,
      weeklyBonusCapEur: 0.50,
      bonusMessageTemplate: "You've reached your limit. Type YES to unlock extra usage.",
    } as Parameters<typeof settingsCol.insertOne>[0]);
    console.log(`[migrate-15-04]   global_defaults: inserted with HARDCODED_DEFAULTS`);
  }

  // ---- Step 2: Seed balance_state for every non-admin child ----
  console.log("\n[migrate-15-04] Step 2: Seeding balance_state for non-admin users...");

  const usersCol = db.collection("users");
  const nonAdminUsers = await usersCol.find({ role: { $ne: "ADMIN" } }).toArray();
  console.log(`[migrate-15-04] Found ${nonAdminUsers.length} non-admin users`);

  const balanceStateCol = db.collection("balance_state");
  const now = new Date();
  const startOfUtcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfUtcMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let seeded = 0;
  let skipped = 0;

  for (const user of nonAdminUsers) {
    const userId = user._id.toString();
    const existing = await balanceStateCol.findOne({ userId });
    if (existing) {
      skipped++;
      continue;
    }

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
    console.log(`[migrate-15-04]   Seeded balance_state for userId=${userId} (${user.name ?? user.email})`);
  }

  console.log(`[migrate-15-04] balance_state: ${seeded} seeded, ${skipped} already existed`);

  // ---- Step 3: Drop cost_ledger ----
  console.log("\n[migrate-15-04] Step 3: Dropping cost_ledger collection...");
  try {
    await db.collection("cost_ledger").drop();
    console.log("[migrate-15-04]   cost_ledger: DROPPED");
  } catch (err: unknown) {
    const mongoErr = err as { codeName?: string; code?: number };
    if (mongoErr.codeName === "NamespaceNotFound" || mongoErr.code === 26) {
      console.log("[migrate-15-04]   cost_ledger: does not exist (no-op)");
    } else {
      throw err;
    }
  }

  // ---- Step 4: Drop locked_acl_entries ----
  console.log("\n[migrate-15-04] Step 4: Dropping locked_acl_entries collection...");
  try {
    await db.collection("locked_acl_entries").drop();
    console.log("[migrate-15-04]   locked_acl_entries: DROPPED");
  } catch (err: unknown) {
    const mongoErr = err as { codeName?: string; code?: number };
    if (mongoErr.codeName === "NamespaceNotFound" || mongoErr.code === 26) {
      console.log("[migrate-15-04]   locked_acl_entries: does not exist (no-op)");
    } else {
      throw err;
    }
  }

  await client.close();
  console.log("\n[migrate-15-04] Migration complete. Exiting 0.");
}

run().then(() => process.exit(0)).catch((err) => {
  console.error("[migrate-15-04] FATAL ERROR:", err);
  process.exit(1);
});
