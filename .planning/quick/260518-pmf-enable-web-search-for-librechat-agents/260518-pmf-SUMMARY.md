---
phase: 260518-pmf
plan: "01"
subsystem: infrastructure
tags: [searxng, web-search, librechat, docker, kids-safety]
dependency_graph:
  requires: []
  provides: [web-search-for-agents]
  affects: [librechat, docker-compose]
tech_stack:
  added: [searxng/searxng:latest]
  patterns: [docker-sidecar, volume-mounted-config, internal-docker-network]
key_files:
  created:
    - /home/services/hetzner-vps/searxng-settings.yml
  modified:
    - /home/services/hetzner-vps/docker-compose.yml
    - Gist:e23b999f1d3cd77726a97c20e26f0abf (librechat.yaml)
decisions:
  - SearXNG binds on port 8080 (container default) not 8888 — port key in settings.yml is ignored by granian entrypoint
  - search.formats must include "json" explicitly + server.limiter: false to allow LibreChat API calls (default blocks headless JSON requests)
  - SearXNG config via volume-mounted settings.yml (not shell echo command override) for reliability
metrics:
  duration: "~15 minutes"
  completed: "2026-05-18"
  tasks_completed: 3
  files_changed: 3
---

# Phase 260518-pmf Plan 01: Enable Web Search for LibreChat Agents Summary

SearXNG self-hosted Docker sidecar deployed with strict safe-search; LibreChat webSearch enabled — agents can now answer real-time questions instead of saying "I don't have internet access."

## Tasks Completed

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add SearXNG to docker-compose.yml | Done | Volume-mounted settings.yml, no host port exposed |
| 2 | Update Gist librechat.yaml | Done | webSearch: true, searxngInstanceURL, web_search capability |
| 3 | Deploy — start SearXNG, restart LibreChat, smoke test | Done | 19-31 results returned, LibreChat WEB_SEARCH permission enabled |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SearXNG container port is 8080, not 8888**
- **Found during:** Task 3 deployment
- **Issue:** Plan specified port 8888 but SearXNG's granian entrypoint ignores the `server.port` setting in settings.yml and always binds to its default port 8080
- **Fix:** Removed `port: 8888` from searxng-settings.yml; updated SEARXNG_BASE_URL in docker-compose.yml to use port 8080; updated Gist searxngInstanceURL from :8888 to :8080
- **Files modified:** /home/services/hetzner-vps/searxng-settings.yml, /home/services/hetzner-vps/docker-compose.yml, Gist librechat.yaml

**2. [Rule 1 - Bug] SearXNG blocked JSON API requests by default (403)**
- **Found during:** Task 3 smoke test
- **Issue:** SearXNG's default bot-detection limiter blocks headless JSON format requests, returning 403 Forbidden
- **Fix:** Added `server.limiter: false` and `search.formats: [html, json]` to searxng-settings.yml
- **Files modified:** /home/services/hetzner-vps/searxng-settings.yml

## Post-Deploy Fixes (E2E debugging session)

Three additional issues found and fixed after initial deploy:

**Fix 1 — `tools: []` on all 4 text agents**
- Initial executor claimed to add `web_search` capability but only updated the Gist YAML; MongoDB agent documents were untouched
- Fix: `db.agents.updateMany({id:{$in:[...4 agent IDs...]}}, {$addToSet:{tools:"web_search"}})`
- LibreChat's tool executor is wired per-agent via the `tools` array in MongoDB, not from librechat.yaml capabilities

**Fix 2 — `SEARXNG_URL` env var missing from LibreChat container**
- LibreChat's `extractWebSearchEnvVars()` only resolves `${VAR_NAME}` template syntax; a hardcoded URL returns null → searxng provider silently skipped → tool definition sent to Claude but no executor registered → "Tool web_search not found" at runtime
- Fix: added `- SEARXNG_URL=http://searxng:8080` to librechat service in `/home/services/hetzner-vps/docker-compose.yml`

**Fix 3 — Hardcoded URL + wrong key casing in Gist**
- Gist had `searxngInstanceURL: "http://searxng:8080"` (hardcoded + uppercase URL)
- Fix: changed to `searxngInstanceUrl: "${SEARXNG_URL}"` (env var reference + correct camelCase)

## Verification

- `docker ps --filter "name=searxng"` → Up, no host port binding
- `docker ps --filter "name=librechat"` → Up (healthy)
- E2E chat-test.ts "Friendly Tutor" "What happened in the news today?" → `[TOOL] web_search args={"query":"news today","news":true}` fired, returned live BBC/AP results for 2026-05-18
- Claude answered with real current news instead of "my knowledge was last updated in early 2024"

## Threat Surface Scan

No new network endpoints exposed externally. SearXNG has no host port binding — internal Docker network only. Threat model T-pmf-01 through T-pmf-04 remain as accepted in the plan.

## Self-Check

- [x] /home/services/hetzner-vps/searxng-settings.yml exists
- [x] /home/services/hetzner-vps/docker-compose.yml contains `container_name: searxng`
- [x] SearXNG container running (verified via docker ps)
- [x] LibreChat healthy (verified via docker ps)
- [x] Gist updated (verified via raw URL)
- [x] LibreChat logs confirm WEB_SEARCH permission enabled
