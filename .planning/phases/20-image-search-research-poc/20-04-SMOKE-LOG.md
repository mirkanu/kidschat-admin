
---

## Post-smoke: ACL fix (2026-04-20)

**Symptom:** Image Search preset not visible to any user (admin tested: only 5 presets showed).

**Root cause:** New agent had zero ACL entries. LibreChat hides agents without ACL. Drawing Studio had 5 entries (owner + 4 users).

**Fix:** Mirrored 5 ACL rows from drawing agent (resourceId=69e154d5dbb800a024236665) to image-search agent (resourceId=69e5cd12f538d268466e71fd). Same principals, same permBits, same roleIds. 5 rows inserted.

**Takeaway for Phase 21 / future agents:** Seeding an agent document is insufficient — must also seed `aclentries`. Plan 20-03 omitted this step.

## Post-smoke: temperature fix (2026-04-20)

**Symptom:** "temperature is not supported when thinking is enabled" on first query.

**Root cause:** Plan 20-03 seeded `model_parameters.temperature: 0` on the image-search agent. Claude Haiku 4.5 has extended thinking enabled via LibreChat config, and thinking mode rejects temperature.

**Fix:** `$unset model_parameters.temperature`. Left `maxOutputTokens: 1000` intact. Drawing Studio has no model_parameters at all — reference pattern.

## Post-smoke: model_parameters fix #2 (2026-04-20)

**Symptom:** "thinking.enabled.budget_tokens: Input should be greater than or equal to 1024"

**Root cause:** Plan 20-03 set `maxOutputTokens: 1000`. With thinking enabled, the thinking budget must be ≥1024 and ≤ maxOutputTokens, so 1000 is impossible.

**Fix:** `$unset model_parameters` entirely. Drawing Studio has no model_parameters — that's the working reference. Future agent seed scripts: omit model_parameters unless you have a deliberate, thinking-compatible value.

## Post-smoke: agent instructions vs. MCP contract mismatch (2026-04-20)

**Symptom:** Images rendered as broken placeholders (struck-through camera icon).

**Root cause:** Plan 20-03's agent system prompt didn't match Plan 20-01's actual MCP tool schema:

| What prompt said | What tool contract is |
|-------------------|----------------------|
| param `q` | param `query` |
| pass `safesearch: "strict"` | no safesearch param accepted |
| extract `thumbnail.src` | `thumbnail` is a flat string URL |

Claude inferred `query` from the tool schema (tool call succeeded), but obeyed the prompt on `.src` → emitted `![](undefined)` → placeholders.

**Fix:** Rewrote agent `instructions` to match MCP contract. Key corrections: use `query`, remove safesearch (provider-level filter), emit `thumbnail` directly.

**Process lesson:** When Plan A (MCP server) and Plan B (agent prompt) define two sides of a contract and run in parallel waves, the planner must specify the contract in a shared artifact (e.g. 20-01-TOOL-CONTRACT.md) so both plans reference the same source of truth. Record for Phase 21 / future phases.
