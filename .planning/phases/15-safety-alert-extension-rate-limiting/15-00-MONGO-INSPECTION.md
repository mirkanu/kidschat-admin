# 15-00 MongoDB Inspection Results

**Run date:** 2026-04-10T10:41:43.924Z (updated 2026-04-10T10:50:00Z with corrections)
**Database:** test (Railway production)
**Script:** scripts/mongo-inspect.ts

---

## Field Shape Findings

| Collection | Field asked | Actual field name | Sample value | Notes |
|------------|-------------|-------------------|--------------|-------|
| balances | tokenCredits/credit | N/A | N/A | EMPTY — `balances` collection exists but has 0 documents; balance.enabled NOT set in librechat.yaml |
| balances | user/userId | N/A | N/A | EMPTY collection. Note: collection name is `balances` (plural), not `balance` |
| aclentries | user/principalId | `principalId` | `69cfd4edf4044c9e5e4c039a` | User field is `principalId`, NOT `user` |
| aclentries | resource/resourceId | `resourceId` | ObjectId (not agent string ID) | resourceId is MongoDB ObjectId of the agent doc. Filter by `resourceType: "agent"`, NOT `resource: /agent_/` |
| aclentries | permBits | `permBits` | `15` | 15 = full permission |
| aclentries | roleId | `roleId` | ObjectId | Present on all agent ACL entries |
| aclentries | resourceType | `resourceType` | `"agent"` | Use this to filter agent ACL entries (20 total = 5 per agent × 4 agents) |
| messages | tokenCount | `tokenCount` | `7` | IS populated on AI responses as flat integer (NOT split input/output) |
| messages | tokenCount.input/output | ABSENT | flat number | tokenCount is a flat integer total, NOT `{input, output}`. Plan 01 MUST apply char-formula to split input vs output costs |
| messages | top-level fields | N/A | `messageId, user, __v, _meiliIndex, attachments, content, conversationId, createdAt, endpoint, error, expiredAt, isCreatedByUser, model, parentMessageId, sender, text, tokenCount, unfinished, updatedAt` | All message fields |
| files | context | `context` | `image_generation` | Correct filter for DALL-E images (3 files found) |
| files | user/userId | `user` | `69cfd4edf4044c9e5e4c` (truncated) | User reference field is `user` |
| agents | id/tools | `agent_64q6z5s57552cpgl0hr` | `dalle=true` | Drawing agent PRESENT with dalle tool |
| agents | id/tools | `agent_aiv99mzvdzquym6y89k` | `dalle=true` | Drawing agent PRESENT with dalle tool |
| agents | id/tools | `agent_wxgt6su7d3pcosiil3` | `dalle=true` | Drawing agent PRESENT with dalle tool |
| agents | id/tools | `agent_y4w1cvoyg77p9thed9` | `dalle=true` | Drawing agent PRESENT with dalle tool |
| conversations | conversationId/_id | `conversationId` | `20d5b3e7-076b-498f-8` (UUID) | Use `conversationId` (UUID string) for lookups, not `_id` |
| conversations | top-level fields | N/A | `_id, user, conversationId, __v, _meiliIndex, agent_id, createdAt, endpoint` | Field inventory |

### Key Surprises

1. **`balances` not `balance`** — The LibreChat token balance collection is named `balances` (plural). The Phase 15 plan references it as `balance`. All Plan 01/02 code must use `db.collection("balances")`.

2. **`aclentries.resourceId` is a MongoDB ObjectId** — NOT the `agent_xxx` string. To look up ACL entries for a specific agent, you must first query `agents` to get the `_id`, then query `aclentries` with `{ resourceId: agent._id, resourceType: "agent" }`.

3. **`aclentries.principalId` is the user field** — NOT `user`. Plan 02 enforcement must use `principalId`.

4. **`tokenCount` is a flat integer** — Not split into `{input, output}`. The cost ledger cannot use direct tokenCount for input/output split billing. Must apply char-formula fallback: `(input_chars/4) * haiku_input_rate + (output_chars/4) * haiku_output_rate`.

5. **`balances` is empty** — LibreChat's token balance system is NOT enabled. This means we cannot use the native balance system for rate limiting. Plan 01 must implement its own cost tracking in a new `cost_ledger` collection without relying on LibreChat's balance system.

---

## Plan 02 Implications

*(Confirmed at Task 4 checkpoint — 2026-04-10)*

- **balance.enabled is NOT SET** in librechat.yaml — `balances` collection is empty. Plan 01 MUST implement its own cost tracking (`cost_ledger` collection) independently of LibreChat's native balance system. Setting `balance.enabled: true` in librechat.yaml is optional but would enable LibreChat's own token deduction — however this is separate from our EUR-based monthly cost cap.
- **aclentries use field name `principalId`** — Plan 02 enforcement code MUST use `principalId` when querying/modifying ACL entries for user access control. NOT `user`.
- **aclentries.resourceId is an ObjectId** — Must look up agent's `_id` first, then query `aclentries` by `resourceId`.
- **messages.tokenCount IS populated** but as flat integer — Plan 01 cost ledger MUST apply char-formula for input/output split. The flat `tokenCount` can be used as total tokens for rough cost estimate, but cannot give per-direction split without char counts.
- **Collection name is `balances`** (plural) — Update all Plan 01/02 references.

---

## Synthetic Message Test

**Test performed:** 2026-04-10T10:51:47.890Z
**messageId:** `69d8d4b3ecb1d4b13e993563`
**conversationId:** `d7533159-bd56-4643-a276-9c35ce2086c9` (Sebastian's "Drawing Assistance Alternatives Offered" conversation)
**userId:** `69d0315763d6125f1f553e97` (Sebastian)
**text:** `PHASE-15-SYNTHETIC-TEST-1775817907890`
**agent_id:** `agent_wxgt6su7d3pcosiil3` (Friendly Tutor)

The synthetic message has been inserted into MongoDB. The `conversations.updatedAt` has also been updated to trigger UI refresh.

**Human verification required:** Please log in to LibreChat as Sebastian and open the "Drawing Assistance Alternatives Offered" conversation. Confirm whether the message `PHASE-15-SYNTHETIC-TEST-1775817907890` appears in the chat.

**Cleanup:** After confirming the verdict, delete the message:
```js
db.messages.deleteOne({ messageId: "69d8d4b3ecb1d4b13e993563" })
```
Or run: `MONGODB_URI=... npx tsx scripts/mongo-inspect.ts --cleanup 69d8d4b3ecb1d4b13e993563`

VERDICT: GO — synthetic insertion renders in LibreChat UI

**Confirmation:** Sebastian logged in to LibreChat, opened the "Drawing Assistance Alternatives Offered" conversation, and confirmed the message `PHASE-15-SYNTHETIC-TEST-1775817907890` rendered in the child's chat UI. Admin-inserted messages are visible to the child without any additional signaling. Pattern 8 (admin-injected bonus offer delivery) is viable.

**Cleanup:** Synthetic message `69d8d4b3ecb1d4b13e993563` deleted from MongoDB on 2026-04-10.

