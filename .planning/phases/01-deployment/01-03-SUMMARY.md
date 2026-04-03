---
phase: 01-deployment
plan: 03
subsystem: infra
tags: [github-gist, librechat-yaml, config-path, model-specs]

requires:
  - phase: 01-02
    provides: Locked-down LibreChat with API configured
provides:
  - Public GitHub Gist with librechat.yaml (placeholder)
  - CONFIG_PATH wired to filename-specific raw URL
  - modelSpecs.enforce=true active, UI locked down
affects: [01-04, phase-2]

tech-stack:
  added: []
  patterns: [gist-hosted-config, config-path-mechanism]

key-files:
  created: []
  modified: []

key-decisions:
  - "Gist created via gh CLI as public (contains no secrets)"
  - "Used filename-specific raw URL format per pitfalls research"
  - "GitHub username is mirkanu (changed from manuelkuhs)"

patterns-established:
  - "Config updates: edit Gist → redeploy LibreChat service to pick up changes"
  - "Filename-specific Gist URL: .../raw/librechat.yaml (not version-agnostic)"

requirements-completed: [CONF-01, CONF-02, CONF-03]

duration: 10min
completed: 2026-04-03
---

# Plan 01-03: Create GitHub Gist + Wire CONFIG_PATH

**Public GitHub Gist created with placeholder librechat.yaml, CONFIG_PATH set in Railway, modelSpecs enforced and UI locked down.**

## What was done

1. Created placeholder librechat.yaml with:
   - modelSpecs.enforce=true, prioritize=true
   - Single spec: "AI Assistant" using claude-haiku-4-5
   - Interface: endpointsMenu=false, modelSelect=false, parameters=false, presets=false
   - Placeholder safety prompt (full prompt in Phase 2)
2. Created public GitHub Gist via `gh gist create`
3. Set CONFIG_PATH in Railway to filename-specific raw URL
4. Verified config loaded via Railway logs: "Custom config file loaded"

## Key URLs

- Gist: https://gist.github.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf
- Raw URL (CONFIG_PATH): https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/librechat.yaml

## Verification

- Railway logs show "Custom config file loaded" ✓
- Config API confirms modelSpecs.enforce=true ✓
- Label shows "AI Assistant" ✓
- Interface: endpointsMenu=false, modelSelect=false, parameters=false, presets=false ✓
- Gist raw URL shows no API keys or secrets ✓
- Minor warning: "Outdated Config version: 1.3.5" — non-blocking

## Issues encountered

- GitHub CLI needed re-login as `mirkanu` (username changed from `manuelkuhs`) with gist scope added
