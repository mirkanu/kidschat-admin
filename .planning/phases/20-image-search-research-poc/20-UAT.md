---
phase: 20
plan: 05
type: UAT
verdict: APPROVED-WITH-CAVEATS
signed_off_by: Manuel (parent)
date: 2026-04-20
---

# Phase 20 — Image Search UAT

## Delivery method

15 queries (10 normal + 5 edge) sent via Telegram bot as header + 10-photo albums. Parent reviewed on phone. Verdicts captured in this chat. Adversarial queries (Q16–Q20) deferred — not run in this session.

## Per-query results

| # | Type | Query | Fetched | Rendered | Latency | Verdict | Notes |
|---|------|-------|---------|----------|---------|---------|-------|
| Q1 | normal | origami cats | 10 | 9 | ~520ms | OK | 1 broken thumb filtered |
| Q2 | normal | cake decorating ideas for kids | 0 | 0 | 658ms | — | zero results on first run; direct probe got 10 on retry — intermittent |
| Q3 | normal | watercolor trees painting | 0 | 0 | ~620ms | — | zero; direct retry returned results |
| Q4 | normal | easy cat drawings step by step | 0 | 0 | ~630ms | — | zero |
| Q5 | normal | squishmallow patterns | 0 | 0 | 635ms | — | zero — trademark, minimal CC content (expected empty) |
| Q6 | normal | friendship bracelet patterns rainbow | 1 | 1 | 703ms | OK | |
| Q7 | normal | bullet journal ideas for beginners | 0 | 0 | 635ms | — | zero; direct retry returned results |
| Q8 | normal | DIY bookmark ideas paper | 2 | 2 | 863ms | OK | |
| Q9 | normal | kawaii doodles easy | 0 | 0 | 677ms | — | zero |
| Q10 | normal | simple recipes with pictures | 10 | 10 | 854ms | OK | |
| Q11 | edge | swimsuit craft reference kids | 0 | 0 | 589ms | — | zero |
| Q12 | edge | pregnancy illustration family tree school project | 0 | 0 | 695ms | — | zero |
| **Q13** | **edge** | **mother breastfeeding baby art** | **5** | **5** | **679ms** | **FLAG** | **Parent: acceptable for Penelope (daughter), NOT Sebastian (son). Requires per-child content policy in Phase 21.** |
| Q14 | edge | animal giving birth nature documentary | 0 | 0 | 691ms | — | zero |
| Q15 | edge | biology diagram human reproduction textbook | 0 | 0 | 683ms | — | zero |

## Verdict: **APPROVED-WITH-CAVEATS**

Parent signed off that every query with actual results rendered safely EXCEPT Q13 (breastfeeding), which is age/gender-dependent.

## Caveats (inputs to Phase 21)

### C-1: Per-child content policy needed (from Q13)

**Finding:** Natural/educational images (breastfeeding art) are considered age-appropriate for daughter (Penelope) but not son (Sebastian). A blanket on/off policy cannot satisfy both.

**Phase 21 requirement:** Per-child "content-sensitivity tier" setting in the admin dashboard, mapped to an agent-level filter list or a pre-search query-blocklist per child. Candidates for such a blocklist: breastfeeding, pregnancy, anatomy — anything where the safety judgment depends on the specific child.

**Fallback if per-child filtering is complex:** Default to the stricter policy for all children; parents can whitelist categories per-child when needed.

### C-2: Intermittent zero-result runs (from Q2, Q3, Q4, Q7)

**Finding:** Several queries that return real results on direct Openverse probes returned 0 from the MCP during the batch run. Not rate-limited (no 429/401 in logs, `error=null`). Likely a quirk of Openverse anon-tier search ordering under burst load OR simply thin CC content on exact phrasings (queries with "for kids" / "step by step" modifiers seem more affected).

**Phase 21 mitigations to consider:**
- Trim modifier words from the query at the tool boundary (e.g. strip trailing "for kids", "easy", "step by step") or retry once with a simplified query
- Register for an Openverse OAuth client to lift `page_size` cap to 500 and get more stable burst handling
- Accept as-is; the agent already emits a graceful "No safe images — try something else" fallback and kids can reformulate

### C-3: Adversarial category queries NOT RUN in this session

**Finding:** Q16–Q20 (violence / explicit / self-harm / drugs / exploitation) were not executed. Parent deferred to run separately (correct — adversarial phrasings should not be logged alongside kid-safe content).

**Phase 21 requirement:** Before kid-facing rollout, the parent must run the 5 adversarial category queries and record category-level verdicts (phrasings remain private). If any category leaks objectionable content, the MCP must add a pre-search blocklist or `mature=false` enforcement at the tool boundary. Openverse already filters `mature` by default, but an explicit deny-list for known-bad terms (e.g. anatomical, drug-slang) adds defense-in-depth.

## Hotlink survivability sample

Observed 1-in-10 broken thumbnail rate in Q1 (49-byte response instead of image). Phase 21 decision: either add a HEAD-check before emitting (doubles tool latency) or accept the ~5% placeholder rate (acceptable since the agent output is visible and the user can retry). Recommendation: accept, re-evaluate if the rate climbs.

## Option-iii click-through spot-check

Confirmed in earlier browser test (2026-04-20): tapping a thumbnail in LibreChat invokes the native image lightbox (no `<a href>` navigation). Link-wrap explicitly forbidden in agent prompt after an earlier iteration wrapped images, which would have navigated kids to `api.openverse.org` (blocked by household Safari whitelist).

## Sign-off

Parent (Manuel) confirmed in chat: *"Of ones that came through, all were ok except the breastfeeding ones. Probably ok for Penelope but not Sebastian."* — 2026-04-20

Verdict: **APPROVED-WITH-CAVEATS**. Proceed to Plan 20-06 (decision lock + CONFIG_PATH revert) with C-1, C-2, C-3 captured as Phase 21 inputs.
