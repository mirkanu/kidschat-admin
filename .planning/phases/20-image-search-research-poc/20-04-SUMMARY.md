---
phase: 20
plan: 04
status: complete
completed: 2026-04-20
commits:
  - f972082  # CONFIG_PATH swap + redeploy + MCP handshake verified
  - 3df9254  # agent_id reconciliation from Wave 2 parallel-plan conflict
  - f43ebb0  # Openverse 20-cap clamp (blocker discovered via chat-test CLI)
  - 950901c  # Task 3 closed via headless CLI self-verification
---

# Plan 20-04 — Swap CONFIG_PATH, Smoke Test, OQ1 Resolution — SUMMARY

**Outcome:** OQ1 (LibreChat ↔ image-search MCP streamable-http wire-compat) **PASS** — end-to-end flow verified live.

## Must-haves — final status

| # | Truth | Verdict |
|---|-------|---------|
| 1 | `CONFIG_PATH` on librechat service points at the dev Gist commit-pinned URL | ✓ |
| 2 | LibreChat redeployed cleanly against dev Gist; `/health` = 200 | ✓ |
| 3 | LibreChat startup logs show custom image-search MCP initialized (513ms, then 367ms on subsequent boot) | ✓ |
| 4 | Browser smoke test shows Image Search preset in selector; a search query invokes the tool | ✓ (verified via both browser + headless CLI) |
| 5 | OQ1 resolved — PASS | ✓ |

## What it took to get to green (auto-fix chain)

See `20-04-SMOKE-LOG.md` for the blow-by-blow. Short version:

1. **ACL seeding** — new agent had 0 ACL entries; LibreChat hides such agents. Mirrored 5 rows from Drawing Studio.
2. **Dev Gist YAML fix** — initial dev Gist was missing the `#` on line 1 → parse error; patched.
3. **Internal hostname swap** — LibreChat's domain allowlist blocks `*.railway.internal`; switched to public HTTPS URL for the MCP.
4. **Agent model_parameters unset** — `temperature` incompatible with Haiku 4.5 thinking; `maxOutputTokens:1000` left thinking no budget room (<1024). Unset entirely — Drawing Studio has no model_parameters and works.
5. **MCP tool namespacing** — LibreChat prefixes MCP tools as `{tool}_mcp_{server}`. Agent's `tools` array updated from `"image_search"` to `"image_search_mcp_image-search"`.
6. **Agent prompt rewrite** — Plan 20-03 prompt assumed the tool schema Plan 20-02 had NOT produced (used `q` instead of `query`, required `safesearch`, read `thumbnail.src` instead of the flat `thumbnail` string). Rewrote prompt to match the real MCP contract and emit clickable `[![](thumb)](thumb)` tiles.
7. **Openverse 20-cap** — the last masked blocker. Agent asked for `count=30`; Openverse anon tier returns HTTP 401 for `page_size>20`; MCP reclassified as `upstream_error`; agent output fallback string. Clamped to 20 in both MCP (schema + provider) and prompt; redeployed; live output now returns 20 clickable thumbnails.

**Finding 7 was invisible in the browser** (just "placeholder images with a camera icon" or the fallback text). The `scripts/chat-test.ts` headless CLI (quick task `260420-g6h`) surfaced it on the first run by printing the raw `[TOOL]` args + result line. That tool is now a Phase 21/22 asset.

## Wave 2 reconciliation note (parallel-plan defect)

Plans 20-02 and 20-03 executed in parallel in Wave 2. Both generated `IMAGE_SEARCH_AGENT_ID` independently — the dev Gist referenced a timestamp that didn't match the MongoDB doc seeded by 20-03. Post-wave reconciliation patched the dev Gist to the authoritative MongoDB id (commit `3df9254`).

**Process lesson for Phase 21:** When two plans in the same wave define two sides of a contract (agent_id here; MCP tool schema is another latent example), the contract MUST live in a shared pre-wave artifact (e.g. `TOOL-CONTRACT.md`) so both plans reference one source of truth.

## Artifacts produced

- `.planning/phases/20-image-search-research-poc/20-04-SMOKE-LOG.md` — detailed auto-fix chronology
- `scripts/chat-test.ts` (via quick-260420-g6h) — self-service headless test for any preset

## Risks carried forward to Plan 20-05 (parent UAT)

- **Max results = 20** (Openverse anon tier cap). Phase 21 can lift via Openverse OAuth registration — currently no blocker since 20 thumbnails fill the viewport comfortably.
- **One broken thumbnail in ~20** observed in an early browser run (single Openverse result with a dead thumbnail). Expect ~5% placeholder rate. The MCP already filters empty `thumbnail` strings; this is a live-URL reachability issue, not a filtering issue. Decide in Plan 20-06 whether to add a HEAD-check pre-emit (would roughly double tool latency).

## Next

Plan 20-05 — Parent UAT against the 20-query safety set.
