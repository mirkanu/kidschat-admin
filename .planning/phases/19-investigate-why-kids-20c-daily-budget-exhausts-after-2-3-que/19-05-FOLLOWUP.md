# 19-05 Follow-up: #12209 Mitigation

**Date:** 2026-04-17
**Trigger:** During Plan 19-04 UAT review, user found [LibreChat Discussion #12209 — Unexpected High Token Usage with LibreChat Agent](https://github.com/danny-avila/LibreChat/discussions/12209) which describes ~200,000 input tokens per message registered as "Cache Write (5m)" — strikingly close to Penelope's unexplained 194,116-credit drain.

## Root-cause hypothesis (updated)

Per #12209, LibreChat enables Anthropic prompt caching by default; cache breakpoints shift with each turn so the system **rewrites the full conversation prefix** every turn instead of reading from cache. Reprocessed history grows without bound, producing huge per-message input-token bills.

This re-opens Plan 19-04's "Classification D (Unknown)" verdict. The drain is now best explained as:
- **Prompt-cache misconfiguration (#12209 pattern)** — very plausible match to the 194k magnitude
- Possibly compounded by the 1.9 MB photo upload creating a particularly expensive cache-write payload
- Transaction records may have failed to write for the cache-write path in the rc1 build (unconfirmed)

## Mitigations deployed

New Gist revision `4392903e` live, CONFIG_PATH updated on LibreChat service, redeployed `2026-04-16T23:33:55Z` (SUCCESS). Three changes:

1. **`endpoints.agents.maxContextTokens`: 8000 → 32000** — the maintainer in #12209 explicitly advised against extreme limits like 4096 and recommended 32k–64k. We were at 8000 after Plan 19-01, which is too low.
2. **`endpoints.anthropic.promptCache: false`** — best-effort disable of Anthropic's built-in prompt caching. Per LibreChat docs (#12209 and [modelSpecs docs](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/model_specs)), this is the documented flag for direct `anthropic` endpoint use. Agents route through `endpoint: "agents"` and LibreChat docs say agent endpoint "defers to the agent's configuration" — it's unclear whether this top-level flag cascades. Treating as non-breaking best-effort until verified.
3. **Version bump 1.3.7 → 1.3.8** — removes the config-outdated warning at startup.

## What we did NOT do (and why)

- **Per-agent `promptCache: false` in MongoDB agents collection** — inspected schema; no `promptCache` or `model_parameters` field exists on any agent doc. LibreChat's agent code path may not expose a per-agent cache toggle. Skipped to avoid adding a field LibreChat ignores.
- **Lowering `fileConfig.serverFileSizeLimit` below 2 MB** — considered, but the 19-04 forensic noted IMG_2211 was 1.9 MB (already just under the cap). Lowering to 1 MB would reject the specific incident-class images but may frustrate legitimate photo-based tutoring questions. Deferred pending observability.

## Observability added (passive)

Plan 19-03's `cron_state.daily_reset.lastRunAt` write is live. No new observability added in 19-05 — the next time a drain pattern occurs, the existing `transactions` collection snapshot + Railway logs will be the evidence base. The guardrails should prevent a repeat.

## Verification pending (user UAT)

1. **Penelope sends a multi-turn conversation** (5+ messages) on Friendly Tutor with no photos → confirm per-turn token cost stays proportional (not jumping to 200k+ on any turn).
2. **Upload a sub-2 MB photo + send a question** → confirm per-turn cost is ~5–10k credits, not 194k+.
3. **Check `transactions` collection** after each turn — confirm the `prompt` tokenType amounts match the `tokenCount` on the corresponding message doc (no silent mismatch indicating cache-write drain).

## Key commits / artifacts

- Gist revision before: `7049fc83`
- Gist revision after: `4392903e406fb1958d9389a6cbeaa424db7945bc`
- CONFIG_PATH: `https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/4392903e406fb1958d9389a6cbeaa424db7945bc/librechat.yaml`
- LibreChat deployment: `fa17fd68-870e-468f-95c1-d66ba20f97a1` (SUCCESS, 2026-04-16T23:33:55Z UTC)

## Upstream issue

Draft prepared in `19-05-UPSTREAM-ISSUE.md` — to be posted as a comment on [#12209](https://github.com/danny-avila/LibreChat/discussions/12209). User action required to post (we don't have a GitHub account tied to this project).
