---
phase: 20
milestone: v2.9
status: LOCKED
locked: 2026-04-20
unblocks: [21, 22]
---

# Phase 20 — Architectural Decisions (authoritative)

Outputs from a POC that went live end-to-end with a parent-reviewed UAT. These decisions are the contract Phase 21 (production rollout) and Phase 22 (Test Mode parity) build on. Do not revisit without explicit parent sign-off.

## D-1 · Provider: Openverse (sole)

**Decision:** Openverse public API (anonymous tier) is the only image-search provider for v2.9.

**Why:** Google CSE pivoted away during research (Amendment B — deprecated whole-web + project-level 403s). Openverse is CC-licensed by design, has a clean REST API, requires no credentials, and returns educational/creative content that matches kid use cases (crafts, animals, art reference). The anon tier (`page_size ≤ 20`, `200/day sustained`, `20/min burst`) is sufficient for the expected household volume — two kids, ~20 searches/day each.

**Constraint:** Must stay within the anon-tier budget. Phase 21 should register for an Openverse OAuth client only if actual usage hits the ceiling; do not pre-optimise.

## D-2 · Tool mechanism: custom MCP server (streamable-http)

**Decision:** Custom Node/TypeScript MCP server at `services/image-search-mcp/` (`kidschat-image-search-mcp` on Railway), attached to LibreChat via `mcpServers.image-search` in the YAML config. Exposes a single `image_search` tool. Internal URL is the public Railway HTTPS URL (internal `*.railway.internal` hostname is blocked by LibreChat's domain allowlist).

**Why:** Plain REST would have required a LibreChat plugin (bigger maintenance footprint) or embedding the fetch logic in the agent prompt (can't enforce click-through policy or rate limits server-side). MCP gives a clean tool-call boundary where we own schema, validation, and defense-in-depth.

**Constraint:** Tool schema is the source of truth. When the agent prompt and tool schema disagree (as they did in Wave 2), LibreChat trusts the schema and the agent's claim of arg names is silently overridden. The pre-wave artifact `20-02-GIST-REFS.md` is canonical; the prompt must conform.

## D-3 · Click-through policy: option iii (tool-boundary strip)

**Decision:** The MCP server's `openverse.ts` provider **never returns** the `foreign_landing_url` or `url` fields from the upstream response — only `thumbnail` (flat string), `title`, `source_domain`, `provider`, `license`. The agent cannot link kids out to third-party sites because the tool never hands over the URL. The agent prompt ALSO explicitly forbids `[![](…)](…)` link-wrapping.

**Why:** Safari whitelist on kids' devices. Clicking a thumbnail must not open a browser tab to `api.openverse.org` or any Flickr/DeviantArt source. Tool-boundary enforcement is stricter than prompt-only enforcement — even a jailbroken model can't emit what the tool doesn't give it.

**Constraint:** Preview is long-press → iOS native save-image menu, OR LibreChat's built-in image lightbox (confirmed working for plain markdown `![](…)`). No cross-site navigation.

## D-4 · Preset surface: `modelSpecs.list` entry with agent_id

**Decision:** Image Search appears in LibreChat's preset selector via a `modelSpecs.list[]` entry that references a MongoDB `agents` document by `agent_id`. The YAML entry lives in the production `librechat.yaml` Gist (not a separate dev Gist) once Phase 21 is ready to ship. Until then, the **dev Gist** (`b0c89395bbefb4f7ff9124d0d9014999`) hosts the staging preset with `claude-test@kidschat.local` + admin ACLs only.

**Why:** LibreChat's `/api/agents` listing endpoint returned "Illegal request" under our auth, making runtime agent discovery fragile. The `modelSpecs` route is documented, stable, and survives LibreChat restarts.

**Constraint:** `agents` docs must be seeded with their ACL entries in the same logical step — an agent with zero ACL rows is invisible to every user in LibreChat v0.8.x.

## D-5 · Pagination: `page` param on MCP (1-indexed)

**Decision:** `image_search` tool accepts a `page: number (1-20, default 1)` parameter that maps to Openverse's `&page=N`. The agent prompt detects continuation phrases ("more", "more please", "next", "show me others", "different ones", etc.) and increments `page` by 1; any new topic resets to `page = 1`.

**Why:** First POC revealed that kids saying "some more pls" got the same 20 thumbnails because the tool call was query-identical. Without pagination, the Image Search preset is useless for exploration beyond 20 results.

**Constraint:** Agent must look back in conversation history to find its most recent tool call and its page value. Fallback is `page = 1` if the previous call can't be confidently identified.

## D-6 · Output layout: 3-column markdown table, note-first, no link-wrap

**Decision:** Agent emits a single-line helper note (`*Long-press an image to view it larger or save it.*`) followed by a 3-column markdown table of plain `![](thumbnail)` images (up to 20 cells in 7 rows). No captions, no commentary, no link-wraps.

**Why:** Kids' primary use is on mobile (parent-controlled iOS Safari). A 3-col table collapses thumbnails to ~33% viewport width — tiny, scrollable, grid-like. Note-first gives useful context to fill the streaming window before URL text flashes. Plain markdown images trigger LibreChat's native lightbox without navigation.

**Constraint:** The agent prompt must be categorical about no link-wrap — an earlier iteration produced `[![](url)](url)` which routed kids' taps to Openverse URLs (Safari whitelist violation). Tool-boundary strip (D-3) is the backstop but prompt discipline is the first line.

## D-7 · Content safety: single rule set, stricter wins

**Decision:** Whatever content is inappropriate for Sebastian is blocked for Penelope too. No per-child differentiation. This drops the Q13-breastfeeding caveat from Phase 21 scope and simplifies the blocklist.

**Why:** Parent directive post-UAT: operational simplicity and conservative default for both kids. Breastfeeding, pregnancy, anatomy queries that might be age-appropriate for the older child are blanket-blocked because mixed-rule sets are hard to reason about and easy to misconfigure.

**Constraint:** Phase 21 MCP blocklist must enforce: explicit sexual terms, anatomy (genitals/private/naked), self-harm slang, drug-use glorification (educational biology/PSA content still allowed per Q18/Q19 acceptance), real named public figures (photo/realistic framing).

## D-8 · Defense-in-depth: Openverse filter + MCP blocklist + post-hoc alert

**Decision:** Three layers before any thumbnail reaches a kid.

1. **Openverse `mature=false`** (pre-search, server-side). Verified effective for Q16/Q17/Q20 (violence, explicit sex, exploitation — all returned 0).
2. **MCP tool-boundary blocklist** (Phase 21 — not yet built). A static regex/wordlist check on the `query` argument inside `server.ts` BEFORE calling Openverse. If a banned term is present, the tool returns `{ images: [], error: "blocked_query" }` and the agent emits its graceful-empty fallback. Parent alert fires.
3. **`src/lib/safety-patterns.ts` alert** (post-hoc). Extend `IMAGE_PROMPT_PATTERNS` detection to scan messages sent to the image-search preset, not just drawing-studio prompts. Parent email fires regardless of what Openverse actually returned.

**Why:** UAT found Openverse's filter was sufficient for 3 of 5 adversarial categories but leaked non-objectionable content for self-harm and drug-use queries. Relying on Openverse alone is a single point of failure. Blocklist adds a server-side gate we control; post-hoc alerts catch anything that slips both.

**Constraint:** Blocklist terms must be hand-curated from the parent's safety judgment, not scraped from a third-party list. Start minimal; expand as real-world misuse is observed.

## D-9 · Rollout gate: kids ACL-revoked until Phase 21 ships

**Decision:** Sebastian and Penelope's `aclentries` rows on the image-search agent have been **deleted** (2026-04-20). They do not see the Image Search preset. Admin accounts (Manuel, Emily-Kate, `claude-test@`) retain ACL for continued testing.

**Why:** Phase 20 is research + POC. Kids-facing rollout requires D-8 Layer 2 (MCP blocklist) and the Phase 22 Test Mode admin interface to fail-safe on bad behaviour. Leaving the preset visible to kids during that build would be a regression risk Penelope-in-particular (active daily user) can't absorb.

**Constraint:** Phase 21 final task is to re-grant kids' ACLs AFTER the blocklist ships and the parent has signed off on a production UAT run.

## D-10 · No `CONFIG_PATH` revert; dev Gist stays live

**Decision:** Railway LibreChat's `CONFIG_PATH` remains pointed at the dev Gist (`3206129683ee…`). Production Gist is untouched at `6bf08d0e…` and can be swapped back in one `railway variables --set` if ever needed.

**Why:** ACL revocation (D-9) already achieves the "kids don't see Image Search" outcome. Reverting `CONFIG_PATH` would require another redeploy cycle now and a third one when Phase 21 ships. Keeping the dev Gist active lets us iterate on blocklist, rate-limit handling, and UX without config churn.

**Constraint:** Phase 21 must end with a `CONFIG_PATH` swap to production Gist (or merge the dev-Gist additions into the production Gist and drop the dev Gist entirely — same outcome).

---

## Phase 21 scope lock (derived from the above)

1. **MCP blocklist** (D-8 Layer 2) — hand-curated regex list in `services/image-search-mcp/src/providers/openverse.ts` or a sibling `blocklist.ts`. Returns `error: "blocked_query"`.
2. **Alert extension** (D-8 Layer 3) — make `IMAGE_PROMPT_PATTERNS` scan image-search conversations too.
3. **Zero-result quirk mitigation** (C-2) — either OAuth registration for higher quotas or query-modifier trimming retry.
4. **Merge dev Gist → production Gist** (D-4 + D-10).
5. **Re-grant kids' ACLs** (D-9) — final rollout step after parent UAT sign-off.
6. **Kill test account** or keep `claude-test@` for future CI? Phase 21 decides.

## Phase 22 scope lock

7. **Test Mode admin parity** — admin dashboard's Test Mode page gains an Image Search preset option with the same tool wiring, so admins can dry-run queries against the live blocklist without touching LibreChat.
8. **Daily-summary email enrichment** — include Image Search query counts + blocklist-hit counts per kid.

---

## Artifacts that survive Phase 20

- **MCP service**: `services/image-search-mcp/` → Railway `kidschat-image-search-mcp` (live, keep running)
- **Dev Gist**: `b0c89395bbefb4f7ff9124d0d9014999` (Phase 21 source of truth until merged)
- **Agent document**: MongoDB `agents` collection, `id=agent_kidschat_imagesearch_1776667852767`, `_id=69e5cd12f538d268466e71fd`
- **ACLs**: 4 rows (2× Manuel agent+remoteAgent, 1× Emily-Kate, 1× claude-test)
- **Test user**: `claude-test@kidschat.local` + `balances.tokenCredits=10_000_000` (for `scripts/chat-test.ts`)
- **Headless CLI**: `scripts/chat-test.ts` — reusable for every future preset / agent / Openverse change
