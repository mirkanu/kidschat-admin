#!/usr/bin/env node
/**
 * apply-preset-guidance.mjs
 *
 * Idempotent MongoDB update script that injects preset-aware guidance into the
 * `instructions` field of all 5 in-UI KidsChat agents.
 *
 * - 4 text presets (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal)
 *   get a DRAWING REQUESTS block that redirects drawing requests to Drawing Studio.
 * - Drawing Studio gets a STAY ON TOPIC block that preserves its clarification-first
 *   flow but refuses off-topic chat.
 *
 * Idempotency: each injected block is wrapped with the sentinel marker
 *   <!-- KIDCHAT_PRESET_GUIDANCE_v1_START -->
 *   <!-- KIDCHAT_PRESET_GUIDANCE_v1_END -->
 * The script detects the START marker and skips any agent already patched.
 *
 * Writes before/after JSON snapshots to ../snapshots/ for rollback.
 *
 * Run: node .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/scripts/apply-preset-guidance.mjs
 */

import { MongoClient } from 'mongodb';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = resolve(__dirname, '..', 'snapshots');
mkdirSync(SNAPSHOTS_DIR, { recursive: true });

const MONGO_URI = 'mongodb://mongo:bnwf4anlnxzvdrkwlvi4ki6q7p52o33q@switchyard.proxy.rlwy.net:57501';
const DB_NAME = 'test';
const COLLECTION = 'agents';

const MARKER_START = '<!-- KIDCHAT_PRESET_GUIDANCE_v1_START -->';
const MARKER_END = '<!-- KIDCHAT_PRESET_GUIDANCE_v1_END -->';

// The 4 text presets share this guidance block (wrapped in markers).
const TEXT_PRESET_GUIDANCE = `${MARKER_START}
## DRAWING REQUESTS

If the child asks you to draw, generate, create, or make an image/picture/drawing, DO NOT attempt to draw — you don't have image tools in this mode. Instead, redirect them warmly:

"I can't draw here! Tap the preset picker at the top and choose **Drawing Studio** to make pictures. ✨"

Keep the redirect short and friendly. Don't lecture. After the redirect, don't continue the conversation about drawing — they need to switch presets first.
${MARKER_END}`;

// Drawing Studio gets the nuanced STAY ON TOPIC block that preserves the
// clarification-first flow established in Phase 19-01.
const DRAWING_STUDIO_GUIDANCE = `${MARKER_START}
## STAY ON TOPIC

Your purpose is drawings and drawings only. BUT asking clarifying questions about a drawing-in-progress is on-topic (e.g. "what color?", "indoor or outdoor scene?", "what kind of dog?") — those are part of your drawing workflow, and a child's reply to one of your clarifying questions is ALSO on-topic even if it looks like a short plain answer.

Two kinds of text turns are always allowed:
1. A drawing request (draw me X, can you make a picture of Y, etc.)
2. A clarification reply the child sends in response to YOUR most recent clarifying question in this conversation.

For anything else — homework, general questions, just chatting, math, trivia — gently refuse and redirect:

"I only help with drawings here! To chat, switch to any chat preset — Friendly Tutor, Casual Buddy, Balanced Helper, or Standard Formal. 🎨"

After a drawing generates successfully, you MAY add one short line to remind them they can switch back:

"Want to chat about something else? Switch to any chat preset to save your daily budget."
${MARKER_END}`;

const AGENTS = [
  { id: 'agent_wxgt6su7d3pcosiil3',              slug: 'friendly-tutor',  kind: 'text'    },
  { id: 'agent_y4w1cvoyg77p9thed9',              slug: 'casual-buddy',    kind: 'text'    },
  { id: 'agent_64q6z5s57552cpgl0hr',             slug: 'balanced-helper', kind: 'text'    },
  { id: 'agent_aiv99mzvdzquym6y89k',             slug: 'standard-formal', kind: 'text'    },
  { id: 'agent_kidschat_drawing_1775634945891',  slug: 'drawing-studio',  kind: 'drawing' },
];

function snapshotPath(prefix, slug) {
  return resolve(SNAPSHOTS_DIR, `${prefix}-${slug}.json`);
}

function writeSnapshot(filePath, doc) {
  writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  const results = [];
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    for (const { id, slug, kind } of AGENTS) {
      const before = await col.findOne({ id });
      if (!before) {
        console.error(`[error] agent not found: ${id} (${slug})`);
        process.exit(1);
      }

      // Before-snapshot: full document (all fields).
      writeSnapshot(snapshotPath('before', slug), before);

      const currentInstructions = before.instructions ?? '';
      const beforeLen = currentInstructions.length;

      const alreadyPatched = currentInstructions.includes(MARKER_START);
      let skipped = false;
      let afterDoc;

      if (alreadyPatched) {
        console.log(`[skip] ${before.name}: marker already present (instructions length=${beforeLen})`);
        skipped = true;
        afterDoc = before;
      } else {
        const guidance = kind === 'drawing' ? DRAWING_STUDIO_GUIDANCE : TEXT_PRESET_GUIDANCE;
        const newInstructions = currentInstructions + '\n\n' + guidance;

        const res = await col.updateOne(
          { id },
          { $set: { instructions: newInstructions } }
        );
        if (res.matchedCount !== 1 || res.modifiedCount !== 1) {
          console.error(`[error] updateOne did not update ${id}: matched=${res.matchedCount}, modified=${res.modifiedCount}`);
          process.exit(1);
        }

        afterDoc = await col.findOne({ id });
        if (!afterDoc || !afterDoc.instructions.includes(MARKER_START)) {
          console.error(`[error] post-write verification failed for ${id}`);
          process.exit(1);
        }
        console.log(`[write] ${before.name}: ${beforeLen} → ${afterDoc.instructions.length} chars`);
      }

      writeSnapshot(snapshotPath('after', slug), afterDoc);

      results.push({
        name: before.name,
        slug,
        skipped,
        beforeLen,
        afterLen: (afterDoc.instructions ?? '').length,
      });
    }

    // Summary table
    console.log('');
    console.log('Summary:');
    console.log('name'.padEnd(30) + '| skipped?'.padEnd(11) + '| before_len'.padEnd(13) + '| after_len');
    console.log('-'.repeat(68));
    for (const r of results) {
      console.log(
        r.name.padEnd(30) +
        `| ${r.skipped ? 'yes' : 'no'}`.padEnd(11) +
        `| ${r.beforeLen}`.padEnd(13) +
        `| ${r.afterLen}`
      );
    }
    console.log('');
    console.log(`Done. ${results.length} agents processed. Snapshots in ${SNAPSHOTS_DIR}`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
