---
phase: 20
slug: image-search-research-poc
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for a **research + POC** phase. Most validation in Phase 20 is manual by design — this is research + a parent-reviewed staging deployment, not feature code that ships to kids.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing test suite) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --listTests` (sanity check — Phase 20 adds no unit tests) |
| **Full suite command** | `npm test` (65 existing tests must still pass) |
| **Estimated runtime** | ~30 seconds |

Phase 20 produces infrastructure (dev Gist, MongoDB agent doc, MCP server deployment) + research decisions. No new application code → no new unit tests. Regression sampling only.

---

## Sampling Rate

- **After every infrastructure task:** Manual connectivity smoke check (e.g., `curl` to Brave MCP service, LibreChat redeploy health)
- **After every commit:** `npm test` must stay green (no regressions)
- **Before moving to UAT task (05):** Full test suite green + all infrastructure tasks' automated checks green
- **Max feedback latency:** ~30 seconds (test suite) + ~60 seconds (Railway redeploy)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | D-03 (research) | T-20-A — unsafe results pass to kid | Brave API key provisioned, scoped, stored in Railway env | infra | `railway variables get --service kidschat-brave-mcp BRAVE_API_KEY >/dev/null` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | D-03 | — | Brave MCP service responds with 200 on `/health` | infra | `curl -fs $(railway status --service kidschat-brave-mcp --json \| jq -r .url)/health` | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 1 | D-03 | T-20-B — leaked API key | `BRAVE_API_KEY` not in any committed file | grep | `! grep -rE 'BSA[A-Za-z0-9]{20,}' .planning/ src/ librechat.yaml 2>/dev/null` | ✅ | ⬜ pending |
| 20-02-01 | 02 | 2 | D-08 (dev Gist) | T-20-C — prod Gist clobber | Production Gist SHA baseline captured (`$PROD_GIST_SHA_PRE`, `$PROD_CONFIG_PATH_PRE`) before any edits | file | `test -n "$PROD_GIST_SHA_PRE" && test -n "$PROD_CONFIG_PATH_PRE"` | ❌ W0 | ⬜ pending |
| 20-02-02 | 02 | 2 | D-08, D-09 | T-20-C | Dev Gist created with SafeSearch=strict, declares `mcpServers.brave-search` + Image Search preset in `modelSpecs.list`; production Gist unchanged | grep+gist | `gh gist view $DEV_GIST_ID --raw \| grep -E 'safesearch:.*strict' && gh gist view $DEV_GIST_ID --raw \| grep -E 'brave-search\|image-search' && test "$(gh gist view $PROD_GIST_ID --raw \| shasum)" = "$PROD_GIST_SHA_PRE"` | ❌ W0 | ⬜ pending |
| 20-03-01 | 03 | 2 | D-11 | T-20-D — commentary leak | Agent system prompt drafted in `artifacts/image-search-agent-prompt.md` forbidding commentary / requiring markdown image grid only / prompt-injection resistant | grep | `test -f .planning/phases/20-image-search-research-poc/artifacts/image-search-agent-prompt.md && grep -iE 'no commentary\|image grid only' .planning/phases/20-image-search-research-poc/artifacts/image-search-agent-prompt.md` | ❌ W0 | ⬜ pending |
| 20-03-02 | 03 | 2 | D-09 | — | MongoDB `agents` doc seeded via EJSON with `tools: ["brave_image_search"]` + drafted system prompt embedded verbatim | mongo | `mongosh $MONGO_URI --eval 'JSON.stringify(db.agents.findOne({agent_id:/^agent_kidschat_imagesearch/}).tools)'` returns array containing `brave_image_search` | ❌ W0 | ⬜ pending |
| 20-04-01 | 04 | 3 | D-09 | — | Railway LibreChat `CONFIG_PATH` env points at dev Gist commit SHA | railway | `railway variables get --service librechat CONFIG_PATH \| grep $DEV_GIST_SHA` | ❌ W0 | ⬜ pending |
| 20-04-02 | 04 | 3 | D-09 | — | LibreChat redeploy succeeded; `/health` returns 200 | curl | `curl -fs $LIBRECHAT_URL/health` | ❌ W0 | ⬜ pending |
| 20-04-03 | 04 | 3 | D-03 (OQ1 — MCP wire compat) | — | LibreChat agent can invoke `brave_image_search` — smoke query from MCP inspector or parent browser test | manual | (see Manual-Only Verifications) | N/A | ⬜ pending |
| 20-05-01 | 05 | 4 | D-11, D-12 | T-20-A | Parent pre-UAT review checkpoint — parent reviews/edits the 20-query safety set from RESEARCH.md §"Safety Test Query Set Draft" before any adversarial query runs; signed off in `20-UAT.md` preamble | manual | (see Manual-Only Verifications) | N/A | ⬜ pending |
| 20-05-02 | 05 | 4 | D-05, D-11 | T-20-A | Parent UAT run: 10/10 normal queries return safe image grid; 5/5 edge queries tested with acceptable results; 5/5 adversarial categories blocked or return safe content; hotlink sample recorded | manual | (see Manual-Only Verifications) | N/A | ⬜ pending |
| 20-06-01 | 06 | 5 | D-01..D-14 | — | `20-DECISIONS.md` written with 4 locked decisions (tool mechanism, provider, hotlink, Test Mode architecture) — each with rationale and rejected alternatives | file | `test -f .planning/phases/20-image-search-research-poc/20-DECISIONS.md && grep -E '^## ' .planning/phases/20-image-search-research-poc/20-DECISIONS.md \| wc -l` ≥ 4 | ❌ W0 | ⬜ pending |
| 20-06-02 | 06 | 5 | D-10 | T-20-C | `CONFIG_PATH` reverted to production Gist SHA; dev Gist preserved for Phase 21 reuse | railway | `railway variables get --service librechat CONFIG_PATH \| grep $PROD_GIST_SHA_POST` | ❌ W0 | ⬜ pending |
| 20-06-03 | 06 | 5 | — | — | Regression: `npm test` still green (no new tests added; existing 65 must pass) | test | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Brave Search API account signed up + API key issued (parent action, blocking)
- [ ] `GITHUB_GIST_TOKEN` validity re-verified (Phase 15 flagged as stale); re-mint if expired
- [ ] `railway`, `gh`, `jq`, `mongosh`, `curl` available in shell (verify with `which` smoke)
- [ ] Safety test query set (D-11) drafted in RESEARCH.md + reviewed/edited by parent before Task 20-05-01 runs
- [ ] `$DEV_GIST_SHA` and `$PROD_GIST_SHA_PRE` env vars captured before Task 20-02-* starts so revert check (Task 20-06-02) has a known baseline

*Phase 20 adds no new test file infrastructure — existing jest suite is sampling-only for regression.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MCP wire protocol compat between LibreChat v0.8.4 and Brave MCP server | D-03 (Open Question 1 from RESEARCH.md) | Ad-hoc first-time integration; fail-fast smoke rather than a permanent automated check | From LibreChat agent endpoint, send: "search for origami cats". Observe LibreChat logs for `mcp.tool.call: brave_image_search`. If error, document and pivot tool mechanism. |
| Parent UAT of safety test query set (D-11) | D-05, D-06, D-11 | Subjective judgement on image appropriateness — automated pattern-match insufficient for images | Parent logged in as Sebastian (not Penelope per D-06). Run all 20 queries from D-11 set. Record in `20-UAT.md`: for each query, screenshot + verdict (safe/edge/blocked/inappropriate). Adversarial queries parent-only. |
| Image grid renders as inline `<img>`, not `<a><img></a>` | D-04, option iii | DOM inspection per LibreChat message bubble — no stable selector for assert | From a completed query in UAT, inspect chat bubble DOM in browser devtools. Confirm `<img>` present, no wrapping `<a href>`. If wrapped, pivot to system-prompt-forced plain URL or post-render strip. |
| Image thumbnails not hotlink-blocked | D-03 (hotlink research verified Brave CDN but per-query sampling still required) | Sample-based — 20+ image URLs per query × 20 queries = 400+ images, binary pass/fail per image | During UAT, note any broken-image icons in any query result grid. If >5% broken rate, escalate hotlink mitigation to Phase 21 requirement. |
| Test Mode architecture decision (D-13/14) finalized with concrete rationale | D-13, D-14 | Architectural decision — reasoning written, not test-executable | `20-DECISIONS.md` must include "Test Mode Architecture" section naming Option A vs B choice, rejected alternative, and 2+ specific evidence points from research (e.g., LibreChat auth mechanism complexity, streaming-format-translation effort). |

---

## Validation Sign-Off

- [ ] All infrastructure tasks have automated verification commands (Tasks 01-04, 06)
- [ ] Manual verifications have explicit instructions + output format (UAT screenshot protocol, DOM inspection steps)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (UAT Task 05 is the only manual-only gap, flanked by automated tasks on both sides)
- [ ] Wave 0 blockers surfaced: Brave key, Gist token, query set review
- [ ] No watch-mode flags anywhere
- [ ] Feedback latency < 90s (test + redeploy)
- [ ] `nyquist_compliant: true` set in frontmatter after all sign-offs complete

**Approval:** pending
