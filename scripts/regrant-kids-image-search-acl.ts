/**
 * scripts/regrant-kids-image-search-acl.ts
 *
 * Phase 21-04 Task 03 — GO-LIVE FLIP for Penelope + Sebastian.
 *
 * Idempotent ACL re-grant: inserts `aclentries` rows granting Penelope + Sebastian
 * read/use permission (permBits=1) on the Image Search agent. Rows were deleted at
 * Phase 20 close (D-9 rollout gate) so kids would not see the preset during POC.
 *
 * Looks up the agent's MongoDB `_id` dynamically from the `agents` collection by
 * `id` field, matching the agent_id constant from 20-02-GIST-REFS.md.
 * Looks up kids' userIds dynamically from the `users` collection by name match,
 * with hardcoded ObjectId fallbacks from STATE.md (verified 2026-04-20).
 *
 * Before/after `aclentries` counts for the Image Search resourceId are logged.
 * Running twice yields only `[skip]` lines — no duplicate inserts.
 *
 * Usage (Railway has MONGODB_URI in its env):
 *   railway run --service kidschat-admin npx tsx scripts/regrant-kids-image-search-acl.ts
 *
 * Local (switchyard proxy) with MONGODB_URI set:
 *   MONGODB_URI=<switchyard-url> npx tsx scripts/regrant-kids-image-search-acl.ts
 */

import { MongoClient, ObjectId } from "mongodb";

const IMAGE_SEARCH_AGENT_ID_FIELD = "agent_kidschat_imagesearch_1776667852767";
// Fallback hardcoded from STATE.md / 20-UAT.md (verified 2026-04-20).
const HARDCODED = {
  MANUEL_ID: new ObjectId("69cfd4edf4044c9e5e4c039a"),
  SEBASTIAN_ID: new ObjectId("69d0315763d6125f1f553e97"),
  PENELOPE_ID: new ObjectId("69d0315763d6125f1f553e98"),
  AGENT_MONGO_ID: new ObjectId("69e5cd12f538d268466e71fd"),
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("ERROR: MONGODB_URI environment variable required.");
    console.error("Run via: railway run --service kidschat-admin npx tsx scripts/regrant-kids-image-search-acl.ts");
    process.exit(1);
  }

  const client = await MongoClient.connect(uri);
  try {
    const db = client.db("test"); // matches sibling routes (STATE.md Phase 21-02 note W3)
    const agents = db.collection("agents");
    const users = db.collection("users");
    const acl = db.collection("aclentries");

    // -------- 1. Resolve Image Search agent _id ---------------------------
    console.log(`[lookup] finding agent by id=${IMAGE_SEARCH_AGENT_ID_FIELD}`);
    const agentDoc = await agents.findOne({ id: IMAGE_SEARCH_AGENT_ID_FIELD });
    if (!agentDoc) {
      console.error(
        `[error] Image Search agent not found by id=${IMAGE_SEARCH_AGENT_ID_FIELD}; falling back to hardcoded AGENT_MONGO_ID ${HARDCODED.AGENT_MONGO_ID.toHexString()}`
      );
    }
    const agentMongoId: ObjectId = agentDoc?._id ?? HARDCODED.AGENT_MONGO_ID;
    console.log(`[lookup] agent._id = ${agentMongoId.toHexString()}`);

    // -------- 2. Resolve kid userIds --------------------------------------
    const resolveKid = async (
      name: string,
      fallbackId: ObjectId
    ): Promise<{ name: string; id: ObjectId }> => {
      const u = await users.findOne({ name: new RegExp(`^${name}$`, "i") });
      if (u?._id) {
        console.log(`[lookup] ${name}.user._id = ${u._id.toHexString()} (by name)`);
        return { name, id: u._id as ObjectId };
      }
      console.warn(
        `[lookup] ${name} not found by name; using hardcoded fallback ${fallbackId.toHexString()}`
      );
      return { name, id: fallbackId };
    };
    const sebastian = await resolveKid("Sebastian", HARDCODED.SEBASTIAN_ID);
    const penelope = await resolveKid("Penelope", HARDCODED.PENELOPE_ID);
    const KIDS = [sebastian, penelope];

    // -------- 3. Pre-state count ------------------------------------------
    const beforeCursor = await acl
      .find({ resourceId: agentMongoId })
      .toArray();
    console.log(
      `[pre-state] aclentries rows for resourceId=${agentMongoId.toHexString()}: ${beforeCursor.length}`
    );
    for (const row of beforeCursor) {
      console.log(
        `  - principalId=${String(row.principalId)} permBits=${row.permBits ?? row.roleId ?? "?"}`
      );
    }

    // -------- 4. Idempotent upsert per kid --------------------------------
    for (const kid of KIDS) {
      const existing = await acl.findOne({
        principalId: kid.id,
        resourceId: agentMongoId,
      });
      if (existing) {
        console.log(
          `[skip] ${kid.name} already has ACL row _id=${String(existing._id)} permBits=${existing.permBits ?? "?"}`
        );
        continue;
      }
      const doc = {
        principalId: kid.id,
        principalType: "user",
        resourceId: agentMongoId,
        resourceType: "agent",
        permBits: 1,
        grantedBy: HARDCODED.MANUEL_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const r = await acl.insertOne(doc);
      console.log(
        `[insert] ${kid.name} new _id=${r.insertedId.toString()} (principalId=${kid.id.toHexString()})`
      );
    }

    // -------- 5. Post-state count -----------------------------------------
    const afterCursor = await acl.find({ resourceId: agentMongoId }).toArray();
    console.log(
      `[post-state] aclentries rows for resourceId=${agentMongoId.toHexString()}: ${afterCursor.length}`
    );
    for (const row of afterCursor) {
      console.log(
        `  - principalId=${String(row.principalId)} permBits=${row.permBits ?? row.roleId ?? "?"}`
      );
    }

    // -------- 6. Kid-presence assertion -----------------------------------
    const kidIds = new Set(KIDS.map((k) => k.id.toHexString()));
    const kidRows = afterCursor.filter((r) =>
      kidIds.has(String(r.principalId))
    );
    console.log(
      `[assert] kids present in ACL: ${kidRows.length}/${KIDS.length} (${kidRows
        .map((r) => String(r.principalId))
        .join(", ")})`
    );
    if (kidRows.length < KIDS.length) {
      console.error(
        "[fail] expected both kids present in aclentries post-run; something is wrong."
      );
      process.exit(2);
    }
    console.log("[ok] both kids have ACL rows for the Image Search agent.");
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});

export { main };
