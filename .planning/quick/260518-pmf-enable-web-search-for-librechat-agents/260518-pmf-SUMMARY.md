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

## Verification

- `docker ps --filter "name=searxng"` → Up, no host port binding
- `docker ps --filter "name=librechat"` → Up (healthy)
- `docker exec searxng wget ... /search?q=cats&format=json` → 19-31 results returned
- LibreChat logs: `"searxngInstanceURL": "http://searxng:8080"` + `WEB_SEARCH USE: true` for USER and ADMIN roles
- Gist raw: webSearch: true, searxngInstanceURL: "http://searxng:8080", "web_search" in capabilities

## Threat Surface Scan

No new network endpoints exposed externally. SearXNG has no host port binding — internal Docker network only. Threat model T-pmf-01 through T-pmf-04 remain as accepted in the plan.

## Self-Check

- [x] /home/services/hetzner-vps/searxng-settings.yml exists
- [x] /home/services/hetzner-vps/docker-compose.yml contains `container_name: searxng`
- [x] SearXNG container running (verified via docker ps)
- [x] LibreChat healthy (verified via docker ps)
- [x] Gist updated (verified via raw URL)
- [x] LibreChat logs confirm WEB_SEARCH permission enabled
