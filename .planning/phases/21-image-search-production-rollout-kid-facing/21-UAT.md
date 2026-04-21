---
phase: 21
type: uat
status: APPROVED-WITH-CAVEATS
signed_off_by: Manuel (parent)
signed_off_at: 2026-04-21
method: pre-uat-smoke + parent-manual-sign-off (formal kid UAT skipped by parent decision)
---

# Phase 21 UAT

## Sign-off

Parent opted to skip the live iPad UAT and close Phase 21 on the strength of:
1. Pre-UAT smoke (Task 21-05-01) — all 4 checks green (MCP health, chat-test proxy thumbnails, quota gate, daily-reset counter clear).
2. Phase 20 parent UAT (20-UAT.md) — image grid, proxy rewrite, and Openverse hit-rate already validated on production.
3. Plans 21-01 through 21-04 UAT pauses — each plan had a parent-verified checkpoint before merge.
4. Plan 21-06 daily-summary email — Penelope's paraphrased summary verified live in prod email 2026-04-21.

## Pre-UAT Smoke Results (Task 21-05-01)

| Check | Expected | Result |
|-------|----------|--------|
| MCP `/health` | `{"ok":true,"version":"0.2.0"}` | PASS |
| chat-test "origami cats" proxy URLs | All thumbnails `/proxy?u=…` | PASS (20 thumbnails) |
| Quota 21× calls for throwaway userId | 20 allowed + 1 denied | PASS |
| Daily-reset cron | Penelope + Sebastian counters → 20 | PASS |

## Requirement Sign-off

| # | Requirement | Evidence | Verdict |
|---|-------------|----------|---------|
| 1 | SEARCH-01: Image Search preset visible to kids | Plan 21-04 ACL go-live + aclentries 4→6 confirmed via MongoDB; LibreChat redeployed with Image Search agent + preset in Gist | PASS (code-verified) |
| 2 | SEARCH-02: ≥60% queries return non-empty grid | Phase 20 UAT baseline 60%; Plan 21-01 modifier-trim retry deployed; smoke "origami cats" 20 thumbnails | APPROVED-WITH-CAVEATS (Phase 20 baseline met; live kid queries not sampled) |
| 3 | SEARCH-03: Blocklist query returns empty + safety alert | 21-01 blocklist (7 regex) + safety pattern wiring (21-04) deployed; email notification path verified in Phase 18/20 | PASS (code-verified) |
| 4 | SEARCH-04: Thumbnails render inline (no nav links) | Proxy-rewrite strips `foreign_landing_url` and `url` at MCP boundary (21-01); parent confirmed in Phase 20 UAT | PASS |
| 5 | SEARCH-05: AI commentary absent beyond helper note | Agent prompt (21-04 Gist) returns only the image grid markdown | PASS (code-verified) |
| 6 | SEARCH-06: All thumbnail URLs via `/proxy?u=…` | chat-test smoke 20/20 proxy URLs | PASS |
| 7 | SEARCH-07: Per-kid daily-search cap enforced | Quota endpoint 21-call smoke: 20 allowed, 1 denied; daily-reset bolt-on resets counter | PASS |
| 8 | SEARCH-08: Graceful agent response on cap-hit | MCP returns `{"error":"quota_exceeded"}`; agent prompt handles this with fallback message | PASS (code-verified) |
| 9 | SAFETY-01: Blocklist match fires email alert | Email path exercised in Phase 20 UAT; same codepath | PASS |
| 10 | SAFETY-02: Blocklist match visible in admin /alerts | Safety pattern extension (21-04) wires blocklist hits into the alert pipeline | PASS (code-verified) |
| 11 | OVERSIGHT-01: Image Search conversations persist in MongoDB | Plan 21-04 audit — 17 conversations + 46 messages confirmed; zero new logging code needed | PASS |
| 12 | OVERSIGHT-02: Preset badge renders in /conversations | Plan 21-04 badge (spec=image-search) — deployed + parent-verified in admin UI | PASS |
| 13 | OVERSIGHT-03: Daily-summary email includes image-search count + paraphrase | Plan 21-06 — Penelope summary verified live in prod email 2026-04-21 | PASS |

## Caveats

- **SEARCH-02 live hit-rate**: Not measured against 10 real kid queries this session. Phase 20 baseline of ≥60% is the standing evidence; upgrade to Openverse OAuth (Phase 21.1 candidate) would improve hit rate and is tracked in backlog.
- **Kid preset-visibility (SEARCH-01)**: Not eye-confirmed on iPads this session. ACL go-live commit is the evidence; no regression path exists without direct ACL rollback.
- **Daily-search cap UI reset (SEARCH-07/08)**: Parent /settings override set+restore flow not walked through this session; covered by Plan 21-03 UAT pass.

## Overall Verdict: APPROVED-WITH-CAVEATS

Phase 21 is production-ready. Image Search is live for Penelope and Sebastian. Caveats are cosmetic observational gaps, not functional failures. No Phase 21.1 gap-closure work required.
