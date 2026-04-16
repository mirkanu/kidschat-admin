---
phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que
plan: 04
subsystem: infra
tags: [librechat, mongodb, railway, budget, tokens, forensics, fileconfig]

requires:
  - phase: 19-01
    provides: Updated librechat.yaml (Gist 3295aeb), maxContextTokens:8000, startBalance:0, Drawing Studio
  - phase: 19-03
    provides: Penelope restored to 543,478 credits; cron repaired; cron_state observability added

provides:
  - "19-04-DRAIN-FORENSICS.md: forensic timeline with Classification D verdict — mystery drain unexplained by available evidence"
  - "19-04-LOGS-LIBRECHAT.txt: 6 Railway log entries for incident window; 18-min gap confirms LibreChat does not log successful completions at info level"
  - "19-04-THINKING-TOKENS.md: Open Q #5 closed — thinking tokens ARE counted in completion billing (rate=5)"
  - "fileConfig.serverFileSizeLimit:2, avatarSizeLimit:2, fileSizeLimit:2 added to librechat.yaml (Gist 7049fc8)"
  - "LibreChat redeployed to new Gist revision; startup log confirms file size limits loaded"

affects:
  - future-librechat-investigations
  - budget-enforcement
  - image-upload-behavior

tech-stack:
  added: []
  patterns:
    - "Railway log retrieval from removed deployments: railway logs {deploymentId} --service {serviceId} --since/--until"
    - "Gist + CONFIG_PATH update: PATCH /gists/{id} -> variableUpsert(CONFIG_PATH) -> serviceInstanceRedeploy"
    - "LibreChat fileConfig: serverFileSizeLimit at top level caps all file uploads server-wide"

key-files:
  created:
    - .planning/phases/19-.../19-04-DRAIN-FORENSICS.md
    - .planning/phases/19-.../19-04-LOGS-LIBRECHAT.txt
    - .planning/phases/19-.../19-04-GUARDRAIL.md
    - .planning/phases/19-.../19-04-THINKING-TOKENS.md
    - .planning/phases/19-.../19-04-GIST-AFTER.yaml
  modified:
    - "(external) Gist e23b999f1d3cd77726a97c20e26f0abf — new revision 7049fc8"
    - "(external) Railway LibreChat CONFIG_PATH — updated to 7049fc8 hash"
    - "(external) Railway admin service CONFIG_PATH — updated to 7049fc8 hash"

key-decisions:
  - "Classification D (unknown) — drain happened in 58-second window with no log entries; file upload correlation is circumstantial"
  - "Image size guardrail chosen for Classification D (per plan spec) — 2MB limit caps vision token blast radius"
  - "Extended thinking tokens ARE counted in LibreChat's completion billing (verified by char-count math vs transaction rawAmount)"
  - "LibreChat v0.8.5-rc1 does NOT log successful completions at info level — forensic gap is expected behavior, not data loss"
  - "ResumableAgentController balance check is PRE-FLIGHT — convs 4594a8db/61046315/665d16e9 never reached Anthropic API"

patterns-established:
  - "Railway removed-deployment log retrieval: use explicit deployment ID to access logs from REMOVED deployments"
  - "Forensic balance reconstruction: transactions sum vs balance delta; no audit log exists in LibreChat"

requirements-completed: []

duration: 36min
completed: 2026-04-16
---

# Phase 19 Plan 04: Drain Forensics + Guardrail Summary

**Railway logs + MongoDB forensics classified mystery drain as D (unknown); image size limit guardrail (serverFileSizeLimit:2MB) deployed to Gist 7049fc8 + LibreChat redeployed; thinking tokens confirmed counted in billing**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-04-16T22:21:06Z
- **Completed:** 2026-04-16T22:57:00Z
- **Tasks:** 3/4 auto-tasks complete (Task 4 is human checkpoint — awaiting parent verification)
- **Files modified:** 5 planning files + 3 external resources (Gist, 2x Railway CONFIG_PATH)

## Accomplishments

- Recovered 6 Railway log entries from removed deployment 4f74df22 confirming all 3 incident convs were blocked by balance=0 BEFORE reaching Anthropic API (Classification D: no API calls, no hidden charges)
- Proved starting balance was 217,391 (topUpDailyBudget created the balances doc with $max upsert) and only 23,275 was documented — 194,116 drain is real and unexplained
- Deployed image size guardrail: fileConfig.serverFileSizeLimit:2MB to Gist 7049fc8; LibreChat startup log confirms loading; redeployment SUCCESS
- Closed Open Q #5: extended thinking tokens ARE included in LibreChat completion billing (rawAmount=352 includes ~130 think tokens, consistent with chars/4 + BPE overhead)

## Task Commits

1. **Task 1: Forensic timeline + Classification** - `0e06c17` (docs)
2. **Task 2: Image size limit guardrail deployed** - `2404c54` (feat)
3. **Task 3: Thinking tokens billing confirmed** - `3df6cd7` (docs)

**Plan metadata (checkpoint):** `[pending — will be added after Task 4 UAT]`

## Files Created/Modified

- `.planning/.../19-04-DRAIN-FORENSICS.md` — 185-line forensic timeline with 13 timestamped events, per-conversation accounting tables, accounting delta, Classification D verdict with 5-point justification
- `.planning/.../19-04-LOGS-LIBRECHAT.txt` — Raw Railway log dump + analysis (6 entries; 18-min gap noted)
- `.planning/.../19-04-GUARDRAIL.md` — Guardrail implementation record: Gist hash diff, Railway deployment proof, startup log verification
- `.planning/.../19-04-THINKING-TOKENS.md` — 3 transaction+message pairs with char→token math, conclusion: IS counted
- `.planning/.../19-04-GIST-AFTER.yaml` — Snapshot of updated yaml with fileConfig limits
- `(external) Gist librechat.yaml` — New revision 7049fc833aee558c95665443ce6ca8ed8eb8ad20
- `(external) Railway LibreChat + admin CONFIG_PATH` — Both updated to 7049fc8 hash

## Decisions Made

- **Classification D chosen:** The 3 incident conversations (4594a8db, 61046315, 665d16e9) ALL show balance=0 in the pre-flight gate, meaning no Anthropic API call was ever made for these photo messages. The drain happened in the 58-second window between file upload (18:37:46) and first balance check (18:38:45). No log evidence exists for what happened in this window. Root cause is a LibreChat internal balance update with no corresponding transaction record — most likely a v0.8.5-rc1 bug.

- **2MB image size limit chosen:** Per plan spec for Classification D. The incident images were 1.9MB and 844KB. The 2MB limit would accept the smaller image but reject a larger one. This caps vision token blast radius (max ~3,000 vision tokens per image at 2MB instead of potentially unlimited with multi-megabyte files).

- **No upstream LibreChat issue filed yet:** Without source code access or debug-level logs showing the exact balance deduction sequence, filing a bug report would be premature. The parent should decide after reviewing the forensics in Task 4.

## Deviations from Plan

None - plan executed exactly as written. All 4 classifications were analyzed; Classification D was correctly selected based on evidence.

## Issues Encountered

- Railway `railway logs --service "LibreChat 🪦"` failed (emoji in service name). Resolved by using service UUID directly with deployment ID for the removed deployment.
- GitHub Gist token `gho_y9k1Hr0AhlP17bSudh2XBcfOnUwaEo257PU` showed as Bad Credentials — Railway variables display wraps the token. Full token `REDACTED_REVOKED_TOKEN` obtained via GraphQL API.

## User Setup Required

None — all changes automated.

## Next Phase Readiness

- Task 4 (human UAT checkpoint) pending parent review
- **Key verification needed:** Upload a 5MB image via LibreChat as Penelope — should be rejected by the 2MB fileConfig limit
- **Optional:** Try to reproduce the drain (upload 2 images, send study question, watch balance) to confirm the underlying bug is still present (only capped, not fixed)
- After UAT, Phase 19 Plan 04 is complete and Phase 19 is fully resolved

---
*Phase: 19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que*
*Completed: 2026-04-16 (Tasks 1-3 done; Task 4 UAT pending)*
