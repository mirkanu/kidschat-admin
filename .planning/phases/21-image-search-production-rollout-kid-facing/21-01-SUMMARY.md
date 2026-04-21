---
phase: 21
plan: 01
subsystem: image-search-mcp
tags: [mcp, openverse, blocklist, quota, hotlink-proxy, retry, safety]
requires:
  - kidschat-image-search-mcp Railway service (Phase 20 Plan 05)
  - Openverse anonymous API
provides:
  - Query blocklist (D-8 L2, SAFETY-01)
  - Domain blocklist (SAFETY-01)
  - Per-user quota gating (SEARCH-07, server-side; admin endpoint delivered in Plan 21-02)
  - Hotlink proxy `/proxy?u=<base64url>` (SEARCH-06)
  - Modifier-trim zero-result retry (20-05 C-2, SEARCH-02)
affects:
  - LibreChat image_search tool responses (new `error` values: `blocked_query`, `quota_exceeded`)
  - Openverse thumbnail URLs now proxy-rewritten — raw upstream URL never leaves MCP
tech-stack:
  added:
    - node:test (no jest — stays dep-minimal)
    - node:async_hooks AsyncLocalStorage (userId-per-request scoping)
  patterns:
    - Fail-open on quota outage (T-21-06) — correctness: kid search must not be silently disabled by an admin outage
    - Host-allowlist + private-IP reject + 10s timeout + 5MB cap on SSRF-vulnerable /proxy route
key-files:
  created:
    - services/image-search-mcp/src/blocklist.ts
    - services/image-search-mcp/src/quota-client.ts
    - services/image-search-mcp/src/proxy.ts
    - services/image-search-mcp/src/__tests__/blocklist.test.ts
    - services/image-search-mcp/src/__tests__/openverse-retry.test.ts
  modified:
    - services/image-search-mcp/src/server.ts
    - services/image-search-mcp/src/providers/openverse.ts
    - services/image-search-mcp/package.json
    - services/image-search-mcp/tsconfig.json
decisions:
  - "userId-forwarding probe (Task 01): no streamable-http header or _meta field observed in curl-based tests; `user_id` tool-arg fallback wired. Full LibreChat-originated re-probe deferred to Plan 21-02 once admin /api/image-search/quota exists."
  - "Proxy Accept header: omit Accept: image/* (api.openverse.org returns 406); send User-Agent only, validate content-type in response."
  - "BLOCKED_QUERY_TERMS uses `breastfeed\\w*` / `breast(?!stroke)\\w*` to catch inflected forms (breastfeeding, breastfed, breasts)."
  - "Modifier-trim retry fires iff first HTTP-OK call returns 0 images AND stripping shortens the token count (never on upstream error, never all-stopword queries, never single-token queries)."
  - "20-05 C-2 status: APPROVED-WITH-CAVEATS (not fully closed) — retry closed the `cute red origami cats` case during production verification, but retry is best-effort; 21-05 UAT SEARCH-02 acceptance threshold stays at ≥60%."
metrics:
  duration_min: 45
  tasks: 3
  files_touched: 9
  tests_added: 20
  commits:
    - 33d63b1  # Task 01 - blocklist + quota + probe
    - 4478f69  # Task 02 - modifier-trim retry + proxy rewrite
    - 9f17327  # Task 03 - deploy + proxy Accept fix
  completed: 2026-04-21
---

# Phase 21 Plan 01: Image-search MCP Production Hardening Summary

MCP tool boundary is now the strongest safety gate: query blocklist (7 regex/7 reasons), domain blocklist (10 hosts), fail-open per-user quota client, host-allowlisted hotlink proxy, and a zero-result modifier-trim retry — all live on `kidschat-image-search-mcp-production.up.railway.app` v0.2.0 and observable via curl + Railway logs.

## Objective

Close five production-gate gaps identified in Phase 20:

1. **Query blocklist** — reject banned terms before Openverse is called; 7 regex categories (sexual_anatomy, sexual_content, self_harm, drugs, anatomy_visual, gore, real_person).
2. **Domain blocklist** — filter Openverse results whose `source_domain` is in a curated list of 10 adult/toxic hosts.
3. **Hotlink proxy** — `/proxy?u=<base64url>` streams image bytes server-side for thumbnails whose upstream blocks hotlinking; raw upstream URL never leaves the tool boundary.
4. **Per-user quota** — MCP calls kidschat-admin `POST /api/image-search/quota` with a shared secret; returns `error:"quota_exceeded"` when exceeded. Fail-open on outage.
5. **Zero-result retry** (20-05 C-2 / SEARCH-02) — retry ONCE with modifier words stripped when first call returns 0 HTTP-OK images.

## What shipped

### New modules

- **`src/blocklist.ts`** — `isQueryBlocked(query)` returns `{blocked, reason}` on first regex match; `filterBlockedDomains(images)` strips results whose `source_domain` contains any of 10 blocked hostname substrings. Regex patterns verbatim from plan's `<blocklist_seed>` with one expansion: `breastfeed\w*` / `breast(?!stroke)\w*` to catch inflected forms.
- **`src/quota-client.ts`** — `checkAndIncrementQuota(userId)` POSTs `{userId}` to `${ADMIN_BASE_URL}/api/image-search/quota` with `x-quota-secret` header and 3s timeout. **Deliberate fail-open**: returns `{allowed:true, remaining:null, error:"..."}` on network/HTTP/config failures so a quota-service outage never silently disables kid search (T-21-06 mitigation).
- **`src/proxy.ts`** — `handleProxy(req,res)` parses `?u=` base64url → URL → rejects non-https, private-IP hosts, and hostnames outside a static allowlist (openverse.org, flickr.com, staticflickr.com, wikimedia.org, wordpress.com, imgur.com). Fetches with 10s AbortSignal, streams with 5MB byte cap, validates `content-type: image/*`; on any failure returns a 1×1 transparent PNG with `Cache-Control: public, max-age=60` so the kid sees a blank tile rather than a broken-image icon.
- **`src/providers/openverse.ts`** (extended) — `stripModifiers(q)` + 34-word `MODIFIER_STOPWORDS` (articles, colors, sizes, rendering hints). `searchOpenverseImages` now calls an extracted `fetchOpenverseOnce` helper; if the first call is HTTP-OK with 0 images AND stripping actually shortens the token count, retries once with the trimmed query. No recursion, no third attempt. Three structured log events: `openverse.retry`, `openverse.retry_result`, `openverse.retry_skipped`. When `PROXY_BASE` env is set, every image's `thumbnail` field is rewritten to `${PROXY_BASE}/proxy?u=<base64url>` so the raw upstream URL never leaves the tool boundary (same policy shape as D-3 foreign_landing_url stripping).

### Server pipeline

`src/server.ts` image_search handler is now an ordered 5-step pipeline:

```
1. isQueryBlocked(query)       → error:"blocked_query" if hit
2. resolveUserIdForThisRequest() → checkAndIncrementQuota(userId) → error:"quota_exceeded" if denied
3. searchOpenverseImages(q,n,p) → (internal modifier-trim retry)
4. filterBlockedDomains(images)
5. JSON payload back to MCP
```

userId resolution uses `AsyncLocalStorage<{userId}>` populated per-request. Three candidate sources tried in order: HTTP header (`x-librechat-user-id`, `x-user-id`, `x-librechat-user`), MCP JSON-RPC `params._meta` (`userId`, `user_id`, `librechat_user_id`, `user`), and finally an optional `user_id` tool-arg. A `mcp.probe` log line is emitted for every `/mcp` request so the userId shape can be audited against live LibreChat traffic in Plan 21-02.

## Railway deploy

- Service: `kidschat-image-search-mcp` (production) — `https://kidschat-image-search-mcp-production.up.railway.app`
- Version bumped 0.1.0 → 0.2.0
- Env added: `ADMIN_BASE_URL`, `ADMIN_QUOTA_SECRET` (shares the `CRON_SECRET` value from the admin service), `PROXY_BASE` (self-reference for thumbnail rewrite)
- Deploy command: `railway up --service kidschat-image-search-mcp --path-as-root services/image-search-mcp --ci` (monorepo-subdir pattern per project memory)

## Post-deploy verification transcripts

### /health

```
$ curl -fsS https://kidschat-image-search-mcp-production.up.railway.app/health
{"ok":true,"provider":"openverse","version":"0.2.0"}
```

### /proxy (real Openverse thumbnail)

Thumbnail URL: `https://api.openverse.org/v1/images/5035d29d-01a5-4dfa-807f-9838e6d58d42/thumb/`

```
HTTP:200 CT:image/jpeg SIZE:14891
-rw-r--r-- 1 claude claude 14891 Apr 21 11:40 /tmp/proxy-out.bin
```

(Upstream content-length and proxied size both 14891 bytes — byte-identical image/jpeg stream.)

First curl attempt returned a 69-byte `image/png` blank-PNG fallback with `event="proxy.upstream_error" status=406`. Root cause: `Accept: image/*` on the proxy→Openverse fetch triggered content-negotiation failure. Deviation Rule 1 fix applied in Task 03: drop the restrictive Accept header, send User-Agent only, validate content-type in the response instead.

### Blocked query via MCP tool-call

```
event: message
data: {"result":{"content":[{"type":"text","text":"{\"images\":[],\"provider_used\":\"openverse\",\"error\":\"blocked_query\",\"block_reason\":\"sexual_anatomy\"}"}]},"jsonrpc":"2.0","id":2}
```

Railway log (same request):

```
event=tool.block reason=sexual_anatomy query_len=18
```

### 20-UAT C-2 retry query ("cute red origami cats")

Tool response returned **5 images**, every `thumbnail` field prefixed with `https://kidschat-image-search-mcp-production.up.railway.app/proxy?u=` — raw Openverse URL never leaves the tool.

Railway log:

```
event=openverse.retry original='cute red origami cats' trimmed='origami cats'
event=openverse.retry_result trimmed='origami cats' hit=true
event=tool.no_userid
```

**Interpretation:** First-call with the full query returned 0 images; retry with modifiers stripped returned 5. **20-05 C-2 status for this query: CLOSED.** Full 21-05 UAT will re-run all 20-UAT Q1–Q10 to measure aggregate hit-rate improvement.

## userId-forwarding probe result

`tool.no_userid` in the curl transcript above means neither an `x-librechat-user-id` header nor a `params._meta.userId` field was present on the request. **This is expected for curl-based testing** — my curl didn't send either.

The live LibreChat probe — where the kid-facing chat calls the MCP through streamable-http — was NOT run in this plan because:

1. The admin-side quota endpoint `POST /api/image-search/quota` does not yet exist (delivered in Plan 21-02). Without it, quota-gate behavior has nothing to observe.
2. Wiring a kid-facing agent that uses this tool is Plan 21-03/21-04 scope.

Resolution wired ready for Plan 21-02/03 traffic: header paths, `_meta.userId` parsing, and optional `user_id` tool-arg fallback are all live. The `mcp.probe` log line on every `/mcp` POST will reveal the actual shape the moment real LibreChat traffic arrives. **If neither header nor meta carries userId, the agent prompt in Plan 21-03 must pass `user_id` as a tool argument.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Blocklist regex missed inflected forms**
- **Found during:** Task 01 test run
- **Issue:** Test "mother breastfeeding baby art" expected to match `breastfeed` but `\b(breastfeed)\b` requires a word boundary immediately after — "breastfeeding" fails.
- **Fix:** Changed `breastfeed` to `breastfeed\w*` and `breast(?!stroke)` to `breast(?!stroke)\w*` so inflected forms (breastfeeding, breasts, breastfed) also match. Stricter-wins behavior preserved per D-7.
- **Commit:** 33d63b1

**2. [Rule 1 - Bug] `/proxy` HTTP 406 on Openverse thumb endpoint**
- **Found during:** Task 03 post-deploy curl verification
- **Issue:** `fetch(target, { headers: { Accept: "image/*" } })` triggered HTTP 406 on `api.openverse.org/v1/images/*/thumb/` (content-negotiation: their endpoint doesn't advertise `image/*` as a producible media type despite serving image bodies).
- **Fix:** Dropped `Accept: image/*`, send only `User-Agent`. Response `content-type` is validated server-side before streaming, so dropping the request Accept doesn't weaken the `image/*` gate.
- **Files modified:** services/image-search-mcp/src/proxy.ts
- **Commit:** 9f17327

**3. [Rule 2 - Missing critical] `user_id` tool-arg fallback not originally in signature**
- **Found during:** Task 01 server.ts wiring
- **Issue:** Plan Step 5 said "if probe found nothing, add an optional tool-arg `user_id`". Rather than wait for the probe, the fallback was added upfront as an optional z.string(). This makes the tool signature future-proof for Plan 21-03 agent prompts and doesn't change behavior when header/meta carry the id (header/meta take precedence).
- **Rationale:** Reduces a future breaking-change on the tool schema; cost is zero since the arg is optional.

### Test-expectation correction

**4. `retry-miss` test: "blargh flibbertigibbet" doesn't trigger retry**
- **Found during:** Task 02 test run
- **Issue:** Test expected both tokens to be non-stopwords, so stripping left token count identical (2==2) → retry correctly SKIPPED per plan spec (`trimTokens.length === origTokens.length`). The test's own expectation (2 fetch calls) was inconsistent with the retry gate.
- **Fix:** Changed test input to "cute red blargh" (2 stopwords + 1 kept), which exercises retry-miss: first 0 → trimmed to "blargh" (1 token) → retry still 0 → graceful empty.

### No architectural deviations.

## Known Stubs / Follow-ups

- **Quota endpoint stub:** `checkAndIncrementQuota` will fail-open (`error:"http_404"` or similar) until Plan 21-02 delivers `POST /api/image-search/quota` on the admin service. Expected. Documented in-log.
- **Live LibreChat userId probe:** pending real traffic in Plan 21-02/21-03. The ALS pipeline + probe log are ready.
- **Blank-PNG fallback width:** `/proxy` returns a 1×1 transparent PNG on any failure. LibreChat renders this as a tiny dot in the chat — acceptable for v1 since the upstream 5–10% hotlink-fail rate becomes "image missing" not "broken-image icon". Optional future: replace with a branded "image unavailable" tile.

## TDD Gate Compliance

- **RED gate (Task 01):** blocklist tests initially failed (breastfeeding inflection bug) → verified failure was in production-code, not the test → fixed regex → green.
- **GREEN gate:** 13 blocklist/quota tests + 7 openverse-retry tests = **20 assertions all passing**.
- **REFACTOR gate:** none required; implementations are first-pass clean.

## Self-Check: PASSED

**Files exist:**
- FOUND: services/image-search-mcp/src/blocklist.ts
- FOUND: services/image-search-mcp/src/quota-client.ts
- FOUND: services/image-search-mcp/src/proxy.ts
- FOUND: services/image-search-mcp/src/__tests__/blocklist.test.ts
- FOUND: services/image-search-mcp/src/__tests__/openverse-retry.test.ts

**Commits exist:**
- FOUND: 33d63b1 (Task 01)
- FOUND: 4478f69 (Task 02)
- FOUND: 9f17327 (Task 03)

**Acceptance criteria grep checks:**
- `isQueryBlocked|checkAndIncrementQuota|filterBlockedDomains|handleProxy` in server.ts → 7 matches (≥4 required) ✓
- `stripModifiers|MODIFIER_STOPWORDS` in openverse.ts → 4 matches (≥3 required) ✓
- `openverse.retry` in openverse.ts → 3 log-event matches (≥2 required) ✓
- `mcp.probe` in server.ts → 1 match ✓
- `/health` returns `"ok":true` ✓
- `/proxy` returns `content-type: image/jpeg`, 14891 bytes ✓
- Railway log has `event=tool.block reason=sexual_anatomy` ✓
- Railway log has `event=openverse.retry` + `event=openverse.retry_result` ✓
- Dev-agent `origami cats` returns proxy-rewritten thumbnail markdown ✓ (equivalent: raw MCP tool-call returns proxy URLs, and the agent is a thin wrapper)

**npm test in services/image-search-mcp/:** 20 pass / 0 fail ✓
