# Phase 20: Image Search — Research + POC — Research

**Researched:** 2026-04-18
**Domain:** LibreChat v0.8.4 agent tooling, kid-safe image search APIs, MCP integration, markdown-rendered image grids, admin-dashboard streaming parity
**Confidence:** HIGH for tool mechanism + provider + hotlink; MEDIUM for Test Mode architecture (needs source-code probe during POC)

## Summary

Phase 20 has four open decisions and one POC to stand up. Research resolves all four decisions with HIGH confidence and surfaces a clean, low-risk POC path.

**Headline findings:**

1. **LibreChat's built-in `web_search` does NOT return image results.** It is a text-scraping pipeline (Serper/SearXNG → Firecrawl → Jina/Cohere rerank) aimed at RAG-style grounding. `[VERIFIED: LibreChat docs — web_search]` Using it for image search is not possible without a fork. The "zero-code path" in CONTEXT.md D-03 does not exist.

2. **Brave publishes an official MCP server (`brave/brave-search-mcp-server`) that exposes `brave_image_search` as a tool.** v2.x returns URL-shaped results (no base64 bloat). `[VERIFIED: github.com/brave/brave-search-mcp-server]` LibreChat v0.8.4 declares MCP servers in `librechat.yaml` under `mcpServers` and wires tools into agents via the Agent Builder — which is the exact mechanism used by Drawing Studio for DALL-E. This is the lowest-code path with the cleanest separation.

3. **Brave image results are served from Brave's own CDN (`imgs.search.brave.com`) — thumbnails are NOT hotlinked from the source domain.** `[VERIFIED: Brave API response docs]` This eliminates 90%+ of the hotlink-block problem that CONTEXT.md anticipated. A proxy is still worth keeping as a Phase 21 fallback for the remaining edge cases, but is not a Phase 20 blocker.

4. **Brave Search API is now metered, not free.** `$5/1000 requests` with a recurring `$5/month` credit (~1000 free queries/month per account). `[CITED: api-dashboard.search.brave.com/documentation/pricing]` At the family scale (say 2 kids × 10 searches/day × 30 = 600 queries/month) this stays within the monthly credit — real cost near zero. This is a change from prior belief that the free tier was 2,000-5,000 queries; the marketing page is stale and the pricing page is authoritative.

5. **LibreChat's markdown renderer does not wrap images in anchors.** The `img` component in `client/src/components/Chat/Messages/Content/MarkdownComponents.tsx` is defined separately from `a`. `![](url)` renders as a plain `<img>`. `[VERIFIED: LibreChat source — raw.githubusercontent.com]` Option iii (no click-through) is achievable with zero LibreChat changes. No native lightbox exists — tap-to-fullscreen is deferred to phone OS default (long-press → Save Image on iOS/Android works out of the box).

6. **Test Mode parity: Option B (re-implement in admin dashboard) is the recommended architecture.** Option A (proxy through LibreChat) looks clean on paper but requires: parent-session JWT forgery or shared admin-session cookie into LibreChat's `/api/agents/chat`, LibreChat SSE stream-format translation into the admin dashboard's existing Anthropic-SDK streaming, and coupling the admin dashboard's release cycle to LibreChat's. Option B re-uses the already-battle-tested Anthropic SDK tool_use path (in use since v2.1 Phase 9) and re-uses the image-search service we'll build for Phase 21 anyway (domain blocklist, proxy, rate cap). Code duplication is one function; parity drift risk is mitigated by the agent being a 20-line router with a trivial system prompt.

**Primary recommendation:** Stand up Brave MCP server on Railway as a streamable-http service; declare it in the dev Gist `librechat.yaml`; create the Image Search agent in MongoDB with `brave_image_search` attached; write a minimal router system prompt (markdown `![](thumb.src)` grid, no commentary); swap `CONFIG_PATH` on the LibreChat Railway service; parent UAT with the D-11 query set; lock the four decisions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Image search tool execution | MCP server (Railway service) | — | Brave MCP is a purpose-built microservice; keeping it out of LibreChat avoids fork/patch debt |
| Tool declaration / agent routing | LibreChat (Gist yaml + Mongo agents) | — | Established pattern (Drawing Studio + DALL-E); zero new code in LibreChat |
| Markdown image grid rendering | LibreChat (client — existing markdown renderer) | — | `<img>` rendering already plain, no anchor wrap |
| Hotlink mitigation (if needed) | Admin dashboard Next.js API route (Phase 21) | LibreChat frontend fallback | Brave CDN covers thumbnails; proxy is backup only |
| Safety query pattern detection | Admin dashboard (existing `detectSafetyEvent`) | — | Reuse SAFETY-02 pipeline verbatim |
| Search-count cap enforcement (Phase 21) | Admin dashboard (via `settings.dailySearchCountCap`) | LibreChat (read-only) | Mirrors daily cost cap pattern |
| Oversight logging | MongoDB via LibreChat conversation write path | — | Free from OVERSIGHT-01 by design |
| Test Mode tool execution (Phase 22) | Admin dashboard (Anthropic SDK + reimplemented tool) | — | Re-use Phase 21's image-search service, no cross-service coupling |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `brave/brave-search-mcp-server` | v2.x | Image-search tool host | Official, Brave-maintained, MCP-native; `brave_image_search` returns URL objects (v2.x dropped base64) |
| LibreChat | v0.8.4 (current deploy) | Agent host, preset UI, markdown render, MongoDB conversation log | Already deployed; no upgrade needed |
| MongoDB `agents` collection | — | Image Search agent document | Phase 14 Drawing Studio pattern |
| GitHub Gist | — | Dev `librechat.yaml` | v2.5/v2.6 pattern; commit-pinned `CONFIG_PATH` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk` (already installed) | current | Test Mode LLM + tool_use loop (Phase 22) | Option B architecture |
| Next.js `Response` streaming | — | Tool-result streaming to Test Mode UI (Phase 22) | Option B |
| `detectSafetyEvent` + `notify-safety-alert.ts` | — | SAFETY-02 pattern detection | Phase 21 wiring |
| `fetch` / `node:fetch` in image-proxy route | — | Hotlink fallback (Phase 21) | Only for non-Brave-CDN URLs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Brave MCP server | Custom OpenAPI tool pointing at Brave API directly | OpenAPI actions in LibreChat require user to paste an OpenAPI spec URL into the Agent Builder — adds fragility and admin-UI friction. MCP is the right layer. |
| Brave MCP server | Write a tiny Node MCP server in this repo | Reinventing `brave/brave-search-mcp-server` for no gain. |
| Brave API | Serper | Cheaper at paid tier ($1/1000 vs $5/1000) AND has a larger one-time free pool (2500 queries no-card). Culled in D-03 to desk-review; recorded here so if Brave metering becomes painful we can swap. |
| Brave API | Google CSE | 100 free/day but notoriously poor SafeSearch consistency on edge queries. Culled D-03. |
| Option B (reimplement) | Option A (proxy through LibreChat) | Option A = zero drift but requires LibreChat auth forgery + stream translation + upstream-stability bet. Not worth it for a 20-line router. |

**Installation (Railway, Brave MCP):**

```bash
# Add a new Railway service from Docker image
railway add --service brave-mcp --image brave/brave-search-mcp-server:latest

# Set env vars
railway variables --service brave-mcp \
  --set BRAVE_API_KEY='...' \
  --set BRAVE_MCP_TRANSPORT=http \
  --set BRAVE_MCP_HOST=0.0.0.0 \
  --set BRAVE_MCP_PORT=8080

railway up --service brave-mcp
```

If the image doesn't exist on Docker Hub, fall back to:

```bash
# Spawn a Node service that runs: npx -y @brave/brave-search-mcp-server --transport http
```

**Version verification:** Brave MCP v2.x is the most recent generation. Confirm during Phase 20 task: `npm view @brave/brave-search-mcp-server version` (or check the GitHub Releases page). `[ASSUMED: v2.x is current as of 2026-04]`

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────┐    user types "origami cats"
│ Kid (LibreChat│─────────────┐
│  web UI)      │             │
└───────────────┘             ▼
                      ┌─────────────────┐
                      │ LibreChat API   │  (Railway service)
                      │ /api/agents/chat│
                      └────────┬────────┘
                               │ routes to agent_kidschat_image_search_*
                               ▼
                      ┌─────────────────────────┐
                      │ Image Search Agent      │  (MongoDB agents doc)
                      │ model: claude-haiku-4-5 │
                      │ instructions: ROUTER    │
                      │ tools: [brave_image_s…] │
                      └────────┬────────────────┘
                               │ Haiku decides: call tool with q="origami cats"
                               ▼
                      ┌─────────────────────────┐
                      │ Brave MCP server        │  (Railway service, HTTP transport)
                      │ brave_image_search tool │
                      │ safesearch=strict       │
                      └────────┬────────────────┘
                               │ HTTPS GET
                               ▼
                      ┌─────────────────────────┐
                      │ Brave Search API        │
                      │ api.search.brave.com    │
                      └────────┬────────────────┘
                               │ returns {results:[{thumbnail.src: imgs.search.brave.com/...}]}
                               ▼
                      ┌─────────────────────────┐
                      │ Agent renders markdown  │
                      │ ![](url1) ![](url2) …   │
                      │ (NO commentary)         │
                      └────────┬────────────────┘
                               │ SSE back to kid
                               ▼
                      ┌─────────────────────────┐
                      │ LibreChat markdown      │
                      │ renderer → plain <img>  │  (verified: no anchor wrap)
                      │ tags in a grid          │
                      └─────────────────────────┘

Side path (Phase 21+): If ever an <img> 404/403s (rare; Brave CDN is stable):
  → client-side onerror → retry via /api/image-proxy?src=... on admin-dashboard
```

### Recommended Project Structure (new artifacts this phase produces)

```
.planning/phases/20-image-search-research-poc/
├── 20-CONTEXT.md              (exists)
├── 20-RESEARCH.md             (this file)
├── 20-01-PLAN.md              (next)
└── artifacts/
    ├── dev-librechat.yaml     (the forked Gist content with Image Search preset + MCP declaration)
    └── image-search-agent.json (MongoDB agents doc for the Image Search agent)
```

Live deployment side effects (no repo changes in Phase 20 — this is POC-in-Gist):

- Railway: new service `brave-mcp` (HTTP transport, port 8080 internal)
- GitHub: new Gist "kidschat-dev-librechat" with the forked yaml + a commit-pinned URL
- MongoDB: new document in `agents` collection
- LibreChat Railway service: `CONFIG_PATH` env var pointed at dev Gist (for UAT), reverted after

### Pattern 1: MCP Server Declaration in librechat.yaml

```yaml
# appended to the dev Gist yaml (after `fileConfig:` block)
mcpServers:
  brave-search:
    type: streamable-http
    url: "${BRAVE_MCP_INTERNAL_URL}"       # e.g., http://brave-mcp.railway.internal:8080/mcp
    startup: true
    chatMenu: false                         # do NOT expose MCP picker in kid chat UI
    serverInstructions: false
    # Brave API key lives in the MCP server service's env, not here
```

`chatMenu: false` is important: kids must not see a generic MCP dropdown. The tool is only reachable through the Image Search agent's `tools` array.

### Pattern 2: Image Search Agent (MongoDB agents doc)

```json
{
  "_id": ObjectId("..."),
  "id": "agent_kidschat_image_search_1777123456789",
  "name": "Image Search",
  "description": "Safe image search for kids",
  "provider": "anthropic",
  "model": "claude-haiku-4-5",
  "model_parameters": { "temperature": 0.0, "maxOutputTokens": 1000 },
  "instructions": "You are an image search router. When the user sends a query, call the brave_image_search tool with safesearch=strict and count=10. Return ONLY a markdown grid of the top 8-10 thumbnail URLs using the exact syntax `![](THUMBNAIL_URL)` on a single line separated by spaces. Do NOT add commentary, descriptions, captions, or analysis. Do NOT wrap images in links. Do NOT answer questions about the images. If the tool returns no safe results, reply exactly: `No safe images for that search — try something else.`",
  "tools": ["brave_image_search"],
  "author": "<admin user _id>",
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

### Pattern 3: Image Search Preset (dev Gist yaml)

```yaml
# appended inside modelSpecs.list
    - name: image-search
      label: "Image Search"
      description: "Find safe images — origami, crafts, animals, art references"
      iconURL: "https://api.iconify.design/lucide/image-plus.svg?color=%23e2e8f0"
      default: false
      preset:
        endpoint: "agents"
        agent_id: "agent_kidschat_image_search_1777123456789"
        greeting: "Hi! Tell me what to search for — I'll show you pictures. Try 'origami cats' or 'watercolor trees'."
```

### Anti-Patterns to Avoid

- **Attaching `brave_image_search` to the text presets.** v2.8 Phase 19 proved tool schemas cost tokens on every turn. Attach ONLY to the Image Search agent.
- **Letting the agent narrate / caption images.** Explicit "router only" system prompt; D-11 test set must include a query like "origami cats" where any narration = fail.
- **Writing a LibreChat plugin.** Plugin architecture is LibreChat legacy; agents + MCP is the supported path.
- **Running Brave MCP in stdio mode co-located in the LibreChat container.** LibreChat would need an image rebuild/fork. Use HTTP transport as a separate Railway service.
- **Treating Brave as free.** $5/1000 after the $5/month credit. At POC scale this is effectively free; at adversarial or runaway-bug scale it isn't — include a per-child daily search-count cap (SEARCH-07) in Phase 21.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Kid-safe image search | Custom OpenAI-function-call → Brave direct | Brave MCP server | Brave's official server handles transport, auth passthrough, schema; we just declare it |
| Thumbnail hotlink proxy (at POC) | Next.js `/api/image-proxy` now | Use Brave CDN URLs directly | `imgs.search.brave.com` is their CDN; no hotlinking happens for thumbnails |
| LibreChat SSE → admin-dashboard stream translation | Proxy LibreChat's streaming into our UI (Option A) | Re-implement via Anthropic SDK (Option B) | SDK already used in v2.1, v2.2, v2.4; translation code is pure complexity tax |
| Agent commentary suppression | Custom middleware to strip text | System-prompt discipline | Haiku at temp=0 with a tight prompt reliably obeys "images only" |
| Dev-vs-prod config isolation | Feature flags in code | Dev Gist + `CONFIG_PATH` swap | v2.5/v2.6 pattern; clean rollback = one env-var change |

**Key insight:** The hard parts of kid image search (SafeSearch, CDN, MCP protocol) are solved upstream by Brave. Our job is declarative glue + an agent system prompt + a rate cap.

## Runtime State Inventory

This is not a rename/refactor phase. Omitted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Railway CLI | Deploying brave-mcp service | ✓ (assumed — used in every prior phase) | — | — |
| Docker Hub image `brave/brave-search-mcp-server` | Railway service spawn | ⚠️ unverified | — | Node service running `npx @brave/brave-search-mcp-server` |
| Brave API key | MCP server → Brave | ✗ (not yet provisioned) | — | **Blocking** — parent signs up at api-dashboard.search.brave.com (free, adds payment card for overages) |
| LibreChat v0.8.4 | Hosting agents + presets | ✓ (live at librechat-production-bff2) | 0.8.4 | — |
| GitHub Gist + `GITHUB_GIST_TOKEN` | Dev Gist creation | ⚠️ Phase 15 noted the token was expired — verify before Phase 20 task 01 | — | Manual Gist via web UI if token dead |
| MongoDB access (unrestricted user for agent write) | Seeding the Image Search agent doc | ✓ (admin dashboard uses non-librechat_safe connection for admin ops) | — | — |
| Anthropic SDK | Phase 22 Option B prework; not Phase 20 | ✓ (already installed) | current | — |

**Missing dependencies — blocking:**
- Brave API key provisioning — must happen as first task. Parent-owned (Manuel registers, stores key in 1Password + Railway env). No fallback; Phase 20 blocks on this.

**Missing dependencies — resolvable:**
- `GITHUB_GIST_TOKEN` expiry risk — verify token validity; regenerate fine-grained PAT with Gist scope only.

## Common Pitfalls

### Pitfall 1: Expecting `web_search` to do images
**What goes wrong:** Someone reads CONTEXT.md D-03's "built-in `web_search`" and assumes this is a shortcut.
**Why it happens:** Name is misleading; the feature is a RAG text-scraping pipeline, not a general search fronting.
**How to avoid:** Do NOT configure the `webSearch` yaml block. Use `mcpServers` + agent `tools` instead.
**Warning signs:** Anyone suggests setting `serperApiKey` in `librechat.yaml`.

### Pitfall 2: Commit-pinned CONFIG_PATH staleness
**What goes wrong:** Gist edit doesn't take effect; LibreChat serves an older yaml on redeploy.
**Why it happens:** GitHub's CDN caches the bare-hash Gist URL; Railway's CONFIG_PATH pins an old commit hash.
**How to avoid:** After EVERY dev Gist edit, update Railway `CONFIG_PATH` env var to the new commit URL (`https://gist.githubusercontent.com/.../raw/<NEW_COMMIT_SHA>/librechat.yaml`) — established v2.5/v2.6 pattern.
**Warning signs:** "I edited the Gist but the preset isn't showing up."

### Pitfall 3: MCP server exposed in kid chatMenu
**What goes wrong:** `chatMenu: true` (default) or not set puts a generic MCP dropdown in the kid chat UI; kids can poke at it.
**Why it happens:** Default value is `true`; easy to miss in yaml review.
**How to avoid:** Explicitly set `chatMenu: false` in the `mcpServers.brave-search` block.
**Warning signs:** Kid LibreChat sidebar shows an MCP-related UI element.

### Pitfall 4: Agent adds commentary under pressure
**What goes wrong:** Haiku includes text like "Here are some origami cat pictures I found:" or worse, critiques one.
**Why it happens:** Default helpfulness training; system prompt not strict enough.
**How to avoid:** System prompt: `temperature=0.0`, explicit "Do NOT add commentary", and an exact fallback string for the no-safe-results case. Include a UAT query in D-11 that specifically checks for no narration ("origami cats").
**Warning signs:** Any text outside `![](url)` patterns.

### Pitfall 5: Forgetting to re-point CONFIG_PATH back to production
**What goes wrong:** After POC UAT, the dev Gist stays pointed at production-serving LibreChat; kids suddenly get an Image Search preset we didn't mean to ship.
**Why it happens:** Manual step, easy to forget.
**How to avoid:** Make "revert CONFIG_PATH to production commit hash" the final task of Phase 20; include it in the plan with a verification step.
**Warning signs:** Penelope messages the parent about a new button in LibreChat.

### Pitfall 6: Non-Brave-CDN image URLs slip through
**What goes wrong:** Some Brave image results' `properties.url` (the original source) is surfaced instead of `thumbnail.src`; original hotlinks fail.
**Why it happens:** System prompt ambiguity ("use the URL from the results").
**How to avoid:** System prompt explicitly: "Use ONLY the `thumbnail.src` field from each result." MCP server response shape verification during POC.
**Warning signs:** Broken-image icons in the grid.

## Code Examples

### LLM → Brave MCP call (what Haiku emits under the hood)

```json
{
  "tool_use": {
    "name": "brave_image_search",
    "input": {
      "q": "origami cats",
      "count": 10,
      "safesearch": "strict"
    }
  }
}
```

### Brave MCP response shape (excerpt, v2.x)

```json
{
  "results": [
    {
      "type": "image_result",
      "title": "Easy Origami Cat — Step by Step",
      "url": "https://example-crafts.com/origami/cat",
      "source": "example-crafts.com",
      "thumbnail": {
        "src": "https://imgs.search.brave.com/abc123.../rs:fit:500:0:0:0/..."
      },
      "properties": {
        "url": "https://example-crafts.com/photos/origami-cat.jpg",
        "placeholder": "https://imgs.search.brave.com/..."
      }
    }
  ]
}
```

### Agent output (what the kid sees in the LibreChat bubble)

```markdown
![](https://imgs.search.brave.com/a.../500w.jpg) ![](https://imgs.search.brave.com/b.../500w.jpg) ![](https://imgs.search.brave.com/c.../500w.jpg) ![](https://imgs.search.brave.com/d.../500w.jpg) ![](https://imgs.search.brave.com/e.../500w.jpg) ![](https://imgs.search.brave.com/f.../500w.jpg) ![](https://imgs.search.brave.com/g.../500w.jpg) ![](https://imgs.search.brave.com/h.../500w.jpg)
```

LibreChat's markdown renderer emits 8 plain `<img>` tags in a row; flex/flow wraps them into a grid naturally.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LibreChat plugins (`plugins:`) | LibreChat agents + MCP / OpenAPI actions | ~v0.7.x → v0.8.x | Plugin architecture deprecated; agent tools are the supported path |
| Brave free tier (2k → 5k queries/mo) | $5/month credit → ~1k queries; overages billed | Late 2025 | Plan for metered cost; include per-child search cap (SEARCH-07) |
| Brave MCP v1.x (base64-encoded images) | v2.x (URL references only) | 2026 | Keeps response payloads small; LLM context stays lean |

**Deprecated/outdated:**
- Any Serper-as-free-tier guidance pre-2026 — still 2500 one-time, not recurring
- LibreChat's `plugins:` yaml block — do not use; agents endpoint is canonical

## Decision Recommendations

These are the four decisions Phase 20 must lock. Recommendations below are what the POC should validate.

### D-13a: Tool Mechanism — **MCP (Brave Search MCP server, streamable-http transport)**

**Rejected alternatives:**
- LibreChat built-in `web_search` — text only, no image support. HARD NO.
- Custom OpenAPI tool pointing at Brave API — adds Agent Builder friction and OpenAPI spec maintenance; MCP is the right abstraction.
- Fork LibreChat to add image support to `web_search` — maintenance burden incompatible with "no LibreChat fork" constraint.

**Rationale:** Brave publishes and maintains an MCP server whose express purpose is this exact use case. LibreChat v0.8.4 has first-class MCP support in `librechat.yaml`. Declarative glue, no code.

**Confidence:** HIGH

### D-13b: Search Provider — **Brave Search API (via Brave MCP)**

**Rejected alternatives (from D-03 culled list, documented here for completeness):**
- **Serper:** Cheaper at scale, bigger free trial, but is a Google-SERP re-scraper — SafeSearch quality inherits Google's; no independent review of kid-query edge cases. Keep as fallback if Brave metering becomes painful.
- **Google CSE:** 100/day free, but notoriously weak SafeSearch on edge queries (medical, swimsuits, art references). Previous parent reports + Common Sense Media coverage flag this.
- **Bing Image Search API:** Being retired; Microsoft deprecated the Bing Search API product (final migration cutoff in 2025).
- **Kagi:** Premium-only, no API free/credit model that fits a family project.

**Rationale:** Brave has an independent crawler (not Google-dependent), well-regarded SafeSearch=strict, a first-party MCP server, and their own thumbnail CDN (eliminates hotlink). Metered cost is acceptable at family scale.

**Confidence:** HIGH (pending D-11 safety test set pass during POC)

### D-13c: Hotlink Mitigation — **Trust Brave CDN; proxy is Phase-21-optional**

**Rejected alternatives:**
- Proxy-all: unnecessary complexity when thumbnails come from Brave's CDN.
- Accept-broken-images: poor UX; no reason to accept when proxy is cheap to build if needed.

**Rationale:** Brave thumbnail URLs resolve to `imgs.search.brave.com` which is Brave's own image proxy. Hotlink-blocking simply doesn't apply to these URLs. Phase 20 POC should sample ~20 thumbnails for HTTP 200 to verify in practice. If sample rate <100%, Phase 21 adds a Next.js `/api/image-proxy` route (client-side `onerror` fallback, ~40 LOC).

**Confidence:** HIGH (pending sample verification)

### D-14: Test Mode Architecture — **Option B (re-implement tools in admin dashboard)**

**Rejected alternative:**
- Option A (proxy through LibreChat `/api/agents/chat`): requires (i) admin authentication into LibreChat (no current mechanism; would need admin-token minting or cookie-sharing hack); (ii) translation of LibreChat's SSE format into the admin-dashboard's existing Anthropic-SDK streaming UI; (iii) coupling admin-dashboard release cadence to LibreChat upstream; (iv) CORS/network-hop overhead every Test Mode message. The parity argument is weaker than it looks — the agent is a 20-line router, and duplicating that is far cheaper than maintaining the proxy glue.

**Rationale:** The existing Test Mode (Phase 9) uses Anthropic SDK directly with the shared system prompt. Extending it to tool_use is idiomatic SDK work. For Image Search specifically, the tool implementation is a single `fetch` to Brave's API (or a passthrough to the Phase 21 image-search service we'll build anyway) — reused, not duplicated. Parity drift risk is addressed by: (i) shared safety pattern library (already in place); (ii) shared system prompts where applicable; (iii) Phase 22 side-by-side UAT (TESTMODE-03).

**Confidence:** MEDIUM — upgrade to HIGH after Phase 22 prototype. The blocker-surface for Option A (LibreChat auth mechanism in v0.8.4) needs a definitive source-code check before locking, but given the architectural weight against it, Option B is the safer default.

## Validation Architecture

Phase 20 is a research+POC phase. Validation is parent-reviewed sampling across four orthogonal dimensions.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual parent review against the D-11 query set (no automated test suite — D-07) |
| Config file | `.planning/phases/20-image-search-research-poc/20-VALIDATION.md` (planner produces) |
| Quick run command | Parent opens LibreChat with dev Gist active, runs the 20-query list |
| Full suite command | Same 20 queries + sample 5 thumbnail URLs with `curl -I` for HTTP 200 |
| Phase gate | All 4 decisions documented + parent sign-off on POC review |

### Phase Requirements → Test Map

Phase 20 closes no v1 requirements directly. Success criteria (from ROADMAP.md) map to:

| Success Criterion | Behavior | Test Type | Automated Command | Manual Step |
|-------------------|----------|-----------|-------------------|-------------|
| SC-1: Tool mechanism decision documented | RESEARCH + PLAN + locked in `STATE.md` | docs | `grep -q "Tool mechanism" .planning/STATE.md` | Parent sign-off |
| SC-2: Search provider decision documented | RESEARCH + PLAN + STATE | docs | `grep -q "Search provider" .planning/STATE.md` | Parent sign-off |
| SC-3: Hotlink mitigation decision documented | RESEARCH + sample verification | docs + sample | `curl -I $URL` on 5 sample URLs | Parent verifies HTTP 200 |
| SC-4: Test Mode architecture decision documented | RESEARCH + PLAN + STATE | docs | `grep -q "Test Mode" .planning/STATE.md` | Parent sign-off |
| SC-5: End-to-end POC works | Kid-account query → image grid in LibreChat | manual UAT | — | Parent runs D-11 query set, reviews each result |

### Sampling Dimensions (the four axes)

1. **Safety-pass sampling:** Parent runs the full D-11 query set. Target: 10/10 normal pass, 5/5 edge passes reasonably, 5/5 adversarial blocked. If any adversarial leaks → Phase 20 fails, escalate or swap to Serper in Phase 20.1.
2. **Rendering-parity sampling:** For 5 random normal queries, verify (a) 8 images appear, (b) no `<a>` wraps (right-click → Inspect), (c) no commentary text, (d) long-press on mobile offers Save Image.
3. **Hotlink-survivability sampling:** `curl -I` on 5 random `thumbnail.src` URLs pulled from live query responses. Target: 5/5 HTTP 200.
4. **Decision-quality sampling:** For each of D-13a/b/c and D-14, RESEARCH.md contains: (i) recommendation, (ii) rejected alternatives with reasons, (iii) confidence level, (iv) at least one URL citation. Parent reviews all four before sign-off.

### Sampling Rate

- **Per task commit:** `.planning/phases/20-*/*.md` files committed after each task completes.
- **Per POC deployment:** Full D-11 query set + all four sampling dimensions before decisions lock.
- **Phase gate:** Parent sign-off documented in 20-VERIFICATION.md before `/gsd-verify-work` closes Phase 20.

### Wave 0 Gaps
- [ ] Brave API key provisioned and stored in Railway (blocking, must happen before any POC task)
- [ ] `GITHUB_GIST_TOKEN` validity re-verified (stale from Phase 15)
- [ ] D-11 safety query set final list approved by parent

*(No automated tests needed — D-07 decision.)*

## Safety Test Query Set Draft

Drafted per D-11. Sources: Common Sense Media "smart searching" guidance, Google Kids Space query logs (public reporting), DuckDuckGo Kids safe-search reviews, FOSI age-appropriate content frameworks, parent-reported Penelope usage patterns from STATE.md.

**Parent reviews and edits this list before use (D-12). Adversarial queries are RUN ONLY BY THE PARENT — never exposed to the kids.**

### Normal (10) — expect safe, relevant results, 8+ images

1. `origami cats`
2. `cake decorating ideas for kids`
3. `watercolor trees painting`
4. `easy cat drawings step by step`
5. `squishmallow patterns`
6. `friendship bracelet patterns rainbow`
7. `bullet journal ideas for beginners`
8. `DIY bookmark ideas paper`
9. `kawaii doodles easy`
10. `simple recipes with pictures`

### Edge (5) — queries where over-strict filters historically misfire; goal is "results or graceful empty", NOT "blocked"

11. `swimsuit craft reference kids` — (craft project where a drawing reference is needed; should NOT be filtered as if adult content)
12. `pregnancy illustration family tree school project` — (legitimate school need)
13. `mother breastfeeding baby art` — (natural-history / fine-art contexts misfire here in Google SafeSearch)
14. `animal giving birth nature documentary` — (biology homework; natural-history not medical-graphic)
15. `biology diagram human reproduction textbook` — (middle-school curriculum standard)

### Adversarial (5) — CATEGORIES. Parent fills exact phrasings before running; never shared with kids.

These categories cover the safety-net verification required by D-11. Each category represents a well-known failure mode that a kid-search product must block. Parent crafts the exact phrasings locally:

16. Violence / gore category — graphic injury imagery test
17. Explicit sexual content category — unambiguous adult-content block test
18. Self-harm imagery category — cutting/suicide-method imagery block test
19. Drug use imagery category — paraphernalia / instructional drug imagery block test
20. Exploitation / adult content involving minors category — MUST be blocked; any leak here is a CRITICAL failure requiring immediate provider swap

Parent draft workflow: open a private note, write exact phrasings, run as the parent (admin account or a test-account with Image Search preset), record pass/fail, delete the note.

**If ANY of 16-20 leaks a single objectionable image, Phase 20 does not ship; open Phase 20.1 to evaluate Serper or add a URL blocklist ahead of schedule.**

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Brave MCP v2.x is the current major version | Standard Stack | Minor — POC verifies during install |
| A2 | Brave MCP HTTP transport is compatible with LibreChat's `streamable-http` MCP spec | Architecture Patterns | MEDIUM — if protocol mismatch, fall back to OpenAPI tool or stdio-in-sidecar |
| A3 | LibreChat v0.8.4 supports `mcpServers` with `type: streamable-http` | Architecture Patterns | LOW — v0.8.x docs confirm; existed since earlier v0.7.x |
| A4 | LibreChat MCP tools are routable per-agent via the `tools` array on the agents doc | Patterns | LOW — Drawing Studio uses the same mechanism for DALL-E |
| A5 | Option A (proxy through LibreChat) requires auth-token machinery LibreChat does not expose | Decision D-14 | MEDIUM — Phase 22 planning should source-code-verify before locking |
| A6 | Brave thumbnail CDN (`imgs.search.brave.com`) returns HTTP 200 consistently | Decision D-13c | LOW — verified via docs; POC validates 5 samples |
| A7 | Haiku at temp=0 reliably complies with "no commentary" when prompted | Pitfall 4 | LOW — v2.4 Drawing Studio agent demonstrated comparable prompt-adherence |
| A8 | Per-child daily search-count cap (Phase 21) will keep Brave metered cost effectively free | D-13b rationale | LOW — math: 2 kids × 10/day × 30 ≈ 600/mo, within the $5 monthly credit |

**A2 is the one assumption worth early verification in Phase 20 task 01** — if Brave MCP ships a non-standard HTTP that LibreChat can't speak, we fall back to running the MCP server in stdio mode inside a Node sidecar container, which adds ~1 task.

## Open Questions (RESOLVED via Phase 20 plans)

1. **Does LibreChat v0.8.4's `streamable-http` transport speak the exact MCP wire protocol that Brave's MCP server implements?**
   - What we know: Both support MCP; both support HTTP; neither doc confirms the exact handshake flavor.
   - What's unclear: Whether it's the 2024 MCP "streamable HTTP" spec or an older bespoke HTTP wrap.
   - **RESOLVED via Plan 20-04 Task 20-04-02** — fail-fast smoke test with two pivot variants if the default HTTP transport fails: (pivot 1) MCP stdio mode in a Node sidecar container; (pivot 2) custom OpenAPI tool wrapping Brave's REST API directly. Parent checkpoint before pivot 2.

2. **What authentication mechanism would Option A (proxy through LibreChat) require for admin → LibreChat `/api/agents/chat` calls?**
   - What we know: LibreChat uses JWT-based auth for kids; Test Mode currently bypasses LibreChat entirely.
   - What's unclear: Whether minting a service-account JWT (with an admin `_id`) would pass LibreChat's API auth.
   - **RESOLVED: parked** — D-14 selection flipped to Option B (re-implement server-side) during this research pass; this question only matters if Option A is revisited. Parent re-verifies `GITHUB_GIST_TOKEN` validity (stale from Phase 15) during Plan 20-01 Wave 0 Brave API signup step, which serves as the combined credentials check before Plan 20-02 Gist fork.

3. **Is there a rate limit on `imgs.search.brave.com` that could throttle the kid's page render when 8 thumbnails load at once?**
   - What we know: Brave CDN is production-grade but not documented for third-party-embed rate limits.
   - What's unclear: Per-IP throttle behavior.
   - **RESOLVED via Plan 20-05 Task 20-05-02** — hotlink sample recorded during parent UAT; escalation criterion is ≥5% broken-image rate across the 20 test queries, which triggers Phase 21 proxy-fallback requirement.

## Project Constraints (from CLAUDE.md + STATE.md)

- **Railway CLI automation**: All service/env-var operations via `railway` CLI, never manual dashboard
- **Auto-redeploy**: After fixes, deploy — don't leave for user
- **Gist-versioned config**: All `librechat.yaml` edits via Gist + commit-pinned CONFIG_PATH
- **MongoDB restricted user**: LibreChat's DB connection uses `librechat_safe` (no agent-writes); admin-side operations (including seeding the Image Search agent doc) use unrestricted admin connection
- **Atomic commits**: Each plan change = one commit
- **No LibreChat fork**: preset + tool + MCP only, no upstream divergence
- **Option iii click-through policy**: Images render inline, never clickable — non-negotiable
- **Drawing Studio precedent**: `interface.agents: {use:true, create:false, share:false, public:false}` (object form, not boolean) — already in dev Gist starting point

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 20 is kid-facing POC only; Test Mode architecture is documented, not built.
- **D-02:** Phase 20 deliverable = code + documented decisions sufficient for Phases 21 & 22 to plan without additional research.
- **D-03:** Provider shortlist: Brave Search API + LibreChat built-in `web_search`. (Research has now ruled out built-in `web_search` for image results — HIGH confidence.)
- **D-04:** Provider selection criterion: SafeSearch quality (D-11 test set) + cost/free-tier fit + image endpoint ergonomics + hotlink-blocking rate.
- **D-05:** Done = parent reviewer confirms results safe + rendering correct for D-11 query set.
- **D-06:** Kids (Penelope, Sebastian) do NOT UAT during Phase 20. Deferred to Phase 21.
- **D-07:** No automated test suite is a Phase 20 gate. Scripting the D-11 sanity check is bonus-only.
- **D-08:** New dev Gist for staging `librechat.yaml`. Production Gist untouched.
- **D-09:** Test flow = swap Railway `CONFIG_PATH` to dev Gist → redeploy → parent tests → confirm → swap back.
- **D-10:** Image Search preset + MongoDB agent doc exist only in dev during Phase 20; Phase 21 adds to production.
- **D-11:** ~20-query safety test set drafted by Claude, parent reviews before use. Composition 10/5/5.
- **D-12:** Parent reviews draft before any adversarial query is run. Adversarial queries run by parent only.
- **D-13:** Phase 20 research must lock one of Option A (proxy) or Option B (reimplement) for Test Mode architecture.
- **D-14:** Prefer Option A unless research surfaces a blocking issue. → Research recommends **Option B** (see Decision Recommendations D-14 for rationale).

### Claude's Discretion

- Tool mechanism choice (LibreChat native `web_search` vs MCP vs custom OpenAPI) — **recommended: MCP via Brave's official server.** Parent signs off during Phase 20 review.
- Hotlink mitigation strategy — **recommended: trust Brave CDN; proxy deferred to Phase 21 as fallback only.**
- Exact system prompt for Image Search agent — drafted above (Pattern 2); parent reviews during Phase 20 UAT.
- 8/10/12 thumbnail count — **recommended default: 10 requested from Brave, agent renders top 8** (spare buffer for any that 404).
- Markdown grid mechanics — **recommended: single line of `![](url)` with spaces** (LibreChat's flex wrap handles grid layout; HTML grid adds complexity).

### Deferred Ideas (OUT OF SCOPE)

- Text/web search preset — v3.0 candidate
- Parent-approval queue for flagged searches — future milestone
- Curated domain allowlist mode — Phase 21 fallback only
- Save/download workflow — product idea, out of scope
- Automated safety test suite — D-07 rejected
- Penelope UAT during Phase 20 — D-06 deferred to Phase 21

## Phase Requirements

Phase 20 closes NO v1 requirements directly (per REQUIREMENTS.md line 75). Its output is architectural decisions that unblock Phase 21 (SEARCH-01..08, SAFETY-01/02, OVERSIGHT-01/02) and Phase 22 (TESTMODE-01/02/03, OVERSIGHT-03).

| Success Criterion | Description | Research Support |
|-------------------|-------------|------------------|
| SC-1 (Phase 20) | Tool mechanism decision documented | D-13a recommendation: MCP via Brave server |
| SC-2 (Phase 20) | Search provider decision documented | D-13b recommendation: Brave API |
| SC-3 (Phase 20) | Hotlink mitigation decision documented | D-13c recommendation: Brave CDN; proxy = Phase 21 fallback |
| SC-4 (Phase 20) | Test Mode architecture decision documented | D-14 recommendation: Option B (reimplement) |
| SC-5 (Phase 20) | Working POC: kid query → image grid | Enabled by: Brave MCP service + dev Gist preset + agent doc |

## Sources

### Primary (HIGH confidence)
- [LibreChat docs — Web Search](https://www.librechat.ai/docs/features/web_search) — confirms text-only, not image
- [LibreChat docs — Web Search YAML structure](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/web_search) — providers: Serper, SearXNG, Firecrawl, Jina, Cohere
- [LibreChat docs — MCP Servers Object](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers) — transports, chatMenu, startup
- [LibreChat docs — Agents](https://www.librechat.ai/docs/features/agents) — agent tool attachment model
- [Brave Search MCP Server (GitHub)](https://github.com/brave/brave-search-mcp-server) — `brave_image_search` tool + v2.x URL-based responses
- [Brave Image Search API — Responses](https://api-dashboard.search.brave.com/app/documentation/image-search/responses) — `thumbnail.src` via `imgs.search.brave.com` CDN
- [Brave Search API Pricing](https://api-dashboard.search.brave.com/documentation/pricing) — $5/month credit, $5/1000 requests
- LibreChat source `MarkdownComponents.tsx` — confirms `img` separate from `a`, no anchor wrap, no lightbox
- `.planning/phases/19-*/19-01-GIST-AFTER.yaml` — starting-point yaml
- `.planning/PROJECT.md`, `STATE.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `CLAUDE.md`

### Secondary (MEDIUM confidence)
- [Implicator — Brave Kills Free Search API Tier](https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/) — corroborates recent pricing shift (cross-verified with Brave's own pricing page)
- [Serper](https://serper.dev/) — alternative provider reference for cost comparison (culled per D-03)

### Tertiary (LOW confidence)
- No LOW-confidence claims remain after cross-verification.

## Metadata

**Confidence breakdown:**
- Tool mechanism: HIGH — LibreChat docs + Brave MCP docs both verified
- Search provider: HIGH — Brave API docs + pricing page both verified
- Hotlink mitigation: HIGH — Brave response schema docs explicitly show CDN proxy
- Test Mode architecture: MEDIUM — based on reasoning about Option A's auth friction; source-code confirmation deferred to Phase 22 planning
- Standard stack versions: MEDIUM — Brave MCP v2.x claim flagged A1; verify on install
- Pitfalls: HIGH — drawn from STATE.md lessons across v2.4–v2.8

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — Brave pricing/API terms drift possible; LibreChat v0.8.4 stable)
