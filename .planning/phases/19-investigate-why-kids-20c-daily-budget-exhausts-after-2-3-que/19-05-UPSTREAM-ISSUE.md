# Upstream comment draft for LibreChat Discussion #12209

**Target:** https://github.com/danny-avila/LibreChat/discussions/12209
**Status:** Draft — user to review and post

---

## Possible data point: 194k-credit drain with NO transaction records (v0.8.5-rc1 agent endpoint)

We may be seeing a variant of this bug in production. Running **LibreChat v0.8.5-rc1** (Railway-hosted Docker), single child user, `endpoint: "agents"` with Claude Haiku 4.5.

**What happened**

- Daily cap: 217,391 tokenCredits (0.20 EUR)
- One successful DALL-E session with 8 logged `transactions`, total spend 23,275 credits
- Expected remaining: 194,116 credits
- User then uploaded two iPhone JPEGs (844 KB + 1.9 MB) via the attachment UI
- **In a 58-second window immediately after the upload**, the balance dropped from 194,116 → 0
- **Zero transaction records exist for that 58-second window** in the `transactions` collection
- Zero Railway log entries at INFO level for that window (LibreChat only logs errors at INFO; successful completions aren't logged)
- The subsequent 3 conversation attempts hit the pre-flight `ResumableAgentController` balance gate and were blocked with `{"type":"token_balance","balance":0,"tokenCost":3195,"promptTokens":3195}` — so those 3 never touched Anthropic

**Why this looks like your cache-write pattern**

The 194k ≈ 200k ratio reported in this discussion is striking. Our agents run through `endpoint: "agents"` (not direct `endpoint: "anthropic"`), and there's no per-agent `promptCache` field in the `agents` MongoDB collection schema we can find. So even if a user tries `promptCache: false` at the modelSpec level, docs say the agent endpoint "defers to the agent's configuration" — suggesting the cache flag is ignored on the agent code path.

**Differences from the main discussion**

- In our case **no** `cache_write` / `cache_creation` transactions were written at all — only the expected `prompt` and `completion` types from the earlier DALL-E session. The drain is invisible in MongoDB, not just large.
- The trigger correlates with a **large image upload**, not a pure-text multi-turn conversation. Possible the image payload interacts badly with the cache-write path in the rc1 build.

**Our mitigations** (in case useful for others hitting this)

- Raised `endpoints.agents.maxContextTokens` from 8000 to 32000 per your maintainer advice in this thread
- Added `endpoints.anthropic.promptCache: false` as best-effort (uncertain it applies to agent routes)
- Deployed `fileConfig.serverFileSizeLimit: 2` MB as a defensive cap

**Questions**

1. Is there a way to disable Anthropic prompt caching **on the agent code path** (not just direct `endpoint: "anthropic"`)? If yes, could the docs be updated?
2. Could an image attachment specifically trigger a cache-write without a corresponding transaction insert in v0.8.5-rc1?
3. Would `DEBUG=*` at runtime surface the Anthropic request/response showing the cache-write input token count so we can confirm this is your bug?

Happy to provide:
- Full MongoDB transactions + messages + balances snapshots for the incident window (sanitized)
- Railway deployment logs for that window
- librechat.yaml (current + previous revisions via the Gist history)

If this matches a known root cause, please point us at the fix — we can upgrade from rc1.
