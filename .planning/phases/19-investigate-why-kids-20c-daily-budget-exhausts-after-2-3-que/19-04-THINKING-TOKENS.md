# 19-04 Extended Thinking Tokens — Open Question #5 Resolution

**Date:** 2026-04-16  
**Conclusion:** Extended thinking IS counted in completion token billing

---

## Methodology

Three sources of evidence were used to determine whether LibreChat bills extended thinking tokens:

1. **MongoDB content[] inspection:** Pulled all messages containing `{"type":"think"}` content blocks, extracted character counts for thinking vs. non-thinking content.

2. **Transaction cross-reference:** For each thinking-containing message, retrieved the corresponding completion transaction records (`tokenType: "completion"`, `context: "message"`) and compared `rawAmount` (token count) to the character estimates.

3. **Mathematical consistency check:** Used the approximation `chars / 4 ≈ tokens` to verify whether transaction token counts are consistent WITH thinking tokens included (vs. WITHOUT).

Data source: Live MongoDB transactions and messages collections queried via the external switchyard proxy (switchyard.proxy.rlwy.net:57501) using admin credentials.

---

## Evidence

Only 2 messages with `think` content blocks exist in the database (both from Penelope's conv 3aa0b4f3, the successful DALL-E session on 2026-04-16). This is the only conversation in the system that generated AI responses before today's investigation.

### Pair 1: Turn 1 AI Response (Round 1)

**Message:** `da05ae76-9a21-4c4d-98a7-3db362f53ff6`  
**Transaction:** `_id: 69e12bacd306dd74a007ab35` (completion, rawAmount=-352, tokenValue=-1760, rate=5)

| Content block | Type | Chars | Estimated tokens (chars/4) |
|---------------|------|-------|---------------------------|
| Block 1 | think | 522 | ~130 |
| Block 2 | text | 705 | ~176 |
| **Total** | | **1,227** | **~307** |

- Transaction `rawAmount`: **352** tokens
- Character-estimate: ~307 tokens
- Ratio: 352/307 = **1.15x** (expected; BPE tokenization has ~15% overhead vs raw chars/4)

**Interpretation:** If thinking tokens were NOT counted, the rawAmount would be ~176 (text only) or at most ~306 (all content, wrong model). The actual rawAmount of 352 is consistent WITH thinking included. The 14.5% overhead over the char estimate is normal BPE tokenizer behavior (subword units, special tokens, whitespace treatment).

### Pair 2: Turn 2 AI Response (Round 1 + Round 2 combined)

**Message:** `e6f788b6-7b26-4816-8054-c71bbf9a94bb`  
**Transactions:**
- Round 1 completion: `_id: 69e12be8d306dd74a007ab83` (rawAmount=-485, tokenValue=-2425)
- Round 2 completion: `_id: 69e12be8d306dd74a007ab85` (rawAmount=-102, tokenValue=-510)
- Combined: rawAmount = 485 + 102 = **587** tokens
- Confirmed: `messages.tokenCount` for this message = **587** (exact match)

| Content block | Type | Chars | Estimated tokens |
|---------------|------|-------|-----------------|
| Block 1 | think | 1,058 | ~265 |
| Block 2 | text | 114 | ~29 |
| Block 3 | tool_call (dalle) | ~300 (est) | ~75 |
| Block 4 | text | 370 | ~93 |
| **Total (text+think)** | | **1,542** | **~385** |

- Transaction combined rawAmount: **587** tokens (485 + 102)
- Character-estimate (text+think only): ~385 tokens
- Including tool_call JSON overhead (estimated ~300 chars = ~75 tokens): ~460 tokens
- Ratio: 587/460 = **1.28x** (higher overhead for structured content like JSON tool calls)

**Interpretation:** The combined 587 token count is consistent with thinking tokens included. If thinking (1,058 chars = ~265 tokens) were excluded, the text+tool_call total would be ~197 tokens — far below the 587 measured. Thinking cannot be excluded.

### Pair 3: Confirmation via TokenValue Cross-Check

For Pair 1: rawAmount=-352 tokens × rate=5 = tokenValue=-1760 credits. Confirmed against transaction record.

For Pair 2 Round 1: rawAmount=-485 × rate=5 = -2425. Confirmed.  
For Pair 2 Round 2: rawAmount=-102 × rate=5 = -510. Confirmed.

The billing formula `tokenValue = rawAmount × rate` is consistent across all records. LibreChat uses the completion token count returned by the Anthropic API's `usage.output_tokens` field. Anthropic's API documentation confirms that `output_tokens` INCLUDES thinking tokens in the total output token count when extended thinking is enabled. LibreChat passes this value directly to the transaction record.

---

## Conclusion

**Extended thinking IS counted in completion token billing.**

LibreChat v0.8.5-rc1 uses Anthropic's `usage.output_tokens` value as the rawAmount for completion transactions. Anthropic counts thinking tokens in `output_tokens` when extended thinking is active. Therefore, thinking tokens are billed at rate=5 (5 credits per token) along with the regular text response.

This behavior is confirmed by the mathematical consistency: the measured token counts (352 and 587) are consistent with thinking content included, and inconsistent with thinking excluded.

---

## Impact

**Thinking tokens ARE counted — Close Open Question #5.**

Since thinking tokens are included in the standard completion token count (rate=5), there is NO hidden undercount. The Anthropic API charges for thinking tokens as part of `output_tokens`, and LibreChat faithfully passes this through to the transaction record.

**Quantified impact on today's session:**
- Turn 1 thinking: ~130 tokens × rate=5 = ~650 credits (out of 1,760 completion credits = 37%)
- Turn 2 Round 1 thinking: ~265 tokens × rate=5 = ~1,325 credits (out of 2,425 = 55%)
- Turn 2 Round 2 thinking: ~0 tokens (round 2 is the brief acknowledgment after DALL-E, no thinking)

Thinking tokens account for approximately 37–55% of the completion credit cost on turns where Claude uses extended thinking. This is already factored into the actual transaction amounts — it is NOT an additional hidden cost. The budget analysis in Research Area 1 and 7 is correct as stated.

**Recommendation:** No action required. Open Question #5 from 19-RESEARCH.md is closed.
