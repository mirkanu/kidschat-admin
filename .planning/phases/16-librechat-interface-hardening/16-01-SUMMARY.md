---
phase: 16-librechat-interface-hardening
plan: 01
subsystem: infra
tags: [librechat, yaml-config, gist, railway, hardening, interface]

# Dependency graph
requires:
  - phase: 15.4-cost-cap-alert-contract-fixes
    provides: Stable LibreChat deployment with working image generation and budget enforcement
provides:
  - MCP server add UI disabled for child accounts (HARDEN-MCP-01)
  - Agent Marketplace disabled for child accounts (HARDEN-MARKETPLACE-01)
  - Chat deletion accepted limitation — delete still present (HARDEN-DELETE-01 partial)
  - Distinct icons on 4 tone presets: Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal (POLISH-ICONS-01)
  - RAILWAY_RUN_AS_ROOT=true set — image generation volume permissions fixed
  - PRE/POST/DIFF audit trail for live Gist config changes
affects:
  - HARDEN-DELETE-02 — delete still present and destructive; CRITICAL follow-up required in next phase

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gist-hosted librechat.yaml: push new content → update CONFIG_PATH to new commit hash → redeploy LibreChat (never reuse old pinned hash)"
    - "RAILWAY_RUN_AS_ROOT=true required for Railway Volume mounts under LibreChat's internal user"

key-files:
  created:
    - .planning/phases/16-librechat-interface-hardening/16-01-LIVE-CONFIG-PRE.yaml
    - .planning/phases/16-librechat-interface-hardening/16-01-LIVE-CONFIG-POST.yaml
    - .planning/phases/16-librechat-interface-hardening/16-01-DIFF.md
    - .planning/phases/16-librechat-interface-hardening/16-01-AUDIT-NOTES.md
  modified:
    - Live GitHub Gist e23b999f1d3cd77726a97c20e26f0abf (librechat.yaml) — 4 hardening edits applied

key-decisions:
  - "HARDEN-DELETE-01 accepted as limitation: LibreChat has no role-scoped delete suppression in v0.8.4 config; delete is still present and hard-deletes from MongoDB, removing from admin dashboard. CRITICAL: must be fixed as HARDEN-DELETE-02."
  - "RAILWAY_RUN_AS_ROOT=true added to fix EACCES: permission denied, mkdir on Railway Volume — image generation was broken until this was set"
  - "CONFIG_PATH updated to pinned new Gist commit hash after every push to bypass CDN cache and ensure LibreChat boots the correct config revision"
  - "Icons assigned to presets using emoji/text labels in agent descriptions — cosmetic follow-up noted: icons appear black on gray/dark background; white-stroke SVGs would be better"

patterns-established:
  - "Gist config audit trail: always commit PRE + POST + DIFF snapshots to .planning/phases/ before/after live Gist edits"

requirements-completed: [HARDEN-MCP-01, HARDEN-MARKETPLACE-01, POLISH-ICONS-01]

# Metrics
duration: multi-session
completed: 2026-04-11
---

# Phase 16 Plan 01: LibreChat Interface Hardening Summary

**MCP server add + Agent Marketplace disabled in librechat.yaml Gist config, tone preset icons assigned, Railway redeployed with RAILWAY_RUN_AS_ROOT=true — UAT approved with two noted follow-ups**

## Performance

- **Duration:** Multi-session (audit + config edit + UAT spanning one session)
- **Started:** 2026-04-11
- **Completed:** 2026-04-11
- **Tasks:** 5 (Tasks 1-4 automated, Task 5 human UAT)
- **Files modified:** 4 audit trail files + live GitHub Gist (config-only changes, no app code)

## Accomplishments

- Disabled MCP server add UI for all LibreChat accounts (HARDEN-MCP-01) — confirmed by Railway logs showing `[MCP_SERVERS] Forbidden: Insufficient permissions for User`
- Disabled Agent Marketplace browse/install UI (HARDEN-MARKETPLACE-01) — confirmed gone in Sebastian's browser
- Assigned distinct icons to all 4 tone presets (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal) — POLISH-ICONS-01 delivered; cosmetic follow-up: icons appear black on gray/dark background
- Fixed image generation (EACCES volume permission error) by setting RAILWAY_RUN_AS_ROOT=true — images now work in both LibreChat frontend and admin dashboard backend
- Full audit trail committed: PRE/POST/DIFF snapshots in `.planning/phases/16-librechat-interface-hardening/`

## Task Commits

1. **Tasks 1-2: Audit live Gist + apply 4 hardening edits + DIFF.md** — `e496a3c` (feat)
2. **Task 3: Push POST config to live Gist** — Gist commit `b98002840046ed517ea814ba2a4e0d819d3b8aa8` (out-of-git; live Gist updated)
3. **Task 4: Update CONFIG_PATH + redeploy LibreChat** — Railway redeploy (Railway internal; includes RAILWAY_RUN_AS_ROOT=true fix)
4. **Task 5: Human UAT as Sebastian** — Approved (see UAT Results below)

**Plan metadata:** committed in this docs commit (docs: complete plan)

## Files Created/Modified

- `.planning/phases/16-librechat-interface-hardening/16-01-LIVE-CONFIG-PRE.yaml` — Snapshot of live Gist before any changes (audit trail)
- `.planning/phases/16-librechat-interface-hardening/16-01-LIVE-CONFIG-POST.yaml` — Snapshot of live Gist after 4 hardening edits applied
- `.planning/phases/16-librechat-interface-hardening/16-01-DIFF.md` — Human-readable diff with per-change rationale tied to HARDEN-* IDs
- `.planning/phases/16-librechat-interface-hardening/16-01-AUDIT-NOTES.md` — Research notes on LibreChat config schema toggles
- **Live GitHub Gist `e23b999f1d3cd77726a97c20e26f0abf`** — librechat.yaml updated with all 4 hardening edits

## UAT Results (Task 5 — Sebastian account)

| Requirement | Result | Notes |
|-------------|--------|-------|
| POLISH-ICONS-01 — Preset icons | PASS | Icons visible and distinct. Cosmetic: black icons on gray/dark background. Follow-up: consider white-stroke SVGs. |
| HARDEN-DELETE-01 — Chat delete | ACCEPTED LIMITATION | Delete still present and IS destructive (hard-deletes from MongoDB, erases from admin dashboard). Config toggle does not exist in LibreChat v0.8.4. CRITICAL follow-up: HARDEN-DELETE-02. |
| HARDEN-MCP-01 — MCP server add | PASS | Gone. Railway logs confirm `[MCP_SERVERS] Forbidden: Insufficient permissions for User`. |
| HARDEN-MARKETPLACE-01 — Marketplace | PASS | Gone from Sebastian's account. |
| Image generation | PASS (after fix) | Was broken due to Railway Volume EACCES. Fixed by RAILWAY_RUN_AS_ROOT=true + redeploy. |

## Decisions Made

- **HARDEN-DELETE-01 accepted as limitation:** LibreChat v0.8.4 provides no role-scoped chat deletion suppression in the YAML config schema. The delete action remains available to child accounts and hard-deletes from MongoDB (removing history from the admin dashboard). This is a known risk accepted by the parent and MUST be addressed in HARDEN-DELETE-02.
- **RAILWAY_RUN_AS_ROOT=true:** Image generation was broken with `EACCES: permission denied, mkdir` when LibreChat's internal process tried to write to the Railway Volume. Setting this env var allows the process to own the volume mount. Applied during Task 4 as a blocking fix.
- **CONFIG_PATH commit-pinned:** After every Gist push, CONFIG_PATH must be updated to the new commit hash to prevent LibreChat from fetching the old cached revision on redeploy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed EACCES volume permission error breaking image generation**
- **Found during:** Task 4 / UAT (Sebastian tested image generation and it failed)
- **Issue:** Railway Volume mount was not writable by LibreChat's internal process user. Error: `EACCES: permission denied, mkdir`
- **Fix:** Set `RAILWAY_RUN_AS_ROOT=true` environment variable on the LibreChat Railway service and redeployed
- **Files modified:** Railway service environment variables (external to git)
- **Verification:** Image generation tested in both LibreChat frontend and admin dashboard backend — both pass after fix
- **Committed in:** Railway environment variable change (out-of-git infrastructure)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Necessary fix for image generation functionality discovered during UAT. No scope creep.

## Known Issues / Follow-ups

### CRITICAL — HARDEN-DELETE-02 (do NOT forget)

Chat deletion by child accounts (Sebastian, Penelope) is still possible and hard-deletes from MongoDB, erasing conversation history from the admin dashboard. This eliminates parent oversight. LibreChat v0.8.4 has no config toggle to suppress delete for non-admin roles.

**Required follow-up:** Implement HARDEN-DELETE-02 — investigate LibreChat source-level patch, proxy intercept, or alternative approach to prevent child-initiated deletions.

Parent has confirmed: "We must ensure we do NOT forget to fix the delete!"

### Cosmetic — Icon color on dark background

The 4 preset icons are black SVGs on a gray/dark background. They are visible and functional but would look better as white-stroke SVGs in dark mode. Non-blocking cosmetic polish item.

## Next Phase Readiness

- MCP and Marketplace hardening is complete and verified
- Image generation works correctly on Railway (RAILWAY_RUN_AS_ROOT=true in place)
- HARDEN-DELETE-02 is the single most important follow-up for v2.5 completion
- Audit trail (PRE/POST/DIFF) is committed and ready for rollback if needed

---
*Phase: 16-librechat-interface-hardening*
*Completed: 2026-04-11*
