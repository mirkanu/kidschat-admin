---
status: complete
phase: 260417-cs0-preset-aware-guidance
plan: 01
subsystem: librechat-agents
tags: [librechat, mongodb, agents, preset, guidance, dalle, quick-task]
uat:
  passed_at: 2026-04-17
  test_a_text_redirect: PASS
  test_b_drawing_studio_off_topic: PASS
  test_c_drawing_studio_clarification_then_image: PASS
  followup_recovery: PASS  # User reported: switched preset after refusal, normal answer received
post_uat_fix:
  - "Drawing Studio had 0 ACL entries (latent Phase 19-01 bug — agent created via direct MongoDB insert, ACL grant skipped). 5 ACL entries inserted matching Friendly Tutor pattern (Manuel: agent+remoteAgent permBits=15; Emily-Kate, Sebastian, Penelope: agent permBits=1). Without this, Drawing Studio was invisible to all users since launch."

requires:
  - phase: 19-01
    provides: Drawing Studio agent (agent_kidschat_drawing_1775634945891) exists with tools:["dalle"]; 4 text agents have tools:[]

provides:
  - 5 in-UI agents have KIDCHAT_PRESET_GUIDANCE_v1 marker + appropriate guidance block appended to their instructions field in MongoDB
  - Stray agent agent_F6ITBo7EuorE7vqrXsNAm deleted from agents collection + 5 aclentries bindings removed
  - Idempotent scripts committed to task dir (re-runnable for future guidance tweaks)
  - Before/after snapshots (10 agent snapshots + 1 recovery artifact) for rollback

affects: [child-chat-ui, dalle-budget, off-topic-gate]

tech-stack:
  added: []
  patterns:
    - "Sentinel marker pair (`_START` / `_END`) around injected guidance block for idempotent append-only edits"
    - "aclentries cleanup via resourceId = agent._id (Mongo ObjectId, not public string id) — pattern from Phase 15"

key-files:
  created:
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/scripts/apply-preset-guidance.mjs
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/scripts/delete-stray-image-generator.mjs
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/before-friendly-tutor.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/before-casual-buddy.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/before-balanced-helper.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/before-standard-formal.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/before-drawing-studio.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/before-image-generator-deleted.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/after-friendly-tutor.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/after-casual-buddy.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/after-balanced-helper.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/after-standard-formal.json
    - .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/snapshots/after-drawing-studio.json
  modified:
    - "(MongoDB) agents collection: 5 agents updated (instructions appended), 1 agent deleted"
    - "(MongoDB) aclentries collection: 5 entries bound to deleted agent's _id removed"

key-decisions:
  - "Sentinel marker pair (KIDCHAT_PRESET_GUIDANCE_v1_START / _END) chosen over single-line marker for future-proofing: allows a later script to locate, replace, or strip the entire block atomically without regex gymnastics."
  - "Drawing Studio guidance explicitly whitelists clarification replies (turn kind #2) so the short plain answers kids send in response to clarifying questions aren't misclassified as off-topic chat — preserves the clarification-first DALL-E-budget-saving flow from Phase 19-01."
  - "Delete-order for Image Generator: capture Mongo _id first, THEN deleteMany aclentries by resourceId, THEN deleteOne the agent — ensures no orphan ACLs if the script aborts mid-way. Verified 5 ACL bindings removed before the agent doc was deleted."
  - "Guidance appended (not inline-woven) to existing instructions — append-only guarantees Phase 19-01's clarification-first training stays intact; `before.instructions` is a strict prefix of `after.instructions` (verified via prefix-check on drawing-studio snapshots)."

patterns-established:
  - "Future agent prompt edits should use the marker-wrap + idempotency-guard pattern from apply-preset-guidance.mjs — re-running the script on a freshly edited block should be a no-op."

requirements-completed:
  - CS0-GUIDANCE-TEXT-AGENTS
  - CS0-GUIDANCE-DRAWING-STUDIO
  - CS0-CLEANUP-IMAGE-GENERATOR

duration: 6min (Tasks 1+2; Task 3 UAT pending)
completed: 2026-04-17 (Tasks 1-2 complete; Task 3 UAT checkpoint — awaiting parent verification)
---

# Quick Task 260417-cs0: Preset-Aware Guidance — Summary (Tasks 1-2 Complete, Task 3 Awaiting UAT)

**5 KidsChat agents now have preset-aware guidance blocks (DRAWING REQUESTS on 4 text presets, STAY ON TOPIC on Drawing Studio); stray Image Generator agent + 5 ACL bindings deleted; idempotent scripts committed; awaiting parent UAT before marking plan complete.**

## Performance

- **Duration:** ~6 min for Tasks 1-2 (automated MongoDB edits)
- **Started:** 2026-04-17T09:11:24Z
- **Completed (Tasks 1-2):** 2026-04-17T09:17:46Z
- **Task 3 UAT:** pending — parent must perform child UI verification
- **Tasks:** 2/3 complete (Task 3 is `checkpoint:human-verify`)
- **Files created:** 13 (2 scripts + 11 snapshots)

## Accomplishments

- Wrote idempotent `apply-preset-guidance.mjs` script; ran it twice against live MongoDB. First run wrote the guidance block to all 5 agents (Friendly Tutor 2840→3386 chars, Casual Buddy 2821→3367, Balanced Helper 2824→3370, Standard Formal 2786→3332, Drawing Studio 2626→3747). Second run reported `[skip]` for all 5 and made no writes — idempotency proven.
- Wrote idempotent `delete-stray-image-generator.mjs` script; ran it twice. First run captured the full Image Generator doc + 5 matching aclentries to `before-image-generator-deleted.json`, deleted the 5 ACL bindings, then deleted the agent doc; post-delete verification confirmed `findOne` returns `null` and aclentries count is 0. Second run reported `[skip]` (agent already gone).
- Verified append-only mutation of Drawing Studio instructions: `before.instructions` is a strict prefix of `after.instructions` — existing clarification-first training preserved.

## Task Commits

1. **Task 1: Inject preset guidance into 5 agents** — `b51b74c` (feat(260417-cs0): inject preset-aware guidance into 5 KidsChat agents)
2. **Task 2: Delete stray Image Generator + ACL cleanup** — `99a19b3` (feat(260417-cs0): delete stray Image Generator agent + 5 ACL bindings)
3. **Task 3: UAT** — NOT committed (human-verify checkpoint; parent must run tests from child account)

## Files Created/Modified

### Task 1 (5 agents updated)

- **Script:** `.planning/quick/260417-cs0-.../scripts/apply-preset-guidance.mjs`
- **Before-snapshots (rollback):**
  - `snapshots/before-friendly-tutor.json`  (full Mongo doc, pre-edit)
  - `snapshots/before-casual-buddy.json`
  - `snapshots/before-balanced-helper.json`
  - `snapshots/before-standard-formal.json`
  - `snapshots/before-drawing-studio.json`
- **After-snapshots:** matching `snapshots/after-*.json` (post-edit, with marker + guidance block)
- **MongoDB:** `agents.instructions` appended on 5 docs (ids `agent_wxgt6su7d3pcosiil3`, `agent_y4w1cvoyg77p9thed9`, `agent_64q6z5s57552cpgl0hr`, `agent_aiv99mzvdzquym6y89k`, `agent_kidschat_drawing_1775634945891`)

### Task 2 (1 agent deleted)

- **Script:** `.planning/quick/260417-cs0-.../scripts/delete-stray-image-generator.mjs`
- **Recovery artifact:** `snapshots/before-image-generator-deleted.json` (full agent doc + array of 5 aclentries)
- **MongoDB:**
  - `agents` collection: `agent_F6ITBo7EuorE7vqrXsNAm` deleted
  - `aclentries` collection: 5 entries with `resourceId = ObjectId("69d8aead89823f56120e6122")` deleted

## Decisions Made

- **Marker pair (`_START`/`_END`) instead of single-line sentinel:** makes the injected block a discrete, future-editable region. A follow-up script could locate the range and replace it without touching the surrounding prompt text.
- **Drawing Studio guidance whitelists clarification replies explicitly:** the block names "turn kind #2: clarification reply in response to YOUR most recent clarifying question" as always-allowed, so a kid saying "golden retriever, outdoor, sunny day" after DS asks "what kind of dog?" is correctly classified as on-topic. Without this carve-out, the STAY ON TOPIC guidance could regress Phase 19-01's clarification-first DALL-E-budget-saving flow.
- **Delete-order for Image Generator (ACL → agent):** capturing the `_id` first, then deleting aclentries, then deleting the agent doc means that if the script aborts after step 2 but before step 3, there are zero orphan ACLs (safe state). Reversing the order could leave ACL entries pointing at a deleted agent.
- **Append-only mutation:** guidance is concatenated onto existing `instructions` with a `\n\n` separator. Guaranteed to preserve all Phase 19-01 training by strict-prefix check. Non-destructive even if the guidance wording needs future iteration — rollback is `findOne` of before-snapshot + `updateOne $set instructions`.

## Deviations from Plan

None — plan executed exactly as written. The sentinel marker was upgraded to a `_START`/`_END` pair (per the execution constraints note in the prompt) while the plan's acceptance criteria referenced the base string `KIDCHAT_PRESET_GUIDANCE_v1`. The pair-marker format satisfies both: `grep -q 'KIDCHAT_PRESET_GUIDANCE_v1'` matches the START marker in all 5 after-snapshots (verified).

## Authentication Gates

None — MongoDB TCP proxy credentials were embedded in the plan and worked on first attempt.

## Issues Encountered

None. Both scripts ran cleanly on first invocation; idempotency worked on second invocation without manual intervention.

## Rollback Path

### Rollback Task 1 (restore any single agent's instructions)

```javascript
// For any agent, restore from before-snapshot:
const before = require('./snapshots/before-<slug>.json');
await db.collection('agents').updateOne(
  { id: before.id },
  { $set: { instructions: before.instructions } }
);
```

All 5 before-snapshots contain the full pre-edit document (not just `instructions`), so other fields can also be restored if needed.

### Rollback Task 2 (re-insert Image Generator)

```javascript
// Restore the deleted agent (note: loses the original _id — a new one will be assigned):
const snap = require('./snapshots/before-image-generator-deleted.json');
const { _id, ...agentDoc } = snap.agent;  // drop old _id so Mongo assigns new one
await db.collection('agents').insertOne(agentDoc);
// If you need to restore ACL bindings, they're in snap.aclentries — but their resourceId
// will need to be updated to the NEW _id, since the old ObjectId is gone.
```

## Task 3 — Awaiting Parent UAT

Task 3 is a `checkpoint:human-verify` gate. The parent must run four tests from a **child** account in LibreChat (not admin) at https://librechat-production-bff2.up.railway.app:

- **Test A — Text preset rejects drawing request:** In Friendly Tutor, send `draw me a dog` → expect friendly redirect pointing to Drawing Studio, no image generated.
- **Test B — Drawing Studio refuses off-topic:** In Drawing Studio, send `what's 7x8?` → expect gentle refusal naming all 4 chat presets, no image, no math answer.
- **Test C — Drawing Studio clarification flow still works:** In Drawing Studio, send `draw me a dog` → expect a clarifying question (no image yet). Reply `golden retriever, outdoor, sunny day` → expect an image is generated. This proves the nuanced gate doesn't over-block.
- **Picker check:** Preset picker shows exactly 5 presets (no "Image Generator" entry).

If any test fails, the parent reports the actual agent response verbatim and we iterate on the guidance wording by re-running `apply-preset-guidance.mjs` with tweaked block contents (idempotent by marker — would need a `--force` flag or a stripping pre-step for re-injection; easiest path is: edit the before-snapshot's `instructions` back in via a one-liner updateOne, then re-run the script).

No redeploy needed — LibreChat reads `agents.instructions` live on every turn.

## Known Stubs

None — all guidance blocks are fully populated with exact phrasing from `CONTEXT.md` `<specifics>`; no placeholder text.

## Self-Check: PASSED

Verified (2026-04-17):

- `FOUND: .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/scripts/apply-preset-guidance.mjs`
- `FOUND: .planning/quick/260417-cs0-preset-aware-guidance-kids-told-to-switc/scripts/delete-stray-image-generator.mjs`
- `FOUND: snapshots/before-friendly-tutor.json, before-casual-buddy.json, before-balanced-helper.json, before-standard-formal.json, before-drawing-studio.json, before-image-generator-deleted.json`
- `FOUND: snapshots/after-friendly-tutor.json, after-casual-buddy.json, after-balanced-helper.json, after-standard-formal.json, after-drawing-studio.json`
- `FOUND: commit b51b74c (Task 1)`
- `FOUND: commit 99a19b3 (Task 2)`
- VERIFY PASS from plan's automated block: `5 agents updated, marker + section headings present, second run idempotent`
- VERIFY PASS append-only: `Drawing Studio instructions append-only (existing training preserved)`
- VERIFY PASS deletion: `Image Generator deleted, second run idempotent, snapshot saved, aclentries=0`

---
*Quick task: 260417-cs0-preset-aware-guidance-kids-told-to-switc*
*Tasks 1-2 complete 2026-04-17; Task 3 UAT pending parent verification*
