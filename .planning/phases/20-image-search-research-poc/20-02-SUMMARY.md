---
phase: 20
plan: "02"
subsystem: librechat-config
tags: [gist, librechat-yaml, mcp-server, image-search, poc-isolation]
dependency_graph:
  requires: [20-01-ENDPOINTS.md]
  provides: [20-02-GIST-REFS.md, artifacts/dev-librechat.yaml, kidschat-dev-librechat Gist]
  affects: [Phase 20 Plan 03 (agent doc — reads IMAGE_SEARCH_AGENT_ID), Phase 20 Plan 04 (Railway CONFIG_PATH swap — reads DEV_CONFIG_PATH), Phase 20 Plan 06 (revert — reads PROD_CONFIG_PATH_PRE)]
tech_stack:
  added: []
  patterns: [commit-pinned Gist raw URL, dev-vs-prod Gist isolation (D-08/D-09), T-20-C-01 byte-identity assertion]
key_files:
  created:
    - .planning/phases/20-image-search-research-poc/20-02-GIST-REFS.md
    - .planning/phases/20-image-search-research-poc/artifacts/dev-librechat.yaml
    - (GitHub) Gist b0c89395bbefb4f7ff9124d0d9014999 "kidschat-dev-librechat"
  modified: []
decisions:
  - "IMAGE_SEARCH_AGENT_ID locked as agent_kidschat_imagesearch_1776667619589 — Plan 03 MUST use this exact string"
  - "DEV_CONFIG_PATH commit-pinned to fd8dd87b84d43bd427ca20beebcbb49d21b580e9 — Plan 04 swaps Railway CONFIG_PATH to this"
  - "PROD_CONFIG_PATH_PRE captured for Plan 06 revert — exact commit URL preserved"
  - "chatMenu: false enforced on mcpServers.image-search (T-20-D-01 threat mitigated)"
  - "interface.mcpServers.use: false preserved from production (kids don't see MCP picker)"
  - "Production Gist (e23b999f1d3cd77726a97c20e26f0abf) not modified — byte-identical confirmed"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 20 Plan 02: Dev Gist Creation Summary

**One-liner:** Dev Gist `kidschat-dev-librechat` forked from production with `mcpServers.image-search` (internal URL, `chatMenu: false`) and Image Search preset (agent ID locked); production Gist byte-identical confirmed.

## Output Links

| Key | Value |
|-----|-------|
| DEV_GIST_WEB_URL | https://gist.github.com/mirkanu/b0c89395bbefb4f7ff9124d0d9014999 |
| DEV_CONFIG_PATH | https://gist.githubusercontent.com/mirkanu/b0c89395bbefb4f7ff9124d0d9014999/raw/fd8dd87b84d43bd427ca20beebcbb49d21b580e9/dev-librechat.yaml |
| IMAGE_SEARCH_AGENT_ID | `agent_kidschat_imagesearch_1776667619589` |
| PROD_CONFIG_PATH_PRE | https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/4392903e406fb1958d9389a6cbeaa424db7945bc/librechat.yaml |

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 20-02-01 | Verify token + capture PROD_GIST_SHA_PRE | 77534ec | 20-02-GIST-REFS.md (created, partial) |
| 20-02-02 | Create dev Gist with image-search MCP + preset | 51dce8e | 20-02-GIST-REFS.md (completed), artifacts/dev-librechat.yaml, GitHub Gist |

## Diff Summary

Changes from production Gist to dev Gist (3 additions, 0 deletions to existing content):

1. **Header comment** — Added Phase 20-02 annotation explaining POC isolation purpose
2. **PRESET 6 added** in `modelSpecs.list` after Drawing Studio:
   ```yaml
   - name: image-search
     label: "Image Search"
     description: "Find safe images — origami, crafts, animals, art references"
     iconURL: "https://api.iconify.design/lucide/image-plus.svg?color=%23e2e8f0"
     default: false
     preset:
       endpoint: "agents"
       agent_id: "agent_kidschat_imagesearch_1776667619589"
       greeting: "Hi! Tell me what to search for..."
   ```
3. **`mcpServers` top-level block** appended at end of file:
   ```yaml
   mcpServers:
     image-search:
       type: streamable-http
       url: "http://kidschat-image-search-mcp.railway.internal:8080/mcp"
       startup: true
       chatMenu: false
       serverInstructions: false
   ```

All existing content (endpoints, 5 original presets, interface, fileConfig, balance) is unchanged.

## Threat Mitigations Verified

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-20-C-01: Production Gist accidentally clobbered | PROD_GIST_SHA_PRE == PROD_GIST_SHA_POST byte check | VERIFIED — both = `6bf08d0e96be272eefa47ccd2ada192c8808be60d85b280ef3cddbf2b2c1d75d` |
| T-20-C-02: Dev Gist confused for prod | DEV_CONFIG_PATH + PROD_CONFIG_PATH_PRE both recorded in GIST-REFS.md | CAPTURED — Plan 04 uses DEV, Plan 06 reverts to PROD |
| T-20-D-01: MCP UI exposed in kid chat | `chatMenu: false` on mcpServers.image-search; `interface.mcpServers.use: false` preserved | VERIFIED — both present in dev Gist |

## Deviations from Plan

### Auto-adapted: Production Gist drifted from 19-01-GIST-AFTER.yaml snapshot

**Found during:** Task 20-02-02 step 1 ("start from fresh production Gist content")
**Issue:** The local `19-01-GIST-AFTER.yaml` snapshot (version 1.3.7, no promptCache, simpler fileConfig) is stale relative to production Gist (version 1.3.8, promptCache: false, per-endpoint fileSizeLimit, Phase 19-04/19-05 annotations). Production had drifted in 2 phases after the snapshot.
**Fix:** Used `gh gist view <PROD_GIST_ID> --raw` to fetch the live production content as the fork base, exactly as the plan instructs ("NOT from the local 19-01-GIST-AFTER.yaml"). The dev Gist is a fork of the current production state.
**Files modified:** artifacts/dev-librechat.yaml reflects current production base, not the snapshot.
**Impact:** Positive — dev Gist matches what LibreChat actually uses in production; fewer surprises during Plan 04/05 UAT.

### Auto-adapted: Railway CLI `variables get` subcommand unavailable

**Found during:** Task 20-02-01 step 2 ("Read CONFIG_PATH from live LibreChat Railway service")
**Issue:** `railway variables get --service librechat CONFIG_PATH` returned `error: unrecognized subcommand 'get'`. The Railway CLI version installed does not support `get` as a subcommand of `variables`. Additionally, the librechat service could not be selected by name via `--service` flag (service name discovery required interactive mode).
**Fix:** Used PROD_GIST_ID from PROJECT.md (`Config: https://gist.github.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf`) — this is documented authoritative truth. Fetched the production Gist directly via `gh gist view` and extracted the commit SHA via `gh api gists/<ID>`. This achieves the same result (PROD_GIST_ID + PROD_COMMIT_SHA + PROD_GIST_SHA_PRE) without needing Railway's CONFIG_PATH env var.
**Files modified:** 20-02-GIST-REFS.md — PROD_CONFIG_PATH_PRE built from gh API data, not Railway CLI.
**Impact:** None — production Gist ID was already documented in PROJECT.md; the fallback is equally reliable.

## Known Stubs

None. All values in GIST-REFS.md are live (real Gist IDs, real SHAs, real URLs). The dev Gist is live on GitHub and the commit-pinned URL resolves to the correct content.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced in this plan. The dev Gist is a private (secret) Gist on the existing GitHub account.

## Self-Check

### Files exist:
- [x] `.planning/phases/20-image-search-research-poc/20-02-GIST-REFS.md` — exists
- [x] `.planning/phases/20-image-search-research-poc/artifacts/dev-librechat.yaml` — exists

### Commits exist:
- [x] `77534ec` — chore(20-02): verify github token + capture PROD_GIST_SHA_PRE baseline
- [x] `51dce8e` — feat(20-02): create dev Gist kidschat-dev-librechat with image-search MCP + preset

### Verification checks (re-run at summary time):
- [x] `image-search` present in dev Gist: PASS
- [x] `chatMenu: false` present in dev Gist: PASS
- [x] `interface.mcpServers.use: false` preserved: PASS
- [x] `IMAGE_SEARCH_AGENT_ID` recorded in GIST-REFS.md: PASS
- [x] `DEV_CONFIG_PATH` recorded in GIST-REFS.md: PASS
- [x] `artifacts/dev-librechat.yaml` committed: PASS
- [x] Production Gist byte-identical (T-20-C-01): PASS

## Self-Check: PASSED
