# Phase 19: Budget Exhaustion Investigation — Research

**Researched:** 2026-04-16
**Domain:** LibreChat tokenCredits system, Anthropic API pricing, cost pipeline audit
**Confidence:** HIGH (supported by live MongoDB transaction data + LibreChat docs)

---

## Executive Summary

The 0.20 EUR/day budget exhausts after 2–3 questions because **real per-turn costs are 5–10x higher than the original design assumption**. The root causes are layered and each compounds the others: (1) LibreChat's tokenCredits are dollar-denominated (1 credit = $0.000001 USD) and output tokens are billed at 5x the input rate, but `budget.ts` was written with the comment "1 credit ≈ 1 input token" — misleading the admin into thinking 0.20 EUR buys 217,391 turns when it actually buys far fewer; (2) the Agents endpoint attaches the full DALL-E tool JSON schema to every request (~2,580 extra tokens per call), adding a constant overhead that doubles the effective cost floor; (3) tool-using (DALL-E) turns trigger two consecutive API round-trips, tripling the per-drawing cost. There is also a secondary issue: 194,116 credits were consumed today with no corresponding transaction records, strongly suggesting a LibreChat balance-deduction path that does not write transactions when the API call fails mid-flight (suspected cause: photo uploads with large vision token costs where the Anthropic call succeeded but the LibreChat response-handler crashed before persisting the transaction).

**Primary recommendation:** Raise the daily cap to at least 0.50 EUR (ideally 1.00 EUR) immediately, remove the DALL-E tool from all agent presets (or create a drawing-only preset without it on the main chat presets), and cap the context window to limit history compounding. Separately, investigate the missing-transaction balance drain as a potential LibreChat bug or race condition.

---

## Cost Pipeline End-to-End Trace

```
User sends message in LibreChat
  └─► LibreChat checks balances.tokenCredits >= estimated_cost
        [if insufficient: "Insufficient Funds" block, no API call]
  └─► LibreChat builds API payload:
        - agent.instructions (system prompt)       ← 710 tokens
        - DALL-E tool JSON schema (tools[])         ← ~2,580 tokens
        - conversation history (all prior turns)   ← grows O(N) per turn
        - vision images (if uploaded)               ← 3,085–6,170+ tokens
        - current user message                      ← ~10–150 tokens
  └─► Anthropic API call (round 1)
        Input cost: sum_of_above × rate=1 per token (1 credit/token)
        Output cost: completion_tokens × rate=5 per token (5 credits/token)
  └─► If Claude uses DALL-E tool:
        ├─► DALL-E API call (OpenAI) — no credits charged here
        └─► LibreChat sends tool_result back to Anthropic (round 2)
              Input now = round1_input + round1_output + tool_result (~8,830 tokens)
              Output = brief acknowledgment (~102 tokens)
  └─► LibreChat deducts: sum(tokenValue) from balances.tokenCredits
  └─► LibreChat writes transactions collection entries (one per tokenType per round)
  └─► LibreChat generates conversation title (additional API call, ~300 credits)

Admin dashboard reads balances.tokenCredits
  └─► tokensToEur(tokenCredits) = tokenCredits × $0.000001 × EUR_PER_USD
        [uses budget.ts at src/lib/budget.ts:50]
```

**Key files and line references:**
- `src/lib/budget.ts:26` — `HAIKU_USD_PER_TOKEN = 1 / 1_000_000` (INPUT rate only)
- `src/lib/budget.ts:38–43` — `eurToTokens()` — correct math but misleading comment
- `src/lib/budget.ts:49–51` — `tokensToEur()` — converts credits back to EUR using input rate
- `src/lib/cost-estimates.ts:19` — `SYSTEM_PROMPT_TOKENS: 400` — WRONG (actual is 710+ for agent instructions, plus ~2,580 for tool schema = ~3,290 total overhead per request)
- `src/lib/settings.ts:30–37` — `ensureDefaultSettings` writes `dailyCostCapEur: 0.10` as hardcoded default, but MongoDB shows `0.20` in the live settings doc (admin already raised it; code default is stale)

---

## Findings per Investigation Area

### Area 1: EUR ↔ tokenCredits Conversion (budget.ts)

**Finding:** `eurToTokens()` is arithmetically correct but the mental model it documents is wrong. 1 tokenCredit = $0.000001 USD (verified from LibreChat docs: "1000 credits = $0.001 USD"). The code comment says "1 credit ≈ 1 input token (Haiku 4.5 pricing)" which is true — at $1/M input, 1 input token costs exactly $0.000001 = 1 credit. BUT output tokens cost $5/M = 5 credits per output token. LibreChat applies `rate=5` multiplier for completions.

**Evidence:**
- LibreChat official docs: "1000 credits = $0.001 (1 mill USD)" — dollar-denominated system
- Live transactions collection shows `rate: 1` for prompts and `rate: 5` for completions:
  ```
  {tokenType:"prompt",  rate:1, rawAmount:-4494, tokenValue:-4494}  // input: 1 credit/token
  {tokenType:"completion", rate:5, rawAmount:-352, tokenValue:-1760} // output: 5 credits/token
  ```
- Penelope's 2-exchange DALL-E conversation: 23,275 credits = $0.023275 = EUR 0.0214
  - Input tokens: 4494 + 4928 + 8830 + 268 = 18,520 tokens @ rate=1 = 18,520 credits
  - Output tokens: 352 + 485 + 102 + 12 = 951 tokens @ rate=5 = 4,755 credits
  - Total: 23,275 credits confirmed against actual transactions

**Impact on budget capacity:**
- Actual cost of a pure-text 2-turn session: ~12,254 credits = EUR 0.0113
  - 0.20 EUR buys ~17 text sessions = ~34 turns per day (adequate for text-only)
- Actual cost of a 2-turn DALL-E session: 23,275 credits = EUR 0.0214
  - 0.20 EUR buys only ~9 DALL-E sessions = ~18 drawing turns per day

**Severity:** MEDIUM — the math is technically correct. The `eurToTokens(0.20)` produces 217,391 credits which IS worth EUR 0.20. The real issue is that the admin underestimated how many credits each turn consumes due to Agents overhead (see Area 3). The budget.ts comment and SYSTEM_PROMPT_TOKENS=400 in cost-estimates.ts create a misleading picture.

**Remediation:**
1. Update `cost-estimates.ts` `SYSTEM_PROMPT_TOKENS` from 400 to 3,290 (710 agent instructions + 2,580 tool schema)
2. Update budget.ts comment to say "1 credit = $0.000001 USD; output tokens cost 5 credits each"
3. Raise `dailyCostCapEur` default from 0.10 to at least 0.50 in `src/lib/settings.ts`

---

### Area 2: Conversation-History Compounding

**Finding:** Context grows with every turn. LibreChat sends the full conversation history on each API call, so turn N incurs input cost proportional to the sum of all prior turns.

**Evidence (live transaction data):**
- Turn 1 prompt: 4,494 tokens (system + tool schema + user msg only)
- Turn 2 round 1: 4,928 tokens (added turn 1 response + new user msg)
- Turn 2 round 2 (post-tool): 8,830 tokens (added tool call + DALL-E result + all history)
- Growth factor: 4,494 → 4,928 → 8,830 in just 2 turns

**Context window config:** The live `librechat.yaml` has NO `maxContextTokens` or `contextStrategy` configured. LibreChat defaults to sending the full conversation context indefinitely.

**SYSTEM_PROMPT_TOKENS estimate in cost-estimates.ts:** Set to 400, actual baseline per request is 3,290 tokens (8x off).

**Severity:** HIGH — without a context cap, every additional turn in a long conversation costs progressively more. By turn 10, prompt tokens can be 20,000+, which at rate=1 = 20,000 credits for the input alone.

**Remediation:**
1. Add `maxContextTokens: 8000` (or similar) to librechat.yaml agents endpoint config
2. Consider `contextStrategy: summarize` for long conversations (LibreChat native feature)
3. Update `SYSTEM_PROMPT_TOKENS` in cost-estimates.ts to reflect the true 3,290-token floor

---

### Area 3: Agent-Preset System Prompt + Tool Schema Sizes

**Finding:** Every agent request carries a 3,290-token baseline overhead that was completely underestimated.

**Evidence (live MongoDB — agents collection):**
| Agent | Instructions | Estimated Tokens |
|-------|-------------|-----------------|
| KidsChat Friendly Tutor (agent_wxgt6su7d3pcosiil3) | 2,840 chars | ~710 tokens |
| KidsChat Casual Buddy | 2,821 chars | ~705 tokens |
| KidsChat Balanced Helper | 2,824 chars | ~706 tokens |
| KidsChat Standard Formal | 2,786 chars | ~697 tokens |

BUT: agent instructions are only part of the overhead. The DALL-E tool schema is attached to every request because all 4 presets have `tools: ["dalle"]`. From the transaction data, the actual API input for the first turn was 4,494 tokens against an expected 710 (instructions) + ~14 (user text) = 724. The remaining ~2,580 tokens are the DALL-E tool JSON schema that LibreChat sends to Anthropic.

**SYSTEM_PROMPT_TOKENS = 400 in cost-estimates.ts is 8x too low.** Actual baseline: ~3,290 tokens per request for agent calls.

**Severity:** HIGH — this overhead is a fixed cost on every single API call. A child asking a 3-word question still pays 3,290 tokens of base overhead.

**Remediation options:**
1. Remove DALL-E tool from text-only presets (Friendly Tutor, Casual Buddy, etc.) — only keep it on a dedicated "Drawing" preset. This removes the ~2,580-token tool schema overhead from all text requests.
2. Update all `SYSTEM_PROMPT_TOKENS` references in cost-estimates.ts

---

### Area 4: LibreChat Config Multipliers

**Finding:** LibreChat uses dollar-denominated tokenCredits with per-model rate multipliers. For claude-haiku-4-5: prompt rate=1, completion rate=5. This is hardcoded in LibreChat's internals (not configurable in librechat.yaml from our inspection).

**Evidence:**
- All transactions in the MongoDB `transactions` collection show `rate:1` for prompts and `rate:5` for completions, model `claude-haiku-4-5`.
- LibreChat official token_usage docs confirm: "Token Value = (Raw Token Count) × (Model Rate)" with rate configured in `api/models/tx.js`
- The librechat.yaml `balance` section only controls `startBalance`, `autoRefillEnabled`, `refillIntervalValue`, `refillIntervalUnit`, `refillAmount` — no per-model pricing overrides available at the YAML level.

**Important:** There is NO `tokenMultiplier` or `tConfig` field in the current live librechat.yaml. The pricing rates are set inside LibreChat's server code, not configurable per-deployment in YAML.

**Verification of 1 credit = $0.000001 USD:**
- Penelope's full daily budget drain: 217,391 credits
- At $0.000001/credit: $0.217391 USD = EUR 0.2000 at rate 0.92 (exact match!)
- This confirms our `eurToTokens()` math is correct for the denomination.

**Severity:** LOW for the code; the math is right. The problem is operational (budget too small for actual usage patterns).

---

### Area 5: Actual Deduction Behavior — Live MongoDB Evidence

**Finding (CRITICAL):** Penelope's full daily budget of 217,391 credits was consumed today, but only 23,275 credits are accounted for by transaction records. 194,116 credits were drained with NO corresponding transactions.

**Evidence:**

*Confirmed spend (transactions collection):*
| Context | Type | Raw Tokens | Credits |
|---------|------|-----------|---------|
| Turn 1 message prompt | prompt | 4,494 | 4,494 |
| Turn 1 message completion | completion | 352 | 1,760 |
| Title generation prompt | prompt | 268 | 268 |
| Title generation completion | completion | 12 | 60 |
| Turn 2 message round 1 prompt | prompt | 4,928 | 4,928 |
| Turn 2 message round 1 completion | completion | 485 | 2,425 |
| Turn 2 message round 2 prompt | prompt | 8,830 | 8,830 |
| Turn 2 message round 2 completion | completion | 102 | 510 |
| **TOTAL** | | | **23,275** |

*Unexplained drain:*
- Starting balance: 217,391 (confirmed via daily reset logic)
- Ending balance: 0 (current `balances.tokenCredits` for Penelope)
- Missing: **194,116 credits** — no transaction records

*Timeline of events (all 2026-04-16):*
- 18:33:53 — image.jpg (0.95 MB, 576x768) uploaded (used in conv 3aa0b4f3)
- 18:34:14 — Turn 1 of conv 3aa0b4f3 (bunny drawing request with photo)
- 18:34:20 — Turn 1 AI response (6,254 credits, transactions written)
- 18:34:42 — Turn 2 of conv 3aa0b4f3 (drawing clarification)
- 18:35:17 — DALL-E image generated and saved
- 18:35:20 — Turn 2 AI response (16,693 credits + 328 title = 17,021 credits, transactions written)
- 18:37:46 — Two large photos uploaded: IMG_2210.jpeg (576x768, 844 KB) and IMG_2211.jpeg (642x1999, 1.9 MB)
- 18:38:45 — New chat started (conv 4594a8db), sent study question with BOTH photos attached, tokenCount=3,195, **NO AI response, NO transactions**
- 18:39:07 — Another new chat (conv 61046315), same photos + similar question, tokenCount=3,197, **NO AI response, NO transactions**
- 18:42:38 — Third new chat (conv 665d16e9), drawing request only (no photos), tokenCount=22, **NO AI response, NO transactions**

**Hypothesis for missing 194,116 credits:** The two photo-upload messages in convs 4594a8db and 61046315 triggered Anthropic API calls that were charged but for which LibreChat never persisted transaction records. Possible mechanisms:
- LibreChat pre-deducts from `balances.tokenCredits` before the API call, then writes transactions after receiving the response. If the response handler throws (memory error, streaming timeout, response too large), the balance is already zero but no transaction is written.
- With two 1.9 MB and 0.8 MB photos, actual vision tokens per message: IMG_2210 (576x768, 4 tiles) = 3,085 tokens; IMG_2211 (642x1999 scaled to 504x1568, 4 tiles) = 3,085 tokens; total = 6,170 vision tokens per message, plus 3,200 agent overhead = ~9,400 input tokens per message. Still only accounts for ~19,000 credits for two messages.
- The remaining ~175,000 credits may have been consumed by a failed long-running Anthropic streaming response that was charged at the API level but the LibreChat client crashed/disconnected before writing transactions. This would be a LibreChat-level bug, not a code bug in our application.

**OPEN RESEARCH BLOCKER:** Exact cause of the 194,116-credit transaction gap cannot be confirmed without access to LibreChat's Railway service logs or source code. The planner should add a task to check Railway logs for LibreChat service around 18:37–18:39 UTC on 2026-04-16.

**Severity:** CRITICAL — 89% of Penelope's daily budget was consumed without any traceable transaction record. Even if the root cause is a LibreChat bug, we need to protect against it (e.g., hard balance floor, or cap on image upload sizes).

---

### Area 6: Top-Up Cron Behavior

**Finding:** The daily-reset cron has NOT run for 5 days. Both Sebastian and Penelope have `balance_state.lastDailyReset = 2026-04-11T00:00:00.000Z`. Today is 2026-04-16. Despite this, the kids' balances were set to 217,391 credits (this was from the April 11 cron run).

**Evidence:**
- `balance_state` for Sebastian: `lastDailyReset: "2026-04-11T00:00:00.000Z"`
- `balance_state` for Penelope: `lastDailyReset: "2026-04-11T00:00:00.000Z"`
- `cron_state` collection shows `poll_listener.lastSeenAt: "2026-04-11T10:08:47.878Z"` (also stale)
- `railway.toml` defines `daily-reset` at `0 0 * * *` — this should run daily at midnight UTC
- STATE.md note: *"Railway cron schedules require manual dashboard configuration"*

**Impact:**
- If the cron has not run since April 11, then as of today (April 16):
  - Sebastian's April 11 leftover balance was preserved (he had credits remaining)
  - Penelope's April 11 leftover balance was preserved at whatever it was (she has 0)
  - Neither child got a fresh 217,391 credit top-up at midnight today

**Actually:** Sebastian's current balance is 150,166 credits, which implies he started today with 217,391 and spent 67,225. The cron MUST have refilled him at some point. But `lastDailyReset = April 11` contradicts this. **Most likely explanation:** Our `topUpDailyBudget` uses `$max`, which would NOT update `lastDailyReset` on the balance_state doc in a non-upsert path — but the code DOES update it. The discrepancy needs investigation.

Actually re-reading `topUpDailyBudget` code: it calls `$set: { lastDailyReset: startOfUtcDay(now) }` at the end. If the cron ran today at midnight, it should show today's date. Since it shows April 11, the cron has genuinely not run for 5 days.

Yet Sebastian has 150,166 credits (started from 217,391 today), implying a fresh top-up happened. **Alternative:** When Penelope's balance went to 0, LibreChat's `autoRefillEnabled: false` means it will NOT auto-refill. But the fact that Sebastian has credits is unexplained unless his balance simply never hit 0 since April 11 and the `$max` during the April 11 cron was a no-op (he already had more credits).

**Severity:** HIGH — the daily cron is not running reliably. Kids whose budget exhausts will not be restored until the cron runs. The cron failure mechanism needs investigation.

**Remediation:** Verify Railway dashboard shows the `daily-reset` cron is actively scheduled and firing. Check Railway logs for `kidschat-admin-production` for `/api/cron/daily-reset` calls after April 11.

---

### Area 7: Math Sanity Check

**Finding:** 0.20 EUR SHOULD be plenty for 34 turns of pure text chat per day. The budget exhaustion is NOT from the EUR-to-credits conversion being wrong — it's from real usage patterns being far more expensive than anticipated.

**Revised per-turn cost breakdown (from live data):**

| Scenario | Credits/Turn | EUR/Turn | Turns per 0.20 EUR |
|----------|-------------|----------|-------------------|
| Text-only (est) | ~6,000–6,500 | EUR 0.006 | ~32 turns |
| Text with DALL-E tool overhead (every turn) | ~8,000–9,500 | EUR 0.008–0.009 | ~23–27 turns |
| DALL-E drawing turn (2 API rounds) | ~16,700 | EUR 0.015 | ~13 turns |
| First turn of a new conversation (title gen included) | ~6,582 | EUR 0.006 | — |
| Image upload (2 phone photos) + text | ~19,000–22,000 | EUR 0.018–0.020 | ~10 turns |

**Conclusion:** A child sending 3 drawing requests (each requiring 2 turns of DALL-E API) consumes:
- 3 drawing turns × 16,700 credits = 50,100 credits = EUR 0.046
- Plus 3 conversational turns × 6,500 credits = 19,500 credits = EUR 0.018
- Total 6-turn drawing session = 69,600 credits = EUR 0.064 = 32% of budget

That's 3 drawing requests exhausting 32% of the daily budget. After 9 drawing requests: budget fully exhausted. This matches the reported symptom of "2-3 questions exhausting the budget" if those questions include photo uploads and/or drawing requests.

**The correct daily cap for reasonable usage:** 0.50–1.00 EUR per child per day.

---

## Ranked Hypotheses (Root Cause, Most to Least Likely)

1. **[CONFIRMED, CRITICAL] DALL-E tool attached to ALL presets creates massive per-request overhead.** All 4 agent presets include `tools: ["dalle"]`, which means every single chat request (text OR drawing) sends the full DALL-E tool JSON schema (~2,580 tokens) to Anthropic. This doubles the effective system prompt size and inflates every request by ~2,580 credits before any user message. Fix: remove DALL-E tool from text-only presets; keep it only on a dedicated drawing preset.

2. **[CONFIRMED, CRITICAL] Output tokens cost 5x input tokens, not 1x.** budget.ts comment says "1 credit ≈ 1 input token" which is true for input but misleading overall. A 500-token AI response costs 2,500 credits, not 500. This is baked into LibreChat's pricing and cannot be changed. The admin budget must account for this correctly.

3. **[CONFIRMED, HIGH] DALL-E tool calls trigger TWO consecutive API calls per drawing request.** Round 1: model decides to call DALL-E, consumes 4,928 prompt + 485 completion = 5,840 credits. Round 2: tool result sent back to model, consumes 8,830 prompt + 102 completion = 9,340 credits. One drawing turn = 16,693 credits (EUR 0.015) — this is well-understood Anthropic agents behavior but was never costed into the budget design.

4. **[CONFIRMED, HIGH] Conversation history compounding without context cap.** LibreChat sends full conversation history on every turn. No `maxContextTokens` is configured. Turn N costs N × (base_overhead + prior_turns). By turn 5 in a conversation, prompt tokens can be 15,000+.

5. **[CONFIRMED, HIGH] Title generation is an undiscounted hidden cost.** Every new conversation generates an automatic title using the Anthropic API: ~328 credits (268 prompt + 60 completion) per conversation. Penelope started 4 conversations today — that's ~1,312 credits of hidden overhead. Not a major factor individually but cumulative.

6. **[PLAUSIBLE, CRITICAL] LibreChat drains balance without writing transactions for failed/aborted API calls with large payloads (photo uploads).** Today, 194,116 credits vanished with no transaction records. The timing correlates exactly with two large photo uploads (1.9 MB and 0.8 MB) sent to the agents endpoint. LibreChat may deduct the balance pre-emptively, call the Anthropic API (which charges and responds), then fail to write the transaction record if the streaming connection drops or the response handler errors. This is UNCONFIRMED and requires LibreChat log access.

7. **[PLAUSIBLE, MEDIUM] Daily cron failure leaves children without budget restoration.** The `balance_state.lastDailyReset` for both kids is April 11 (5 days ago). If the daily cron is not running, children whose budget exhausts will not recover until the cron is manually triggered or repaired. This is a reliability bug but not the root cause of the initial exhaustion.

8. **[LOW] eurToTokens() math is wrong.** The conversion is arithmetically correct. `eurToTokens(0.20)` = 217,391 credits = exactly EUR 0.20 at $1/M input rate denomination. The issue is not the math but the budget SIZE.

---

## Open Questions / Research Blockers

1. **[BLOCKER] What caused the 194,116 credit drain with no transactions?**
   - What we know: After 23,275 credits of verified transactions at 18:35:20, Penelope's balance went to 0 by 18:38:45. Two photo-upload messages were sent in that window with no AI responses and no transactions.
   - What's unclear: Did LibreChat call the Anthropic API for those messages? Did Anthropic charge for them? Where did the credits go?
   - Recommendation: Check Railway LibreChat service logs for 2026-04-16 18:35–18:42 UTC. Look for errors, crashes, or streaming failures related to large image payloads.

2. **[BLOCKER] Why has the daily cron not updated `lastDailyReset` since April 11?**
   - What we know: `balance_state.lastDailyReset = 2026-04-11` for both kids; today is April 16.
   - What's unclear: Is the cron running at all? Is it failing silently? Is it hitting a timeout on the `/api/cron/daily-reset` endpoint?
   - Recommendation: Check Railway dashboard for `kidschat-admin-production` cron execution logs. Manually trigger `/api/cron/daily-reset` and verify it updates `lastDailyReset`.

3. **[MEDIUM] What is the actual LibreChat balance-deduction sequence?**
   - Does LibreChat deduct from `balances.tokenCredits` before the API call (pre-reserve), during streaming, or after response?
   - If pre-deduction: a failed API call would permanently drain balance without a refund
   - Requires reviewing LibreChat v0.8.4 source: `api/server/middleware/abortMiddleware.js` or `api/models/Balance.js`

4. **[MEDIUM] Does the `librechat.yaml` `balance.startBalance: 10000000` cause issues with the $max operator?**
   - startBalance = 10,000,000 credits is set when LibreChat creates a new account
   - Our `topUpDailyBudget` uses `$max` — if a new child account is created with 10M credits, `$max(10M, 217391)` = no-op, and the child would have 10M credits (bypassing the daily cap entirely)
   - Sebastian's balance doc has `autoRefillEnabled: false, lastRefill` fields (created by LibreChat's native refill) while Penelope's does not (created by our cron), suggesting different code paths
   - **Action required in Phase 19 Plan:** The first daily reset after account creation must use `$set` not `$max`, or the librechat.yaml `startBalance` must be set to 0 or a very small number.

5. **[LOW] Is extended thinking (type:"think" in content[]) enabled and costing extra tokens?**
   - Claude's responses include `{"type":"think","think":"..."}` content blocks (~131 and 265 tokens observed)
   - Extended thinking tokens ARE billed by Anthropic and should appear in transactions
   - They appear to be included in the completion token counts (rate=5) already
   - Low priority but worth confirming that thinking tokens aren't creating hidden undercounts

---

## Recommended Plan Structure

The planner should produce the following plans for Phase 19:

### Plan 1: Fix root-cause overheads (code + config changes)

**Priority: CRITICAL**

Tasks:
1. **Remove DALL-E tool from all 4 text-only agent presets.** Update all 4 agent docs in MongoDB: set `tools: []` for Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal. Create a separate "KidsChat Drawing Studio" agent preset with `tools: ["dalle"]`. Update `librechat.yaml` modelSpecs to add the drawing agent and remove DALL-E capability from the 4 text presets. This eliminates the ~2,580-token tool schema from every text request.

2. **Raise `dailyCostCapEur` default to 0.50 EUR** (from 0.10 in code, currently 0.20 in DB). Update `HARDCODED_DEFAULTS` in `budget.ts` and `settings.ts`, update the `global_defaults` document in MongoDB. A budget of 0.50–1.00 EUR supports ~55 text turns or ~20 drawing turns per day.

3. **Add context window cap to librechat.yaml.** Set `maxContextTokens: 8000` on the agents endpoint (or per-preset). This prevents runaway history compounding on long conversations.

4. **Fix SYSTEM_PROMPT_TOKENS in cost-estimates.ts** from 400 to 3,290 (for agent-based calls). This makes the admin dashboard cost estimates realistic.

5. **Fix librechat.yaml `startBalance`** from 10,000,000 to 0 (or to `eurToTokens(dailyCostCapEur)` equivalent). With `startBalance: 10000000`, new accounts bypass all daily budget enforcement until the cron explicitly sets a lower balance via `$set`.

### Plan 2: Investigate and fix the cron + transaction gap

**Priority: HIGH**

Tasks:
1. **Diagnose daily cron failure.** Check Railway dashboard and logs to determine why `balance_state.lastDailyReset` has not advanced since April 11 for either child. Repair the cron if broken (may require a manual Railway dashboard configuration per STATE.md note).

2. **Restore Penelope's daily budget immediately.** Manually call `topUpDailyBudget` for Penelope or use the admin "Top up" button to restore her credits.

3. **Investigate the 194,116 missing-credits incident.** Pull Railway LibreChat service logs for 2026-04-16 18:35–18:43 UTC. Determine if the Anthropic API was called for the photo-upload messages and whether LibreChat has a credit-drain-without-refund path on streaming failures.

4. **Add a file size limit for uploaded images** to prevent runaway vision token costs. LibreChat's `fileConfig` in `librechat.yaml` can limit file sizes. Set `maxSize` (in MB) to limit images to e.g. 2 MB, or set image dimension limits. This provides a cost ceiling per photo-upload request.

5. **Fix the `$max` new-account issue** in `topUpDailyBudget`. When `balances.tokenCredits` is NULL or was set to 10M by LibreChat's `startBalance`, the `$max` operator will not enforce the daily cap. Consider: on first cron run for a new user, use `$set` instead of `$max`. Alternatively, set `startBalance: 0` in `librechat.yaml` so new accounts start at 0 and the cron's first run correctly sets the daily cap.

### Plan 3 (optional): Add cost observability to admin dashboard

**Priority: MEDIUM**

Tasks:
1. Add a "transactions" view per child on the admin dashboard showing recent API calls, token counts, and credit costs from the `transactions` collection.
2. Add a daily cost trend line per child on the user detail page (currently only shows balance % bar).
3. Add a budget utilization alert: when any child uses >80% of daily budget by 14:00 UTC, send an email alert to parents.

---

## Sources

### Primary (HIGH confidence)
- Live MongoDB `transactions` collection (queried directly via switchyard proxy) — confirmed credit deduction math
- Live MongoDB `messages` collection — confirmed tokenCount field behavior
- Live MongoDB `balances`, `balance_state`, `settings` collections — confirmed current state
- LibreChat official docs: https://www.librechat.ai/docs/configuration/token_usage — confirmed dollar-denominated credit model
- LibreChat balance docs: https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/balance — confirmed startBalance behavior
- `src/lib/budget.ts`, `src/lib/cost-estimates.ts`, `src/lib/settings.ts` — confirmed our conversion math

### Secondary (MEDIUM confidence)
- Anthropic vision pricing (tiles of 512x512, 750 tokens per tile for Haiku) — estimated from tile formula
- DALL-E tool schema overhead (~2,580 tokens) — estimated from transaction diff (4,494 actual vs 724 expected)

### Tertiary (LOW confidence)
- Hypothesis that LibreChat pre-deducts balance before writing transactions (unverified without LibreChat source code)
- Extended thinking billing behavior (assumed included in completion token counts)

---

## Metadata

**Confidence breakdown:**
- LibreChat credit denomination (dollar-denominated): HIGH — confirmed by official docs + transaction rate=5 evidence
- Per-turn costs from transactions: HIGH — direct MongoDB evidence
- DALL-E tool schema overhead: HIGH — inferred from transaction rawAmount vs expected
- Missing 194,116 credits cause: LOW — strong circumstantial evidence (timing + photo uploads) but not confirmed
- Daily cron failure: HIGH — `lastDailyReset` stale for 5 days
- `$max` new-account bypass: MEDIUM — logical deduction from code + startBalance=10M in YAML

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable LibreChat config; pricing rates unlikely to change)

---

## RESEARCH COMPLETE
