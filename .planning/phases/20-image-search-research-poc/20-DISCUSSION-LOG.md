# Phase 20: Image Search — Research + POC — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 20-image-search-research-poc
**Areas discussed:** POC scope, Provider shortlist, Done criteria, POC visibility / config environment, Safety test set authorship

---

## POC scope

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Full-stack POC | Kids-facing preset + Test Mode preset selector, both working end-to-end. Phase 21/22 become polish. Bigger Phase 20. | |
| (b) Kids-facing POC only | Preset + tool + inline render working. Test Mode design documented but not built. Phase 22 does Test Mode build. | ✓ |
| (c) Desk research only | No POC. Phase 21 is first working code. Phase 21 plans against unvalidated assumptions. | |

**User's choice:** (b)
**Notes:** Rationale — validate the hardest part (hotlink rendering, SafeSearch quality) during Phase 20 without doubling its size; keep Test Mode as its own clean build in Phase 22.

---

## Provider shortlist to stand up

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Brave + LibreChat built-in web_search | Two candidates: independent modern API + native LibreChat (verify image support). Cull Serper/CSE on desk review. | ✓ |
| (b) Brave + Serper + LibreChat built-in | Three candidates. Most thorough. Longer. | |
| (c) LibreChat built-in only | If it supports images in v0.8.4, skip external APIs. Cheapest if viable. | |
| (d) Brave only | Modern, independent, generous free tier; commit early. | |

**User's choice:** (a)
**Notes:** Tight candidate set — addresses both "best dedicated provider" (Brave) and "is there a zero-code path already" (LibreChat native).

---

## Done criteria for Phase 20

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Parent-reviewed working preset | Parent (admin) tests preset against query list; if safe and renders, Phase 20 done. Penelope doesn't see it yet. | ✓ |
| (b) Penelope UATs during Phase 20 | Real-kid signal earlier. Adds a day, surfaces UX issues earlier. | |
| (c) Automated safety test suite passes | Write test fires 20-query set through candidates, fails on blocked content. Strongest but longer. | |
| (d) Combination: parent-reviewed + decisions + lightweight automated safety check | Hybrid. | |

**User's choice:** (a)
**Notes:** Fastest; keeps kids out of beta noise; parent vets SafeSearch quality before Phase 21 ships to Penelope/Sebastian.

---

## POC visibility / config environment

| Option | Description | Selected |
|--------|-------------|----------|
| (a) New dev Gist; preset visible only when LibreChat points at dev Gist | Full isolation. Easy rollback. Swap CONFIG_PATH for UAT. Matches v2.5/v2.6 pattern. | ✓ |
| (b) Production Gist with preset labeled "BETA" | Single-environment; relies on behavioral restraint. Risky with a curious 12yo. | |
| (c) Production Gist with preset hidden from kids' preset list | Only if LibreChat supports role/user-scoped preset visibility. | |
| (d) Local LibreChat Docker for POC | Isolated but disconnects from real MongoDB/oversight. Reduces integration signal. | |

**User's choice:** (a)
**Notes:** Matches established Gist-versioning + commit-pinned CONFIG_PATH pattern. Clean rollback via Railway env var.

---

## Safety test set authorship

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Parent drafts the list now | ~20 queries: 10 normal craft / 5 common-edge / 5 adversarial. Highest fidelity to Penelope's actual patterns. | |
| (b) Claude proposes a draft from kids-search safety literature, parent reviews/edits | Fast, still parent sign-off. | ✓ |
| (c) Researcher agent in Phase 20 produces the draft based on web research | Most thorough, least personal. | |

**User's choice:** (b)
**Notes:** Fallback recommended option; parent reviews before any adversarial query is run.

---

## Claude's Discretion

- Tool mechanism choice (LibreChat native `web_search` vs MCP server vs custom OpenAPI tool) — research evaluates and recommends; parent signs off during Phase 20 review.
- Hotlink mitigation strategy — research recommends based on observed hotlink-block rate in provider samples.
- Exact system prompt for the Image Search agent — Claude drafts, parent reviews during Phase 20 testing.
- Thumbnail count per query (8 vs 10 vs 12) — Claude picks reasonable default; parent can tune.
- Markdown grid layout mechanics — whichever renders cleanly in LibreChat's message bubble.

## Deferred Ideas

- Text/web search preset — v3.0 candidate
- Parent-approval queue for searches — future milestone if needed
- Curated domain allowlist mode — fallback if blocklist insufficient
- Save/download-to-parent-shared-folder workflow — out of scope
- Automated safety test suite — considered and rejected for Phase 20 done-criterion
- Penelope UAT during Phase 20 — deferred to Phase 21
