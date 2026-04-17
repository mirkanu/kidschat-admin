#!/usr/bin/env node
/**
 * delete-stray-image-generator.mjs
 *
 * Removes the stray "Image Generator" agent (agent_F6ITBo7EuorE7vqrXsNAm) from
 * MongoDB along with any aclentries bindings. The agent has DALL-E access but
 * is NOT in the UI preset picker — removing it eliminates any back-door image
 * generation surface.
 *
 * Order of operations (matters — capture resourceId BEFORE deleting the agent):
 *   1. findOne agent by `id` (public string id)
 *   2. capture the Mongo _id as `resourceId`
 *   3. snapshot the full agent doc + any matching aclentries to before-snapshot
 *   4. deleteMany aclentries where resourceId matches
 *   5. deleteOne agent by id
 *   6. verify: both return zero/null on follow-up queries
 *
 * Idempotent: if the agent is already gone, logs [skip] and exits cleanly.
 *
 * Run: node .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/scripts/delete-stray-image-generator.mjs
 */

import { MongoClient } from 'mongodb';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = resolve(__dirname, '..', 'snapshots');
mkdirSync(SNAPSHOTS_DIR, { recursive: true });

const SNAPSHOT_PATH = resolve(SNAPSHOTS_DIR, 'before-image-generator-deleted.json');

const MONGO_URI = 'mongodb://mongo:bnwf4anlnxzvdrkwlvi4ki6q7p52o33q@switchyard.proxy.rlwy.net:57501';
const DB_NAME = 'test';
const TARGET_ID = 'agent_F6ITBo7EuorE7vqrXsNAm';

function writeJson(filePath, obj) {
  writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const agents = db.collection('agents');
    const acls = db.collection('aclentries');

    const agent = await agents.findOne({ id: TARGET_ID });

    if (!agent) {
      console.log(`[skip] Image Generator already deleted (id=${TARGET_ID}) — no-op`);
      if (!existsSync(SNAPSHOT_PATH)) {
        writeJson(SNAPSHOT_PATH, {
          status: 'already_deleted',
          targetId: TARGET_ID,
          timestamp: new Date().toISOString(),
          note: 'Agent was not present at first invocation; snapshot could not be captured.',
        });
      }
      return;
    }

    // aclentries.resourceId is the MongoDB _id (ObjectId), not the public `id` string.
    // (Phase 15-safety-alert findings, STATE.md line 81)
    const resourceId = agent._id;
    const aclMatches = await acls.find({ resourceId }).toArray();
    console.log(`[info] agent found: ${agent.name || '(no name)'} _id=${resourceId}`);
    console.log(`[info] aclentries matching resourceId: ${aclMatches.length}`);
    for (const entry of aclMatches) {
      console.log(`       - principalId=${entry.principalId} _id=${entry._id}`);
    }

    // Full recovery artifact: agent doc + its aclentries.
    writeJson(SNAPSHOT_PATH, {
      status: 'deleted',
      deletedAt: new Date().toISOString(),
      targetId: TARGET_ID,
      resourceId: String(resourceId),
      agent,
      aclentries: aclMatches,
    });
    console.log(`[snapshot] wrote ${SNAPSHOT_PATH}`);

    // Delete ACL entries first, then the agent.
    const aclRes = await acls.deleteMany({ resourceId });
    console.log(`[delete] aclentries.deleteMany({resourceId}): deletedCount=${aclRes.deletedCount}`);

    const agentRes = await agents.deleteOne({ id: TARGET_ID });
    console.log(`[delete] agents.deleteOne({id: '${TARGET_ID}'}): deletedCount=${agentRes.deletedCount}`);

    // Post-delete verification.
    const postAgent = await agents.findOne({ id: TARGET_ID });
    if (postAgent !== null) {
      console.error(`[error] agent still exists after delete: ${TARGET_ID}`);
      process.exit(1);
    }
    const postAclCount = await acls.countDocuments({ resourceId });
    if (postAclCount !== 0) {
      console.error(`[error] ${postAclCount} aclentries still reference resourceId ${resourceId}`);
      process.exit(1);
    }

    console.log('[verify] agent is null, aclentries count is 0 — deletion complete');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
