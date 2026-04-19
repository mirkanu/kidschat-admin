# Phase 20: Image Search — Research + POC — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 20 resolves the technical unknowns blocking v2.9 Image Search + Test Mode Preset Parity and produces a working kid-facing POC. Its deliverable is (a) four locked architectural decisions, (b) a kid-facing "Image Search" preset running against a real search API in a dev Gist environment that the parent can use as reviewer, and (c) a documented Test Mode architecture plan (not built — Phase 22 builds).

**Phase 20 does NOT ship production-visible features to kids.** The preset is hidden behind a dev Gist pointer swap; Penelope and Sebastian see nothing change in production during Phase 20.

</domain>

<decisions>
## Implementation Decisions

### POC Scope
- **D-01:** Phase 20 produces a **kid-facing POC only** — working "Image Search" preset end-to-end against a real API key, rendering inline image grid, with SafeSearch strict and no click-through. Test Mode architecture is **documented** (locked decisions + code sketch) but **not built** during Phase 20. Phase 22 handles the Test Mode build.
- **D-02:** Phase 20's deliverable is code + documented decisions sufficient that Phase 21 (kid production rollout) and Phase 22 (Test Mode parity) can plan without additional research.

### Provider Candidate Shortlist
- **D-03 (AMENDED 2026-04-18 — see Amendment A below):** Two candidate providers get actively stood up and queried during Phase 20, both genuinely free at family usage:
  - **Google Custom Search JSON API** (primary) — 100 queries/day free tier (per GCP project), strict SafeSearch param, image search via `searchType=image`, Google-wide corpus
  - **Openverse API** (fallback/complement) — unlimited free, no auth required, pre-filtered Creative Commons content from Flickr/Wikimedia/museums/etc., good for craft/educational queries
- Brave Search API, LibreChat built-in `web_search`, Serper, Bing, Kagi, Pexels/Unsplash all **culled on desk review** — see Amendment A.
- **D-04:** Decision criterion for picking the final provider: SafeSearch quality on the agreed test set (D-11), cost/free-tier fit, image endpoint ergonomics (thumbnail URL presence, title, source domain), hotlink-blocking rate on sample results. Combined-provider strategy expected: Google CSE for breadth, Openverse as fallback for queries where Google is over-strict or returns poor craft/educational results.

### Amendment A — Provider Pivot from Brave to Google CSE + Openverse (2026-04-18)

**Trigger:** Parent reviewed initial research finding that Brave's "base plan with $5 credit" model is not a true free tier, and requested testing genuinely free options first.

**Original D-03 (superseded):** Brave Search API + LibreChat built-in `web_search`.

**Why Brave is culled in this pass:** $5/month base plan is not "free-forever" (research agent's phrasing was accurate but the parent's tolerance for paid-from-day-one is lower than assumed). Brave remains a fallback option if Google CSE + Openverse fail UAT — in which case D-03 can be re-amended.

**Architectural consequence:** Neither Google CSE nor Openverse has an official MCP server. Tool mechanism changes from "Brave official MCP server" to a **custom `kidschat-image-search-mcp` Node server** (~100 LOC) living in the KidAI repo at `services/image-search-mcp/`, wrapping both providers with primary-fallback logic. Deployed as a new Railway service pointing at the subdirectory. MCP wire protocol with LibreChat still applies — we just author the server ourselves instead of using Brave's.

**This amendment supersedes D-03 and shifts tool-mechanism work into Plan 20-01. Other locked decisions (D-01, D-02, D-04 through D-14) remain unchanged.**

### Amendment B — Provider Collapse to Openverse-only (2026-04-19)

**Trigger:** During Plan 20-01 execution, two blockers surfaced while provisioning Google Custom Search:
1. **Google deprecated the "Search the entire web" toggle on new Programmable Search Engines.** New CSEs can only be restricted to listed sites (≤50 distinct domains, no `*.com` patterns). A curated-domain alternative was drafted but then obviated by blocker 2.
2. **Google Cloud project "GSD projects" returned persistent `403 PERMISSION_DENIED "This project does not have the access to Custom Search JSON API"`** despite the Custom Search API showing as enabled and API-key restrictions being correct, across two freshly generated keys. Likely a project-level billing/org-policy quirk that would require debugging opaque GCP state.

**Decision (parent, 2026-04-19):** Drop Google Custom Search entirely. Openverse becomes the **sole** provider. Rationale: (a) architectural simplification — no credentials, no `user_setup` checkpoint, no dashboard dance, no GOOGLE_CSE_KEY/GOOGLE_CSE_CX env vars on Railway; (b) stronger kid-safety posture — Openverse's pre-curated CC-licensed catalog (Wikimedia, Flickr Commons, museums, government archives) is arguably safer than SafeSearch-filtered open web; (c) Openverse is already stood up, tested from the shell, and working. Plan 20-01 was rewritten in-flight to reflect this scope.

**Architectural consequence:**
- `services/image-search-mcp/src/providers/google-cse.ts` — not created (was planned in original 20-01, dropped before author).
- `services/image-search-mcp/src/providers/openverse.ts` — the only provider module.
- Fallback logic in `server.ts` — removed (there's nothing to fall back to); single-provider surface-the-error-up pattern instead.
- Kid-safety posture note: the Google-SafeSearch story is gone, but Openverse's catalog is pre-filtered at source — no open-web content is possible.

**Trade-off accepted:** Openverse lacks copyrighted contemporary characters (Pokémon, Minecraft, Elsa, Spider-Man, etc.). Strong on animals, nature, history, art, science, geography, vehicles, world cultures, musical instruments. If Plan 20-05 UAT reveals breadth gaps on your kids' actual interests, Plan 20-06 can record a future-work note to add **Pexels** as a no-auth fallback (also CC-style, also free, no dashboard signup). **Do NOT reintroduce Google CSE.**

**Supersedes:** D-03 (now Openverse-only instead of Google+Openverse) and D-04 (no more "pick the final provider" — there is only one). D-13b's "Google CSE primary + Openverse fallback" reduces to "Openverse only." Other locked decisions (D-01, D-02, D-05 through D-14) remain unchanged in spirit (test-set, done-criteria, Test Mode architecture, hotlink policy are provider-agnostic).

### Phase 20 Done Criteria
- **D-05:** Phase 20 is complete when **the parent reviewer (you) can use the Image Search preset in LibreChat against the dev Gist configuration and confirm results look safe and render properly** for the agreed test query set (D-11).
- **D-06:** Penelope and Sebastian do **not** UAT the preset during Phase 20 — kid UAT belongs in Phase 21 after production rollout. Rationale: avoid beta noise and ensure the parent has vetted SafeSearch quality before kids see anything.
- **D-07:** No automated test suite is a Phase 20 requirement. If the test set (D-11) is scripted as a quick sanity check, that's a bonus, not a gate.

### POC Configuration Environment
- **D-08:** A **new dev Gist** is created for the staging `librechat.yaml` that includes the Image Search preset. Production Gist stays untouched during Phase 20.
- **D-09:** Testing flow: swap Railway LibreChat's `CONFIG_PATH` env var to point at the dev Gist → redeploy → parent runs test queries → confirm → swap back to production Gist. This matches the established v2.5/v2.6 Gist-versioning and commit-pinned CONFIG_PATH pattern.
- **D-10:** The Image Search preset and its MongoDB agent document live **only in a dev context** during Phase 20. Phase 21 adds the preset to the production Gist and MongoDB.

### Safety Test Query Set
- **D-11:** Claude (in Phase 20 research) drafts a ~20-query safety test set based on kids-search safety literature; parent reviews and edits before use. Composition target:
  - ~10 normal craft / creative / educational queries Penelope is likely to run (origami, "cat drawings", "cake decorating ideas", "watercolor trees", etc.)
  - ~5 common-edge queries where over-strict filters misfire (swimsuits for summer crafts, pregnant-character drawings for story books, animal-childbirth nature videos, etc.)
  - ~5 adversarial queries that MUST be blocked (explicit content, violence, self-harm imagery, etc.) — used to verify the safety net, not to bypass it
- **D-12:** Parent reviews the draft list before any adversarial query is run. Adversarial queries are run by the parent only, never surfaced to kids.

### Test Mode Architecture (for Phase 22 — decide during Phase 20 research, don't build)
- **D-13:** Phase 20 research must produce a locked decision between two Test Mode architectures:
  - **Option A:** Proxy Test Mode through LibreChat's agents API (zero tool re-implementation; true parity; requires auth + streaming wiring)
  - **Option B:** Re-implement tools server-side in the admin dashboard using Anthropic SDK tool_use (isolation; duplication; easier streaming since Anthropic SDK already used)
- **D-14:** Selection criterion: prefer Option A (proxy) unless research surfaces a blocking issue (auth complexity, stream-format translation, LibreChat API instability). Rationale: true parity + zero-drift as LibreChat evolves.

### Claude's Discretion
- Tool mechanism choice (LibreChat native `web_search` vs MCP server vs custom OpenAPI tool) — research evaluates and recommends; parent signs off during Phase 20 review.
- Hotlink mitigation strategy (proxy-all / proxy-on-failure / accept broken images) — research recommends based on observed hotlink-block rate in provider samples.
- Exact system prompt for the Image Search agent — Claude drafts, parent reviews during Phase 20 testing.
- Whether to return 8 vs 10 vs 12 thumbnails per query — Claude picks a reasonable default; parent can tune during review.
- Markdown grid layout mechanics (single line of `![](url)` vs HTML grid) — whichever renders cleanly in LibreChat's message bubble.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — project context, core value, v2.9 milestone section, validated requirements, decisions table
- `.planning/REQUIREMENTS.md` — v2.9 requirements list with traceability (SEARCH, SAFETY, OVERSIGHT, TESTMODE)
- `.planning/ROADMAP.md` — v2.9 milestone section (Phase 20/21/22 scopes and goals)
- `.planning/STATE.md` — accumulated decisions from prior phases

### Prior-phase decisions that shape Phase 20
- `.planning/milestones/v2.4-phases/14-enable-safeguard-image-generation/` — Drawing Studio precedent: MongoDB agent + `tools` array + preset pattern; `interface.agents: {use:true, create:false, share:false, public:false}` convention
- `.planning/milestones/v2.4-phases/15.3-simplification-remove-bonus-flow/` — LibreChat native "Insufficient Funds" behavior reference; simplification-over-custom-flow principle
- `.planning/phases/19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que/19-01-GIST-AFTER.yaml` — current live `librechat.yaml` including `endpoints.agents.maxContextTokens:8000`, current 5 presets, Drawing Studio tool config — the starting point for the dev Gist
- `.planning/milestones/v2.5-phases/16-librechat-interface-hardening/` — MCP disabled for kid-facing add UI (but MCP servers declared in `librechat.yaml` still work — relevant if MCP becomes the tool mechanism)
- `.planning/milestones/v2.6-phases/17-conversation-delete-protection-icon-fix/` — MongoDB restricted user for kid accounts (important: the image-search tool's MongoDB writes happen via LibreChat's own connection, NOT the restricted user — verify this during Phase 20)
- `.planning/milestones/v2.1-phases/09-parent-test-mode/` — existing Test Mode implementation (Anthropic SDK direct) — starting point for Test Mode architecture analysis
- `src/app/(dashboard)/test-mode/test-mode-client.tsx` — current Test Mode client code (to reason about in the Test Mode architecture decision)

### External references (research phase will expand)
- LibreChat v0.8.4 docs (librechat.ai) — verify `web_search` plugin support, image result handling, agent tool declaration syntax
- Brave Search API docs (brave.com/search/api) — image endpoint, SafeSearch param, pricing
- Kids-search safety literature — source for the safety test query set draft (D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **LibreChat preset pattern** (`modelSpecs.list[]` in `librechat.yaml`): Image Search preset mirrors existing preset shape — `name`, `label`, `description`, `iconURL` (Iconify API), `preset.endpoint: "agents"`, `preset.agent_id`, `greeting`
- **MongoDB `agents` collection**: Image Search agent document follows Drawing Studio shape (`agent_kidschat_drawing_*`) — includes `tools:[...]` array where the image-search tool is attached
- **Gist-versioned config + `CONFIG_PATH` Railway env var** (Phase 12/15/17 pattern): dev Gist for staging; commit-pinned URL prevents CDN staleness
- **`detectSafetyEvent` + email pipeline** (`src/lib/notify-safety-alert.ts`): reuse as-is for SAFETY-02 — no new notification code path needed, raw query text runs through existing pattern library
- **Admin dashboard conversation log** (`src/app/(dashboard)/conversations/`): shows `preset_id` / agent already — minimal work for OVERSIGHT-02 (preset badge)
- **Daily-summary email** (`src/app/api/notify/daily-summary/route.ts` — 260417-p94): Haiku-paraphrased per-kid summary; extend format to include image-search count + sample queries for OVERSIGHT-03

### Established Patterns
- **Tool schemas cost tokens per turn** (v2.8 lesson) — Image Search tool MUST live only on the Image Search preset, not globally; never attach to text presets
- **LibreChat native behavior preferred over custom flows** (v2.4/15.3 teardown lesson) — if LibreChat's built-in `web_search` supports images, use it; avoid reinventing
- **Commit-pinned Gist CONFIG_PATH** — any Gist edit requires Railway env var update to new commit hash (Phase 16 pitfall)
- **`interface.agents` object form** (not boolean) — `{use:true, create:false, share:false, public:false}` already in place
- **MongoDB restricted user for kid accounts** (Phase 17) — if the image-search tool reads/writes MongoDB directly, do it via LibreChat's own connection, not a kid-user connection

### Integration Points
- `librechat.yaml` (Gist-hosted) — Image Search preset declaration, possibly MCP server declaration, possibly `web_search` plugin config
- MongoDB `agents` collection — new agent document for Image Search with system prompt + tools array
- Railway LibreChat service — `CONFIG_PATH` env var swap for dev vs prod Gist; redeploy per Gist edit
- `src/lib/settings.ts` — add `dailySearchCountCap` to `HARDCODED_DEFAULTS` (Phase 21); Phase 20 just notes the field shape
- If hotlink proxy is needed: new Next.js API route `src/app/api/image-proxy/route.ts` (Phase 21; Phase 20 just designs)
- If MongoDB domain blocklist is used (Phase 21): new `settings` field `imageSearchBlocklist`

</code_context>

<specifics>
## Specific Ideas

- **Penelope's actual use case anchors Phase 20 review:** craft image search (origami, cake decorating, watercolor references). The test set (D-11) must include her realistic patterns, not just abstract safety tests.
- **"No AI manipulation of images"** is a first-class design constraint — the agent is a router, not a reasoner. System prompt must explicitly forbid commentary/description/curation.
- **Option iii click-through policy** is non-negotiable. Rendering mechanism must produce `<img>` elements, not `<a><img></a>`. Verify in Phase 20 that LibreChat's markdown renderer doesn't auto-linkify image URLs.
- **Dev Gist swap is the isolation mechanism**, not feature flags in code. Follow the v2.5/v2.6 pattern — clean rollback via Railway env var.

</specifics>

<deferred>
## Deferred Ideas

- **Text/web search preset** (homework facts) — Out of scope for v2.9; natural v3.0 candidate if Image Search lands well.
- **Parent-approval queue for searches flagged by safety patterns** — v2.9 currently alerts-only; queue/gate is a future milestone if alerts reveal it's needed.
- **Curated domain allowlist mode** (instead of blocklist) — fallback if blocklist proves insufficient in Phase 21 UAT; not designed in Phase 20.
- **Save/download-to-parent-shared-folder workflow** — product idea; out of Phase 20/21/22 scope.
- **Automated safety test suite** — considered as Phase 20 done-criterion and rejected (D-07); could be picked up later if SafeSearch quality regresses.
- **Penelope UAT during Phase 20** — explicitly deferred to Phase 21 (D-06) to keep parent review clean.

</deferred>

---

*Phase: 20-image-search-research-poc*
*Context gathered: 2026-04-18*
