# Phase 19 Plan 01 — MongoDB Agent Edits

**Executed:** 2026-04-16T21:31:00Z (approx)
**Task:** Remove DALL-E tool from 4 text agent documents in MongoDB

---

## Summary

The DALL-E binding was confirmed at MongoDB agent level (not yaml level — see 19-01-AUDIT.md Appendix A). Task 3 removed `dalle` from the `tools` array of the 4 text agents using `$pull`.

MongoDB command used:
```javascript
db.agents.updateMany(
  {id: {$in: ['agent_wxgt6su7d3pcosiil3', 'agent_y4w1cvoyg77p9thed9', 'agent_64q6z5s57552cpgl0hr', 'agent_aiv99mzvdzquym6y89k']}},
  {$pull: {tools: 'dalle'}}
)
// Result: Matched: 4, Modified: 4
```

---

## Before/After Snapshots

### KidsChat Friendly Tutor (agent_wxgt6su7d3pcosiil3)
Before: `tools: ["dalle"]`
After: `tools: []`

### KidsChat Casual Buddy (agent_y4w1cvoyg77p9thed9)
Before: `tools: ["dalle"]`
After: `tools: []`

### KidsChat Balanced Helper (agent_64q6z5s57552cpgl0hr)
Before: `tools: ["dalle"]`
After: `tools: []`

### KidsChat Standard Formal (agent_aiv99mzvdzquym6y89k)
Before: `tools: ["dalle"]`
After: `tools: []`

---

## Drawing Studio Agent — UNTOUCHED

### KidsChat Drawing Studio (agent_kidschat_drawing_1775634945891)
- **tools:** `["dalle"]` (preserved — this is the designated drawing agent)
- **MongoDB _id:** `ObjectId('69e154d5dbb800a024236665')`
- **Status:** CREATED in Task 2 (was missing from MongoDB; see 19-01-AUDIT.md)

---

## Live Verification

Note: The LibreChat service was redeployed at 2026-04-16T21:31:39Z (concurrent with agent edits). The most recent transactions in the collection are from 18:35:20 UTC (before these changes):

| Transaction | tokenType | rawAmount | createdAt |
|------------|-----------|-----------|-----------|
| `69e12be8...` | prompt | -8,830 | 2026-04-16T18:35:20Z (DALL-E round 2, WITH tool schema) |
| `69e12be8...` | prompt | -4,928 | 2026-04-16T18:35:20Z (DALL-E round 1, WITH tool schema) |
| `69e12bab...` | prompt | -268 | 2026-04-16T18:34:21Z (title generation) |

**Expected impact after changes:**
- First turn of a text conversation: ~1,900–2,200 prompt credits (was ~4,494)
  - Breakdown: ~710 (agent instructions) + ~140 (user message) + overhead = ~1,900–2,200
  - Savings: ~2,580 credits per turn (DALL-E tool schema removed)
- Live verification of `rawAmount < 2000` requires the parent to send a test text message via Friendly Tutor preset (covered in Task 4 UAT)

**Drawing Studio:** Live DALL-E generation will be verified in Task 4 UAT (parent sends a "Draw a bunny" request via Drawing Studio preset).
