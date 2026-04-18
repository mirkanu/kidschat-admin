---
phase: 20
plan: 01
subsystem: image-search
tags: [mcp, openverse, railway, poc]
requires: [Railway CLI v4.31+, Node 20]
provides:
  - "kidschat-image-search-mcp Railway service (public + internal URLs recorded in 20-01-ENDPOINTS.md)"
  - "image_search MCP tool wrapping Openverse (thumbnail/title/source_domain/license — no source-site URLs)"
  - "services/image-search-mcp/ monorepo subdirectory in KidAI repo"
affects:
  - "LibreChat librechat.yaml (Plan 20-02 will wire the MCP URL into dev Gist)"
tech-stack:
  added:
    - "@modelcontextprotocol/sdk ^1.29.0"
    - "Openverse /v1/images/ (unauthenticated public API)"
  patterns:
    - "Stateless StreamableHTTPServerTransport per-request (sessionIdGenerator: undefined) — simplest correct shape for a single-tool MCP service"
    - "Option-iii click-through enforcement at the tool boundary via field-stripping in providers/openverse.ts (not the prompt layer)"
    - "railway up --path-as-root <subdir> for monorepo subdirectory deploys"
key-files:
  created:
    - "services/image-search-mcp/package.json"
    - "services/image-search-mcp/tsconfig.json"
    - "services/image-search-mcp/.gitignore"
    - "services/image-search-mcp/railway.json"
    - "services/image-search-mcp/src/server.ts"
    - "services/image-search-mcp/src/providers/openverse.ts"
    - "services/image-search-mcp/README.md"
    - ".planning/phases/20-image-search-research-poc/20-01-ENDPOINTS.md"
  modified: []
decisions:
  - "Openverse is the SOLE provider (Amendment B) — no Google CSE, no Pexels, no Brave; documented rationale in plan and service README"
  - "railway.json `NIXPACKS` + healthcheckPath /health for a 30s healthcheck window"
  - "Stateless MCP transport — no session DB, no sticky routing; horizontally scalable trivially"
  - "Internal Railway URL (kidschat-image-search-mcp.railway.internal:8080/mcp) is the intended wire path from LibreChat; public URL retained for curl smoke + parent verification"
metrics:
  duration: "~35 min (single executor, main worktree)"
  tasks_completed: 3
  files_created: 8
  commits:
    - "2b4fbd6 feat(20-01): author kidschat-image-search-mcp server"
    - "d9972dd feat(20-01): deploy kidschat-image-search-mcp to Railway; record endpoints"
  completed_date: "2026-04-18"
---

# Phase 20 Plan 01: kidschat-image-search-mcp (Openverse-only) Summary

A tiny Node/TypeScript MCP server wrapping the Openverse public API is now live at `kidschat-image-search-mcp-production.up.railway.app`, exposes a single `image_search(query, count?)` tool, strips source-site URLs at the tool boundary (option-iii click-through enforcement), and is ready for Plan 20-02 to attach in the dev-Gist `librechat.yaml`.

## Railway Service

- **Name:** `kidschat-image-search-mcp`
- **Service ID:** `78b1c1d5-ecb1-4e92-a7e7-9ff506e21e97`
- **Project:** KidsChat / environment production
- **Public URL:** `https://kidschat-image-search-mcp-production.up.railway.app`
- **Internal URL (for LibreChat→MCP on the Railway private network):** `http://kidschat-image-search-mcp.railway.internal:8080`
- **MCP endpoint:** `/mcp` (both URLs)
- **Health endpoint:** `/health` returns `{"ok":true,"provider":"openverse"}`

Both URLs are recorded in `.planning/phases/20-image-search-research-poc/20-01-ENDPOINTS.md` for Plan 20-02 to embed verbatim.

## Sample Openverse Response (live, 2026-04-18)

```bash
$ curl -sS 'https://api.openverse.org/v1/images/?q=origami+cats&page_size=3' \
    | jq '{result_count, sample: .results[0] | {thumbnail,title,source,license}}'
{
  "result_count": 240,
  "sample": {
    "thumbnail": "https://api.openverse.org/v1/images/5035d29d-01a5-4dfa-807f-9838e6d58d42/thumb/",
    "title": "Origami Cat",
    "source": "flickr",
    "license": "by-nc-nd"
  }
}
```

Through the deployed MCP server (`tools/call image_search("origami cats", 3)`), the same three results arrive but with `foreign_landing_url` and `url` stripped — option-iii verified end-to-end on Railway.

## Deviations from Plan

### [Rule 3 — Blocking] `RAILWAY_ROOT_DIRECTORY` env var is not a Railway-recognized setting

- **Found during:** Task 20-01-03 first `railway up`.
- **Issue:** The plan suggested setting `RAILWAY_ROOT_DIRECTORY=services/image-search-mcp` as a service variable as a fallback since the CLI doesn't have a `--root` flag. In practice Railway ignored it — the first deploy uploaded and built the entire KidAI repo root (ran `next build` on the admin dashboard, failed).
- **Fix:** Used `railway up --path-as-root services/image-search-mcp`. This flag uses the given path both as the upload source and as the archive root, so Railway sees only the service subdir, correctly auto-detects Nixpacks, and runs the `railway.json` build/start commands.
- **Files modified:** none — the env var `RAILWAY_ROOT_DIRECTORY` is still set on the service but has no effect; harmless and left in place for documentation.
- **Commit:** `d9972dd` (second, successful deploy).

### [Doc-only] Stale Google references remain in 20-RESEARCH.md and 20-CONTEXT.md

- **Found during:** Initial file read.
- **Issue:** Per the scope note in this execution's prompt, 20-RESEARCH.md and 20-CONTEXT.md still describe Google CSE as primary + Openverse fallback. 20-01-PLAN.md's Amendment B is the authoritative source and supersedes them.
- **Fix:** Not fixed in this plan (out of scope). Flagged here for the user to clean up later — probably best as a quick docs-only pass that adds an "Amendment B" banner to both files pointing at the plan.
- **Commit:** none.

## Auth Gates

None. Openverse is unauthenticated; no Railway secrets were provisioned or rotated; no user interaction was required during execution.

## Threat-model Coverage

| Threat ID | Mitigation applied |
| --------- | ------------------ |
| T-20-B-01 | N/A — no credentials exist (Openverse is public). |
| T-20-B-02 | Belt-and-suspenders grep for `AIza…` literals in `.planning/` and `services/` returns empty at commit time. |
| T-20-A-02 | `src/providers/openverse.ts` does not destructure or forward `foreign_landing_url` or `url` — verified by `grep -q 'foreign_landing_url' services/image-search-mcp/src/providers/openverse.ts` (matches the mention-in-comment + the structural type where those fields are intentionally absent). The tool response shape physically cannot carry a source-site URL. |
| T-20-A-01 | Deferred to Plan 20-03 agent prompt, as expected by the threat register. Openverse's CC-curated corpus is an inherent first layer. |

## Known Stubs

None. The server is a fully-wired, production-ready Openverse router — no placeholder data, no TODOs blocking kid-visible behavior. Plan 20-02 is expected to reference the internal URL verbatim from `20-01-ENDPOINTS.md`.

## Self-Check: PASSED

- [x] `services/image-search-mcp/package.json` — FOUND
- [x] `services/image-search-mcp/src/server.ts` — FOUND
- [x] `services/image-search-mcp/src/providers/openverse.ts` — FOUND (contains `foreign_landing_url` mention in the stripping comment)
- [x] `services/image-search-mcp/dist/server.js` — FOUND (post-build; also rebuilt on Railway)
- [x] `.planning/phases/20-image-search-research-poc/20-01-ENDPOINTS.md` — FOUND
- [x] Commit `2b4fbd6` — FOUND in `git log`
- [x] Commit `d9972dd` — FOUND in `git log`
- [x] `curl -fs https://kidschat-image-search-mcp-production.up.railway.app/health` — returns `{"ok":true,"provider":"openverse"}`
- [x] `grep -rE 'AIza[A-Za-z0-9_-]{30,}' .planning/ services/` — empty
