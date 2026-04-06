---
phase: quick-7
plan: 01
subsystem: librechat-config
tags: [librechat, config, yaml, railway, interface]
dependency_graph:
  requires: []
  provides: [temporaryChat-disabled]
  affects: [librechat-frontend]
tech_stack:
  added: []
  patterns: [gist-yaml-config, railway-env-update]
key_files:
  created: []
  modified:
    - gist:e23b999f1d3cd77726a97c20e26f0abf/librechat.yaml
key_decisions:
  - "Fixed YAML parse error in systemPrompt block literal (wrong indentation) rather than using a startCommand wget workaround"
  - "Updated CONFIG_PATH env var to new pinned commit hash after Gist update"
  - "Removed all custom startCommand overrides — default npm run backend restored"
metrics:
  duration: 38 minutes
  completed: 2026-04-06
  tasks: 1
  files_changed: 1
---

# Quick Task 7: Disable Temporary Chat button on LibreChat — Summary

**One-liner:** Fixed invalid YAML in Gist config (systemPrompt block indentation) and updated CONFIG_PATH to new commit hash — `interface.temporaryChat: false` now applied on every LibreChat startup.

## What Was Done

### Task 1: Set startCommand on LibreChat Railway service and redeploy

**Root cause discovered:** The Gist YAML (`librechat.yaml`) had a YAML parse error at line 200 — the `systemPrompt: |` block literal content was at the SAME indentation level (6 spaces) as the key itself, which is invalid. Block scalar content must be MORE indented than the key. As a result, LibreChat's `loadCustomConfig()` was failing to parse the entire YAML and returning `null`, causing ALL config settings (including `interface.temporaryChat: false`) to be ignored.

**Initial approach attempted:** Setting a custom `startCommand` on the Railway service to download the YAML locally before starting (to work around the perceived "URL-loaded configs ignore interface section" limitation). This approach was explored extensively but revealed the real issue via deployment logs.

**Actual fix applied:**
1. Fixed the YAML file — added 2 extra spaces to all `systemPrompt` block content lines (from 6 spaces to 8 spaces)
2. Validated the fix with Python's `yaml.safe_load()` 
3. Updated the Gist via GitHub API (PATCH `/api/gists/{id}`)
4. Updated `CONFIG_PATH` env var on the LibreChat Railway service to point to the new commit hash URL
5. Removed the custom startCommand (reverted to default `npm run backend`)
6. Triggered redeploy via `deploymentRedeploy` mutation

## Verification Results

**Deployment:** SUCCESS (Railway deploy `ca7e6a5c-ffb4-4237-96e4-ac0656fea336`)

**API checks:**

```
GET /api/config → interface.temporaryChat: false  ✓  PASS
GET /api/roles/ADMIN → TEMPORARY_CHAT.USE not set (role permission irrelevant — interface flag controls button)
```

**Deployment logs confirm:** "Custom config file loaded:" with full YAML including modelSpecs, interface settings, and fileConfig.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed YAML parse error in Gist config**
- **Found during:** Task 1, via Railway deployment logs
- **Issue:** `systemPrompt: |` block literal at line 197 had content at same indentation (6 spaces) as the key, causing full YAML parse failure. ALL config was ignored — including `temporaryChat: false`, modelSpecs, endpoints.
- **Fix:** Added 2 extra spaces to all systemPrompt block content lines (lines 198-225). Validated with `yaml.safe_load()`. Updated Gist via GitHub API.
- **Files modified:** `gist:e23b999f1d3cd77726a97c20e26f0abf/librechat.yaml` (commit `efd76aa44d422f74d90d5d282322cbb0f8e425c7`)
- **Commit:** N/A (Gist update, not local code)

**2. [Rule 3 - Blocking] startCommand approach investigated and abandoned**
- **Found during:** Task 1
- **Issue:** Original plan to use `curl -sfo /app/librechat.yaml "$CONFIG_PATH" && npm run backend` failed because `curl` is not installed in the `node:20-alpine` based LibreChat image. Switching to `wget` and various `CONFIG_PATH` override approaches were attempted but ineffective because Railway re-injects env vars into the container, overriding inline shell assignments.
- **Fix:** Identified the true root cause (YAML parse error) from deployment logs; abandoned the startCommand approach entirely.
- **Files modified:** None (Railway service startCommand was set/unset, now back to empty/default)

## Architecture Notes

- LibreChat's `loadCustomConfig()` fetches URLs via axios and parses the response as YAML. A parse error anywhere in the file causes `null` return — no partial loading.
- `serviceInstanceRedeploy` was inconsistently failing on this Railway instance. Using `deploymentRedeploy` (redeploying an existing successful deployment) was more reliable.
- The CDN for `gist.githubusercontent.com` caches the "latest" URL (`/raw/librechat.yaml`) aggressively. Always use pinned commit hash URLs for production stability.

## Self-Check

- [x] YAML fix validated with `python3 yaml.safe_load()` — passes
- [x] New Gist commit URL (`efd76aa44d422f74d90d5d282322cbb0f8e425c7`) returns valid YAML
- [x] `CONFIG_PATH` env var updated on LibreChat Railway service
- [x] Railway deployment `ca7e6a5c` succeeded
- [x] `/api/config` returns `interface.temporaryChat: false`
- [x] Deployment logs confirm "Custom config file loaded:" with full config

## Self-Check: PASSED
